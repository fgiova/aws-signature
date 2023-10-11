import Piscina from "piscina";
import {HttpRequest} from "./aws/utils";
import {LRUCache} from "lru-cache";
import path from "node:path";
const isTS = path.resolve(__filename).endsWith(".ts");

/* c8 ignore start */
const runEnv = {
	ext: isTS ? "ts" : "js",
	execArgv: isTS ? ["-r", "ts-node/register"] : undefined
};
/* c8 ignore end */

const keyCache = new LRUCache<string, Buffer>({
	max: 50,
	ttl: 1000 * 60 * 60 * 24
});

const signRequestWorker = new Piscina({
	filename: path.resolve(__dirname, `./sign_worker.${runEnv.ext}`),
	name: "signRequest",
	execArgv: runEnv.execArgv
});

const keyGeneratorWorker = new Piscina({
	filename: path.resolve(__dirname, `./sign_worker.${runEnv.ext}`),
	name: "generateKey",
	execArgv: runEnv.execArgv
});

function millstoNextDay() {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(0, 0, 0, 0);
	return Math.abs( tomorrow.getTime() - new Date().getTime() );
}

export async function signRequest (request: HttpRequest, service: string, region?: string, date = new Date()) {
	const keyId = `${service}-${region}`;
	let key = keyCache.get(keyId);
	if(!key){
		key = await keyGeneratorWorker.run({service, region, date}) as Buffer;
		keyCache.set(keyId, key, {
			ttl: millstoNextDay()
		});
	}
	return await signRequestWorker.run({request, service, region, key, date}) as HttpRequest;
}