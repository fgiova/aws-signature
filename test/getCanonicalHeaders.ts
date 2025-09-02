import { test } from "tap";
import { ALWAYS_UNSIGNABLE_HEADERS } from "../src/aws/constants";
import { getCanonicalHeaders } from "../src/aws/getCanonicalHeaders";

test("getCanonicalHeaders", async (t) => {
	t.beforeEach(async (t) => {
		const requestData = {
			method: "POST",
			path: "/",
			headers: {
				"x-amz-user-agent": "aws-sdk-js-v3",
				host: "foo.us-east-1.amazonaws.com",
			},
		};
		t.context = {
			requestData,
		};
	});
	await t.test("should downcase all headers", async (t) => {
		const { requestData } = t.context;
		requestData.headers = {
			fOo: "bar",
			BaZ: "QUUX",
			HoSt: "foo.us-east-1.amazonaws.com",
		};
		const canonicalHeaders = getCanonicalHeaders(requestData);
		t.same(canonicalHeaders, {
			foo: "bar",
			baz: "QUUX",
			host: "foo.us-east-1.amazonaws.com",
		});
	});
	await t.test("should remove all unsignable headers", async (t) => {
		const { requestData } = t.context;
		requestData.headers = {
			...requestData.headers,
			foo: "bar",
		};
		for (const headerName of Object.keys(ALWAYS_UNSIGNABLE_HEADERS)) {
			requestData.headers[headerName] = "baz";
		}
		const canonicalHeaders = getCanonicalHeaders(requestData);
		t.same(canonicalHeaders, {
			"x-amz-user-agent": "aws-sdk-js-v3",
			host: "foo.us-east-1.amazonaws.com",
			foo: "bar",
		});
	});
	await t.test("should ignore headers with undefined values", async (t) => {
		const { requestData } = t.context;
		requestData.headers = {
			...requestData.headers,
			foo: undefined,
			bar: null,
		};
		const canonicalHeaders = getCanonicalHeaders(requestData);
		t.same(canonicalHeaders, {
			"x-amz-user-agent": "aws-sdk-js-v3",
			host: "foo.us-east-1.amazonaws.com",
		});
	});
	await t.test("should ignore headers with undefined values", async (t) => {
		const { requestData } = t.context;
		requestData.headers = {
			...requestData.headers,
			foo: "bar",
			"user-agent": "foo-user",
		};
		const canonicalHeaders = getCanonicalHeaders(requestData, new Set(["foo"]));
		t.same(canonicalHeaders, {
			host: "foo.us-east-1.amazonaws.com",
			"x-amz-user-agent": "aws-sdk-js-v3",
		});
	});
	await t.test(
		"should allow specifying custom signable headers that override unsignable ones",
		async (t) => {
			const { requestData } = t.context;
			requestData.headers = {
				...requestData.headers,
				foo: "bar",
				"user-agent": "foo-user",
			};
			const canonicalHeaders = getCanonicalHeaders(
				requestData,
				new Set(["foo"]),
				new Set(["foo", "user-agent"]),
			);
			t.same(canonicalHeaders, {
				host: "foo.us-east-1.amazonaws.com",
				"x-amz-user-agent": "aws-sdk-js-v3",
				foo: "bar",
				"user-agent": "foo-user",
			});
		},
	);
});
