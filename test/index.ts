import { test } from "tap";
process.env.AWS_ACCESS_KEY_ID = "foo";
process.env.AWS_SECRET_ACCESS_KEY = "bar";
import {signRequest} from "../src/";

test("Sign Request Worker", async (t) => {
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

	await t.test("should sign request without body", async (t) => {
		const date = new Date("2000-01-01T00:00:00.000Z");
		const request = await signRequest(t.context.requestData,"foo", "us-bar-1", date);
		t.same(request.headers["Authorization"], "AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=1e3b24fcfd7655c0c245d99ba7b6b5ca6174eab903ebfbda09ce457af062ad30");
	});


	await t.test("should sign requests with string bodies", async (t) => {
		const date = new Date("2000-01-01T00:00:00.000Z");
		const request = await signRequest({
				...t.context.requestData,
				body: "It was the best of times, it was the worst of times",
			},
			"foo",
			"us-bar-1",
			date);

		t.same(request.headers["Authorization"], "AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=cf22a0befff359388f136b158f0b1b43db7b18d2ca65ce4112bc88a16815c4b6");
	});


});