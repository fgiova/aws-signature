import { test } from "tap";
import {createCanonicalRequest} from "../src/aws/createCanonicalRequest";
import {getCanonicalHeaders} from "../src/aws/getCanonicalHeaders";


test("createCanonicalRequest", async (t) => {
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
	await t.test("get a canonical request has no payload (body)", async (t) => {
		const canonicalRequest = createCanonicalRequest(t.context.requestData, getCanonicalHeaders(t.context.requestData));
		t.same(canonicalRequest, "POST\n" +
			"/\n" +
			"\n" +
			"host:foo.us-bar-1.amazonaws.com\n" +
			"\n" +
			"host\n" +
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
	await t.test("get a canonical request has no payload (body) s3Path", async (t) => {
		const canonicalRequest = createCanonicalRequest({
			...t.context.requestData,
			path: "//foo%3Dbar"
		}, getCanonicalHeaders(t.context.requestData), true);
		t.same(canonicalRequest, "POST\n" +
			"//foo%3Dbar\n" +
			"\n" +
			"host:foo.us-bar-1.amazonaws.com\n" +
			"\n" +
			"host\n" +
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});

	await t.test("should URI-encode the path by default", async (t) => {
		const canonicalRequest = createCanonicalRequest({
			...t.context.requestData,
			path: "/foo%3Dbar"
		}, getCanonicalHeaders(t.context.requestData));
		t.same(canonicalRequest, "POST\n" +
			"/foo%253Dbar\n" +
			"\n" +
			"host:foo.us-bar-1.amazonaws.com\n" +
			"\n" +
			"host\n" +
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});

	await t.test("should normalize relative path by default", async (t) => {
		const canonicalRequest = createCanonicalRequest({
			...t.context.requestData,
			path: "./abc/../foo%3Dbar/"
		}, getCanonicalHeaders(t.context.requestData));
		t.same(canonicalRequest, "POST\n" +
			"foo%253Dbar/\n" +
			"\n" +
			"host:foo.us-bar-1.amazonaws.com\n" +
			"\n" +
			"host\n" +
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});

	await t.test("should normalize path with consecutive slashes by default", async (t) => {
		const canonicalRequest = createCanonicalRequest({
			...t.context.requestData,
			path: "//foo%3Dbar"
		}, getCanonicalHeaders(t.context.requestData));
		t.same(canonicalRequest, "POST\n" +
			"/foo%253Dbar\n" +
			"\n" +
			"host:foo.us-bar-1.amazonaws.com\n" +
			"\n" +
			"host\n" +
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});