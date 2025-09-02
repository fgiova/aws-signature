import { cpus } from "node:os";
import path from "node:path";
import type { ResourceLimits } from "node:worker_threads";
import { LRUCache } from "lru-cache";
import Piscina from "piscina";
import type { HttpRequest } from "./aws/utils";

export type { HttpRequest } from "./aws/utils";

/* c8 ignore start */
const isTS = path.resolve(__filename).endsWith(".ts");
const runEnv = {
	ext: isTS ? "ts" : "js",
	execArgv: isTS ? ["-r", "ts-node/register"] : undefined,
};
/* c8 ignore end */

const keyCache = new LRUCache<string, Buffer>({
	max: 50,
	ttl: 1000 * 60 * 60 * 24,
});

export type SignerOptions = {
	minThreads?: number;
	maxThreads?: number;
	idleTimeout?: number;
	maxQueue?: number | "auto";
	concurrentTasksPerWorker?: number;
	resourceLimits?: ResourceLimits;
};

export class Signer {
	private readonly worker: Piscina;
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
		} = options;

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
		const keyId = `${service}-${region}`;
		let key = keyCache.get(keyId);
		if (!key) {
			key = (await this.worker.run({ service, region, date })) as Buffer;
			keyCache.set(keyId, key, {
				ttl: this.millsToNextDay(),
			});
		}
		return (await this.worker.run(
			{ request, service, region, key, date },
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
