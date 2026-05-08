import { cpus } from "node:os";
import path from "node:path";
import type { ResourceLimits } from "node:worker_threads";
import { type Static, Type } from "@sinclair/typebox";
import { envSchema } from "env-schema";
import { LRUCache } from "lru-cache";
import Piscina from "piscina";
import type { HttpRequest } from "./aws/utils.ts";
import { generateKey, signRequest } from "./sign_worker.ts";

export type { HttpRequest } from "./aws/utils.ts";

/* c8 ignore start */
const isTS = path.resolve(__filename).endsWith(".ts");
const isMjs = path.resolve(__filename).endsWith(".mjs");
const runEnv = {
	ext: isTS ? "ts" : isMjs ? "mjs" : "js",
	execArgv: isTS
		? ["--experimental-strip-types", "--no-warnings=ExperimentalWarning"]
		: undefined,
};
/* c8 ignore end */

const ConfigSchema = Type.Object({
	AWS_ACCESS_KEY_ID: Type.Optional(Type.String()),
	AWS_SECRET_ACCESS_KEY: Type.Optional(Type.String()),
	AWS_REGION: Type.String({ default: "" }),
	AWS_SIGNATURE_USE_WORKER_THREADS: Type.Boolean({ default: false }),
});

export type SignerOptions = {
	credentials?: {
		region?: string;
		accessKeyId?: string;
		secretAccessKey?: string;
	};
	useWorkerThreads?: boolean;
	minThreads?: number;
	maxThreads?: number;
	idleTimeout?: number;
	maxQueue?: number | "auto";
	concurrentTasksPerWorker?: number;
	resourceLimits?: ResourceLimits;
	maxTasksBeforeRecycle?: number;
	maxPoolAgeMs?: number;
	closeTimeout?: number;
};

export class Signer {
	private worker?: Piscina;
	private readonly keyCache: LRUCache<string, Buffer>;
	private readonly credentials: {
		region: string;
		accessKeyId: string;
		secretAccessKey: string;
	};
	private readonly useWorkerThreads: boolean;
	private readonly piscinaOptions?: ConstructorParameters<typeof Piscina>[0];
	private readonly maxTasksBeforeRecycle?: number;
	private readonly maxPoolAgeMs?: number;
	private completedAtLastRecycle = 0;
	private lastRecycleAt = Date.now();
	private recycling?: Promise<void>;

	cpuCount: number = (() => {
		try {
			return cpus().length;
		} catch {
			/* istanbul ignore next */
			return 1;
		}
	})();

	constructor(options: SignerOptions = {}) {
		const {
			useWorkerThreads,
			minThreads,
			maxThreads,
			idleTimeout,
			maxQueue,
			concurrentTasksPerWorker,
			resourceLimits,
			maxTasksBeforeRecycle,
			maxPoolAgeMs,
			closeTimeout,
			credentials: credentialsOptions,
		} = options;

		const config = envSchema<Static<typeof ConfigSchema>>({
			schema: ConfigSchema,
		});

		this.credentials = {
			region: config.AWS_REGION,
			accessKeyId: config.AWS_ACCESS_KEY_ID || "",
			secretAccessKey: config.AWS_SECRET_ACCESS_KEY || "",
			...credentialsOptions,
		};

		if (!this.credentials.accessKeyId || !this.credentials.secretAccessKey) {
			throw new Error("AWS credentials are required");
		}

		this.keyCache = new LRUCache<string, Buffer>({
			max: 50,
			ttl: 1000 * 60 * 60 * 24,
		});

		this.useWorkerThreads =
			useWorkerThreads ?? config.AWS_SIGNATURE_USE_WORKER_THREADS;

		if (!this.useWorkerThreads) {
			return;
		}

		const defaultResourceLimits: ResourceLimits = {
			maxOldGenerationSizeMb: 128,
			maxYoungGenerationSizeMb: 16,
		};
		this.piscinaOptions = {
			filename: path.resolve(__dirname, `./sign_worker.${runEnv.ext}`),
			execArgv: runEnv.execArgv,
			name: "generateKey",
			minThreads: minThreads ?? Math.max(this.cpuCount / 2, 1),
			maxThreads: maxThreads ?? this.cpuCount,
			idleTimeout: idleTimeout ?? 30_000,
			closeTimeout: closeTimeout ?? 10_000,
			maxQueue,
			concurrentTasksPerWorker,
			resourceLimits: { ...defaultResourceLimits, ...resourceLimits },
		};
		this.maxTasksBeforeRecycle = maxTasksBeforeRecycle ?? 250_000;
		this.maxPoolAgeMs = maxPoolAgeMs ?? 15 * 60 * 1000;
		this.worker = new Piscina(this.piscinaOptions);
	}

