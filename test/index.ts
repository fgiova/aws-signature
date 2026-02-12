import { test } from "tap";

process.env.AWS_ACCESS_KEY_ID = "foo";
process.env.AWS_SECRET_ACCESS_KEY = "bar";

import { Signer, SignerSingleton } from "../src/";

test("Sign Request Worker", async (t) => {
	t.beforeEach(async (t) => {
		const requestData = {
			method: "POST",
			path: "/",
			headers: {
				host: "foo.us-bar-1.amazonaws.com",
			},
		};
		t.context = {
			requestData,
		};
	});

	await t.test("should sign request without body", async (t) => {
		const signer = new Signer();
		try {
			const date = new Date("2000-01-01T00:00:00.000Z");
			const request = await signer.request(
				t.context.requestData,
				"foo",
				"us-bar-1",
				date,
			);
			t.same(
				// biome-ignore lint/complexity/useLiteralKeys: leave as is
				request.headers?.["Authorization"],
				"AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=1e3b24fcfd7655c0c245d99ba7b6b5ca6174eab903ebfbda09ce457af062ad30",
			);
		} catch (error) {
			console.log(error);
		} finally {
			await signer.destroy();
		}
	});

	await t.test("should sign requests with string bodies", async (t) => {
		const date = new Date("2000-01-01T00:00:00.000Z");
		const signer = new Signer();
		const request = await signer.request(
			{
				...t.context.requestData,
				body: "It was the best of times, it was the worst of times",
			},
			"foo",
			"us-bar-1",
			date,
		);

		t.same(
			// biome-ignore lint/complexity/useLiteralKeys: leave as is
			request.headers?.["Authorization"],
			"AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=cf22a0befff359388f136b158f0b1b43db7b18d2ca65ce4112bc88a16815c4b6",
		);
		await signer.destroy();
	});

	await t.test(
		"should sign requests with string bodies without cache",
		async (t) => {
			const date = new Date("2000-01-01T00:00:00.000Z");
			const signer = new Signer();
			const request = await signer.request(
				{
					...t.context.requestData,
					body: "It was the best of times, it was the worst of times",
				},
				"foo-test-2",
				"us-bar-1",
				date,
			);

			t.same(
				// biome-ignore lint/complexity/useLiteralKeys: leave as is
				request.headers?.["Authorization"],
				"AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo-test-2/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=1becd5fd94ce1e82b68d98fa70a9c99b4b4668eec909cf2f41f482426ac44970",
			);
			await signer.destroy();
		},
	);

	await t.test("destroy workers", async (t) => {
		const signer = new Signer();
		await t.resolves(signer.destroy());
	});

	await t.test("signer instance", async (t) => {
		const signer = SignerSingleton.getSigner();
		const date = new Date("2000-01-01T00:00:00.000Z");
		const request = await signer.request(
			t.context.requestData,
			"foo",
			"us-bar-1",
			date,
		);
		t.same(
			// biome-ignore lint/complexity/useLiteralKeys: leave as is
			request.headers?.["Authorization"],
			"AWS4-HMAC-SHA256 Credential=foo/20000101/us-bar-1/foo/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=1e3b24fcfd7655c0c245d99ba7b6b5ca6174eab903ebfbda09ce457af062ad30",
		);
		const { SignerSingleton: SignerSingletonTwo } = require("../src/index");
		const sameSigner = SignerSingletonTwo.getSigner();
		t.equal(signer, sameSigner);
		await SignerSingleton.destroy();
	});
});
