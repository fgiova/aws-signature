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

const keyCache = new LRUCache<string, Buffer>({
	max: 50,
	ttl: 1000 * 60 * 60 * 24,
});

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
};

export class Signer {
	private readonly worker: Piscina;
	private readonly credentials: {
		region: string;
		accessKeyId: string;
		secretAccessKey: string;
	};

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

		this.worker = new Piscina({
			filename: path.resolve(__dirname, `./sign_worker.${runEnv.ext}`),
			execArgv: runEnv.execArgv,
			name: "generateKey",
			minThreads: minThreads ?? Math.max(this.cpuCount / 2, 1),
			maxThreads: maxThreads ?? this.cpuCount * 1.5,
			idleTimeout,
			maxQueue,
			concurrentTasksPerWorker,
			resourceLimits,
		});
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

		let key = keyCache.get(keyId);
		if (!key) {
			key = (await this.worker.run({
				credentials: requestCredentials,
				service,
				date,
			})) as Buffer;
			keyCache.set(keyId, key, {
				ttl: this.millsToNextDay(),
			});
		}
		return (await this.worker.run(
			{ credentials: requestCredentials, request, service, key, date },
			{ name: "signRequest" },
		)) as HttpRequest;
	}

	async destroy() {
		return this.worker.destroy();
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
}