	private async recyclePool() {
		if (this.recycling) return this.recycling;
		const old = this.worker;
		if (!old || !this.piscinaOptions) return;
		this.worker = new Piscina(this.piscinaOptions);
		this.completedAtLastRecycle = 0;
		this.lastRecycleAt = Date.now();
		// In-flight tasks may resolve after close() destroys workers,
		// triggering "Unexpected message from Worker" errors on the closed
		// pool. Swallow them: callers retry via runOnPool.
		old.on("error", () => {});
		this.recycling = old.close({ force: false }).finally(() => {
			this.recycling = undefined;
		});
		return this.recycling;
	}

	private isRecycleTerminationError(err: unknown): boolean {
		if (!(err instanceof Error)) return false;
		return /ThreadTermination|Terminating worker thread|pool is closed/i.test(
			err.message,
		);
	}

	private async runOnPool<T>(
		payload: unknown,
		opts?: { name?: string },
	): Promise<T> {
		for (let attempt = 0; attempt < 2; attempt++) {
			const pool = this.worker;
			if (!pool) throw new Error("worker pool not initialized");
			try {
				return (await pool.run(payload, opts)) as T;
			} catch (err) {
				// Retry only if recycle replaced the pool under us.
				if (
					attempt === 0 &&
					this.worker !== pool &&
					this.isRecycleTerminationError(err)
				) {
					continue;
				}
				throw err;
			}
		}
		/* c8 ignore next */
		throw new Error("unreachable");
	}

	private maybeTriggerRecycle() {
		if (this.recycling || !this.worker) return;
		const tasksThreshold = this.maxTasksBeforeRecycle ?? 0;
		const ageThreshold = this.maxPoolAgeMs ?? 0;
		if (!tasksThreshold && !ageThreshold) return;
		const delta = this.worker.completed - this.completedAtLastRecycle;
		const elapsed = Date.now() - this.lastRecycleAt;
		const byTasks = tasksThreshold > 0 && delta >= tasksThreshold;
		const byAge = ageThreshold > 0 && elapsed >= ageThreshold;
		if (byTasks || byAge) {
			void this.recyclePool();
		}
	}

	private millsToNextDay() {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(0, 0, 0, 0);
		return Math.abs(tomorrow.getTime() - Date.now());
	}

	async request(
		request: HttpRequest,
		service: string,
		region?: string,
		date = new Date(),
	) {
		const requestCredentials = {
			...this.credentials,
			region: region || this.credentials.region,
		};

		if (!requestCredentials.region) {
			throw new Error("Region is required");
		}

		const keyId = `${service}-${requestCredentials.region}`;

		let key = this.keyCache.get(keyId);
		if (!key) {
			key = this.useWorkerThreads
				? await this.runOnPool<Buffer>({
						credentials: requestCredentials,
						service,
						date,
					})
				: generateKey({ credentials: requestCredentials, service, date });
			this.keyCache.set(keyId, key, {
				ttl: this.millsToNextDay(),
			});
		}
		const signedHeaders = this.useWorkerThreads
			? await this.runOnPool<Record<string, string>>(
					{ credentials: requestCredentials, request, service, key, date },
					{ name: "signRequest" },
				)
			: signRequest({
					credentials: requestCredentials,
					request,
					service,
					key,
					date,
				});
		request.headers = { ...(request.headers ?? {}), ...signedHeaders };
		this.maybeTriggerRecycle();
		return request;
	}

	async destroy() {
		this.keyCache.clear();
		if (!this.useWorkerThreads || !this.worker) return;
		if (this.recycling) {
			await this.recycling;
		}
		return this.worker.close({ force: true });
	}
}

export class SignerSingleton {
	private static signer: Signer;
	constructor() {
		throw new Error("Use SignerSingleton.getSigner()");
	}
	static getSigner(options?: SignerOptions) {
		if (!SignerSingleton.signer) {
			SignerSingleton.signer = new Signer(options);
		}
		return SignerSingleton.signer;
	}
	static async destroy() {
		if (SignerSingleton.signer) {
			await SignerSingleton.signer.destroy();
			SignerSingleton.signer = undefined as unknown as Signer;
		}
	}
}
