import { createHash } from "node:crypto";
import { SHA256_HEADER, UNSIGNED_PAYLOAD } from "./constants";
import { type HttpRequest, isArrayBuffer, toUint8Array } from "./utils";

/**
 * @private
 */
export function getPayloadHash({ headers, body }: HttpRequest) {
	if (headers) {
		for (const headerName of Object.keys(headers)) {
			if (headerName.toLowerCase() === SHA256_HEADER) {
				return headers[headerName];
			}
		}
	}

	if (body === undefined) {
		return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
	} else if (
		typeof body === "string" ||
		ArrayBuffer.isView(body) ||
		isArrayBuffer(body)
	) {
		return createHash("sha256").update(toUint8Array(body)).digest("hex");
	}

	// As any defined body that is not a string or binary data is a stream, this
	// body is unsignable. Attempt to send the request with an unsigned payload,
	// which may or may not be accepted by the service.
	return UNSIGNED_PAYLOAD;
}
