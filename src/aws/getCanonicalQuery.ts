import { SIGNATURE_HEADER } from "./constants";
import {escapeUri, HttpRequest} from "./utils";
export function getCanonicalQuery ({ query = {} }: HttpRequest) {
	const keys: Array<string> = [];
	const serialized: Record<string, string> = {};
	for (const key of Object.keys(query).sort()) {
		if (key.toLowerCase() === SIGNATURE_HEADER) {
			continue;
		}

		keys.push(key);
		const value = query[key];
		if (typeof value === "string") {
			serialized[key] = `${escapeUri(key)}=${escapeUri(value)}`;
		} else if (Array.isArray(value)) {
			serialized[key] = (value as Array<string>)
				.slice(0)
				.reduce(
					(encoded: Array<string>, value: string) => encoded.concat([`${escapeUri(key)}=${escapeUri(value)}`]),
					[]
				)
				.sort()
				.join("&");
		}
	}

	return keys
		.map((key) => serialized[key])
		.filter((serialized) => serialized) // omit any falsy values
		.join("&");
}