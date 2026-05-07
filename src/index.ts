import { cpus } from "node:os";
import path from "node:path";
import type { ResourceLimits } from "node:worker_threads";
import { type Static, Type } from "@sinclair/typebox";
import { envSchema } from "env-schema";
import { LRUCache } from "lru-cache";
import Piscina from "piscina";
import type { HttpRequest } from "./aws/utils";

export type { HttpRequest } from "./aws/utils";

/* c8 ignore start */
const isTS = path.resolve(__filename).endsWith(".ts");
const isMjs = path.resolve(__filename).endsWith(".mjs");
const runEnv = {
	ext: isTS ? "ts" : isMjs ? "mjs" : "js",
	execArgv: isTS ? ["-r", "ts-node/register"] : undefined,
};
/* c8 ignore end */

const ConfigSchema = Type.Object({
	AWS_ACCESS_KEY_ID: Type.Optional(Type.String()),
	AWS_SECRET_ACCESS_KEY: Type.Optional(Type.String()),
	AWS_REGION: Type.String({ default: "" }),
});

export type SignerOptions = {
	credentials?: {
		region?: string;
		accessKeyId?: string;
		secretAccessKey?: string;
	};
	minThreads?: number;
	maxThreads?: number;
	idleTimeout?: number;
	maxQueue?: number | "auto";
	concurrentTasksPerWorker?: number;
	resourceLimits?: ResourceLimits;
	maxTasksBeforeRecycle?: number;
};

export class Signer {
	private worker: Piscina;
	private readonly keyCache: LRUCache<string, Buffer>;
	private readonly credentials: {
		region: string;
		accessKeyId: string;
		secretAccessKey: string;
	};
	private readonly piscinaOptions: ConstructorParameters<typeof Piscina>[0];
	private readonly maxTasksBeforeRecycle?: number;
	private completedAtLastRecycle = 0;
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
			minThreads,
			maxThreads,
			idleTimeout,
			maxQueue,
			concurrentTasksPerWorker,
			resourceLimits,
			maxTasksBeforeRecycle,
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

		this.piscinaOptions = {
			filename: path.resolve(__dirname, `./sign_worker.${runEnv.ext}`),
			execArgv: runEnv.execArgv,
			name: "generateKey",
			minThreads: minThreads ?? Math.max(this.cpuCount / 2, 1),
			maxThreads: maxThreads ?? this.cpuCount * 1.5,
			idleTimeout: idleTimeout ?? 30_000,
			maxQueue,
			concurrentTasksPerWorker,
			resourceLimits,
		};
		this.maxTasksBeforeRecycle = maxTasksBeforeRecycle ?? 250_000;
		this.worker = new Piscina(this.piscinaOptions);
	}

	private async recyclePool() {
		if (this.recycling) return this.recycling;
		const old = this.worker;
		this.worker = new Piscina(this.piscinaOptions);
		this.completedAtLastRecycle = 0;
		this.recycling = old.close({ force: false }).finally(() => {
			this.recycling = undefined;
		});
		return this.recycling;
	}

	private maybeTriggerRecycle() {
		if (!this.maxTasksBeforeRecycle || this.recycling) return;
		const delta = this.worker.completed - this.completedAtLastRecycle;
		if (delta >= this.maxTasksBeforeRecycle) {
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
			key = (await this.worker.run({
				credentials: requestCredentials,
				service,
				date,
			})) as Buffer;
			this.keyCache.set(keyId, key, {
				ttl: this.millsToNextDay(),
			});
		}
		const signedHeaders = (await this.worker.run(
			{ credentials: requestCredentials, request, service, key, date },
			{ name: "signRequest" },
		)) as Record<string, string>;
		request.headers = { ...(request.headers ?? {}), ...signedHeaders };
		this.maybeTriggerRecycle();
		return request;
	}

	async destroy() {
		this.keyCache.clear();
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
