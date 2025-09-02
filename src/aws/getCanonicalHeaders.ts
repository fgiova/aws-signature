import {
	ALWAYS_UNSIGNABLE_HEADERS,
	PROXY_HEADER_PATTERN,
	SEC_HEADER_PATTERN,
} from "./constants";
import type { HttpRequest } from "./utils";

/**
 * @private
 */
export function getCanonicalHeaders(
	{ headers }: HttpRequest,
	unsignableHeaders?: Set<string>,
	signableHeaders?: Set<string>,
) {
	const canonical: Record<string, string> = {};
	/* c8 ignore next 3 */
	if (!headers) {
		return canonical;
	}
	for (const headerName of Object.keys(headers).sort()) {
		// biome-ignore lint/suspicious/noDoubleEquals: leave as is
		if (headers[headerName] == undefined) {
			continue;
		}

		const canonicalHeaderName = headerName.toLowerCase();
		if (
			canonicalHeaderName in ALWAYS_UNSIGNABLE_HEADERS ||
			unsignableHeaders?.has(canonicalHeaderName) ||
			PROXY_HEADER_PATTERN.test(canonicalHeaderName) ||
			SEC_HEADER_PATTERN.test(canonicalHeaderName)
		) {
			if (
				!signableHeaders ||
				(signableHeaders && !signableHeaders.has(canonicalHeaderName))
			) {
				continue;
			}
		}

		canonical[canonicalHeaderName] = headers[headerName]
			.trim()
			.replace(/\s+/g, " ");
	}

	return canonical;
}
export function getCanonicalHeaderList(headers: object): string {
	return Object.keys(headers).sort().join(";");
}
