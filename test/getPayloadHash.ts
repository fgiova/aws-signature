import { test } from "tap";
import {getPayloadHash} from "../src/aws/getPayloadHash";
import {SHA256_HEADER, UNSIGNED_PAYLOAD} from "../src/aws/constants";


test("getPayloadHash", async (t) => {
	t.beforeEach(async (t) => {
		const requestData = {
			method: "POST",
			path: "/",
			headers: {
				host: "foo.us-bar-1.amazonaws.com",
			}
		}
		t.context = {
			requestData
		};
	});
	await t.test("should return the SHA-256 hash of an empty string if a request has no payload (body)", async (t) => {
		const hash = getPayloadHash(t.context.requestData);
		t.same(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
	await t.test(`should return the value in the '${SHA256_HEADER}' header (if present)`, async (t) => {
		const hash = getPayloadHash({
			...t.context.requestData,
			headers: {
				[SHA256_HEADER]: "foo",
			}
		});
		t.same(hash, "foo");
	});
	await t.test("should return the hex-encoded hash of a string body", async (t) => {
		const hash = getPayloadHash({
			...t.context.requestData,
			body: "foo",
		});
		t.same(hash, "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae");
	});
	await t.test("should return the hex-encoded hash of a ArrayBufferView body", async (t) => {
		const hash = getPayloadHash({
			...t.context.requestData,
			body: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
		});
		t.same(hash, "5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953");
	});
	await t.test("should return the hex-encoded hash of a ArrayBuffer body", async (t) => {
		const hash = getPayloadHash({
			...t.context.requestData,
			body: new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer,
		});
		t.same(hash, "5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953");
	});
	await t.test(`should return ${UNSIGNED_PAYLOAD} if the request has a streaming body and no stream collector is provided`, async (t) => {
		class ExoticStream {}
		const hash = getPayloadHash({
			...t.context.requestData,
			body: new ExoticStream() as any,
		});
		t.same(hash, UNSIGNED_PAYLOAD);
	});
});