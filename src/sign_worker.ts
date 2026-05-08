import type { Buffer } from "node:buffer";
import * as crypto from "node:crypto";
import {
	ALGORITHM_IDENTIFIER,
	AMZ_DATE_HEADER,
	KEY_TYPE_IDENTIFIER,
	SHA256_HEADER,
} from "./aws/constants.ts";
import { createCanonicalRequest } from "./aws/createCanonicalRequest.ts";
import {
	getCanonicalHeaderList,
	getCanonicalHeaders,
} from "./aws/getCanonicalHeaders.ts";
import { getPayloadHash } from "./aws/getPayloadHash.ts";
import { formatDate, type HttpRequest, toUint8Array } from "./aws/utils.ts";

type AwsCredentials = {
	region: string;
	accessKeyId: string;
	secretAccessKey: string;
};

export function generateKey({
	credentials,
	service,
	date = new Date(),
}: {
	credentials: AwsCredentials;
	service: string;
	date?: Date;
}) {
	const { shortDate } = formatDate(date);
	let key: string | Buffer = `AWS4${credentials.secretAccessKey}`;
	for (const signable of [
		shortDate,
		credentials.region,
		service,
		KEY_TYPE_IDENTIFIER,
	]) {
		key = crypto.createHmac("sha256", key).update(signable).digest();
	}
	return key as Buffer;
}

function getSignatureSubject(
	longDate: string,
	scope: string,
	canonicalRequest: string,
) {
	return `${ALGORITHM_IDENTIFIER}
${longDate}
${scope}
${crypto.createHash("sha256").update(toUint8Array(canonicalRequest)).digest("hex")}`;
}

function authSignature(
	key: Buffer,
	longDate: string,
	scope: string,
	canonicalRequest: string,
) {
	const subject = getSignatureSubject(longDate, scope, canonicalRequest);
	return crypto.createHmac("sha256", key).update(subject).digest("hex");
}

function createScope(shortDate: string, service: string, region: string) {
	return `${shortDate}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`;
}

export function signRequest({
	request,
	service,
	key,
	credentials,
	date = new Date(),
}: {
	request: HttpRequest;
	service: string;
	credentials: AwsCredentials;
	key: Buffer;
	date: Date;
}): Record<string, string> {
	const { shortDate, longDate } = formatDate(date);
	const payloadHash = getPayloadHash(request);
	const headers = {
		...(request.headers ?? {}),
		[AMZ_DATE_HEADER]: longDate,
		[SHA256_HEADER]: payloadHash,
	};
	const requestWithHeaders = { ...request, headers };
	const scope = createScope(shortDate, service, credentials.region);
	const canonicalHeaders = getCanonicalHeaders(requestWithHeaders);
	const canonicalRequest = createCanonicalRequest(
		requestWithHeaders,
		canonicalHeaders,
		service.toLowerCase() === "s3",
	);
	const signature = authSignature(key, longDate, scope, canonicalRequest);

	return {
		[AMZ_DATE_HEADER]: longDate,
		[SHA256_HEADER]: payloadHash,
		Authorization: `${ALGORITHM_IDENTIFIER} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${getCanonicalHeaderList(canonicalHeaders)}, Signature=${signature}`,
	};
}
