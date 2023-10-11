import { test } from "tap";
import {getCanonicalQuery} from "../src/aws/getCanonicalQuery";


test("getCanonicalQuery", async (t) => {
	t.beforeEach(async (t) => {
		const requestData = {
			method: "POST",
			path: "/",
			headers: {},
		}
		t.context = {
			requestData
		};
	});
	await t.test("should return an empty string for requests with no querystring", async (t) => {
		const {requestData} = t.context;
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "");
	});
	await t.test("should serialize simple key => value pairs", async (t) => {
		const {requestData} = t.context;
		requestData.query = { fizz: "buzz", foo: "bar" };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "fizz=buzz&foo=bar");
	});
	await t.test("should sort query keys alphabetically", async (t) => {
		const {requestData} = t.context;
		requestData.query = { foo: "bar", baz: "quux", fizz: "buzz" };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "baz=quux&fizz=buzz&foo=bar");
	});
	await t.test("should URI-encode keys and values", async (t) => {
		const {requestData} = t.context;
		requestData.query = { "🐎": "🦄", "💩": "☃️" };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "%F0%9F%90%8E=%F0%9F%A6%84&%F0%9F%92%A9=%E2%98%83%EF%B8%8F");
	});
	await t.test("should omit the x-amz-signature parameter, regardless of case", async (t) => {
		const {requestData} = t.context;
		requestData.query = {
			"x-amz-signature": "foo",
			"X-Amz-Signature": "bar",
			fizz: "buzz",
		};
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "fizz=buzz");
	});
	await t.test("should serialize arrays using an alphabetic sort", async (t) => {
		const {requestData} = t.context;
		requestData.query = { snap: ["pop", "crackle"] };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "snap=crackle&snap=pop");
	});
	await t.test("should URI-encode members of query param arrays", async (t) => {
		const {requestData} = t.context;
		requestData.query = { "🐎": ["💩", "🦄"] };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "%F0%9F%90%8E=%F0%9F%92%A9&%F0%9F%90%8E=%F0%9F%A6%84");
	});
	await t.test("should sort URI-encode members of query param arrays", async (t) => {
		const {requestData} = t.context;
		requestData.query = { p: ["a", "à"] };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "p=%C3%A0&p=a");
	});
	await t.test("should omit non-string, non-array values from the serialized query", async (t) => {
		const {requestData} = t.context;
		requestData.query = { foo: "bar", baz: new Uint8Array(0) as any };
		const canonicalQuery = getCanonicalQuery(requestData);
		t.same(canonicalQuery, "foo=bar");
	});
});