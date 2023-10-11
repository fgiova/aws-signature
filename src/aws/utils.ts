import { Buffer } from "node:buffer";
export type HttpRequest = {
	method: "POST" | "GET" | "PUT" | "DELETE" | "HEAD" | "OPTIONS" | "PATCH";
	path: string;
	query?: Record<string, string>;
	headers?: Record<string, string>;
	body?: string | ArrayBuffer | ArrayBufferView | ReadableStream<Uint8Array> | FormData;
}
export function formatDate (now = new Date()) {
	const longDate = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[\-:]/g, "");
	return {
		longDate,
		shortDate: longDate.slice(0, 8),
	};
}

/* c8 ignore next 3 */
function  hexEncode (c: string) {
	return `{%${c.charCodeAt(0).toString(16).toUpperCase()}`;
}
export function escapeUri (uri: string) {
	// AWS percent-encodes some extra non-standard characters in a URI
	return encodeURIComponent(uri).replace(/[!'()*]/g, hexEncode);
}
export function isArrayBuffer(arg: any): arg is ArrayBuffer {
	return (typeof ArrayBuffer === "function" && arg instanceof ArrayBuffer) ||
	Object.prototype.toString.call(arg) === "[object ArrayBuffer]";
}
export function fromUtf8 (input: string) {
	const buf =  Buffer.from(input, "utf8");
	return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength / Uint8Array.BYTES_PER_ELEMENT);
}
export function toUint8Array (data: string | ArrayBuffer | ArrayBufferView): Uint8Array {
	if (typeof data === "string") {
		return fromUtf8(data);
	}

	if (ArrayBuffer.isView(data)) {
		return new Uint8Array(data.buffer, data.byteOffset, data.byteLength / Uint8Array.BYTES_PER_ELEMENT);
	}

	return new Uint8Array(data);
}