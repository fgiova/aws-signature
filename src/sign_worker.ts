// import {Worker, isMainThread, parentPort } from "worker_threads";
import * as crypto from "node:crypto";
import {envSchema} from "env-schema";
import {Type, Static} from "@sinclair/typebox";
import {ALGORITHM_IDENTIFIER, AMZ_DATE_HEADER, KEY_TYPE_IDENTIFIER, SHA256_HEADER} from "./aws/constants";
import {formatDate, HttpRequest, toUint8Array} from "./aws/utils";
import {createCanonicalRequest} from "./aws/createCanonicalRequest";
import {getCanonicalHeaderList, getCanonicalHeaders} from "./aws/getCanonicalHeaders";
import {getPayloadHash} from "./aws/getPayloadHash";
import {Buffer} from "node:buffer";

const ConfigSchema = Type.Strict(Type.Object({
	AWS_ACCESS_KEY_ID: Type.String(),
	AWS_SECRET_ACCESS_KEY: Type.String(),
	AWS_REGION: Type.Optional(Type.String()),
}));

const config = envSchema<Static<typeof ConfigSchema>>({
	schema: ConfigSchema
});

export function generateKey({secret = config.AWS_SECRET_ACCESS_KEY, region = config.AWS_REGION, service, date = new Date()}: {secret?: string, region?: string, service: string, date?: Date}) {
	const {shortDate} = formatDate(date);
	let key: string | Buffer = `AWS4${secret}`;
	for (const signable of [shortDate, region, service, KEY_TYPE_IDENTIFIER]) {
		key = crypto
			.createHmac("sha256", key)
			.update(signable)
			.digest();
	}
	return key as Buffer;
}

function getSignatureSubject( longDate: string, scope: string, canonicalRequest: string) {
	return `${ALGORITHM_IDENTIFIER}
${longDate}
${scope}
${crypto.createHash("sha256").update(toUint8Array(canonicalRequest)).digest("hex")}`;
}

function authSignature(
	key: Buffer,
	longDate: string,
	scope: string,
	canonicalRequest: string) {
	const subject = getSignatureSubject(longDate, scope, canonicalRequest);
	return crypto
		.createHmac("sha256", key)
		.update(subject)
		.digest("hex");
}

function createScope (shortDate: string, service: string, region: string) {
	return `${shortDate}/${region}/${service}/${KEY_TYPE_IDENTIFIER}`;
}

export function signRequest(
	{request, service, region = config.AWS_REGION, key, date = new Date()}: {request: HttpRequest, service: string, region?: string, key: Buffer, date: Date}
) {
	const {shortDate, longDate} = formatDate(date);
	request.headers[AMZ_DATE_HEADER] = longDate;
	request.headers[SHA256_HEADER] = getPayloadHash(request)
	const scope = createScope(shortDate, service, region);
	const canonicalHeaders = getCanonicalHeaders(request);
	const canonicalRequest = createCanonicalRequest(request, canonicalHeaders);
	const signature = authSignature(
		key,
		longDate,
		scope,
		canonicalRequest);
	request.headers["Authorization"] = `${ALGORITHM_IDENTIFIER} Credential=${config.AWS_ACCESS_KEY_ID}/${scope}, SignedHeaders=${getCanonicalHeaderList(canonicalHeaders)}, Signature=${signature}`;
	return request;
}