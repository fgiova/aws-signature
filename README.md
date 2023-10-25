# threaded AWS Signature V4

[![NPM version](https://img.shields.io/npm/v/@fgiova/aws-signature.svg?style=flat)](https://www.npmjs.com/package/@fgiova/aws-signature)
![CI workflow](https://github.com/fgiova/aws-signature/actions/workflows/node.js.yml/badge.svg)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Description
This module makes it easy to sign AWS requests with the Signature V4 algorithm, using a simple interface.<br/>
Each request is signed in a separate thread, so that the main thread is not blocked. <br/>
The module use lru-cache to cache the signing keys, so that the same key is not computed twice.

## Install
```bash
npm i @fgiova/aws-signature
```

### Usage
```js
const { signRequest } = require("@fgiova/aws-signature");

const signature = signRequest({
			method: "POST",
			path: "/",
			headers: {
				host: "foo.us-bar-1.amazonaws.com",
			},
			body: "Action=SendMessage&MessageBody=test&Version=2012-11-05",
		}, "sqs");
```

### API
```js
signRequest(request: Request, service: string, region?: string, date?: Date): string
```
#### Environment variables
* `AWS_ACCESS_KEY_ID` - The AWS access key ID to sign the request with.
* `AWS_SECRET_ACCESS_KEY` - The AWS secret access key to sign the request with.
* `AWS_REGION` - The AWS region to sign the request for

#### Parameters
* `request` - The request to sign. It can be a string, a buffer, or an object with the following properties:
    * `method` - The HTTP method of the request.
    * `path` - The path of the request.
    * `headers` - The headers of the request.
    * `body` - The body of the request.
    * `query` - The query string of the request.
* `service` - The AWS service to sign the request for.
* `region` - The AWS region to sign the request for. If not specified, the region will be extracted from the env AWS_REGION
* `date` - The date to sign the request for. If not specified, the date will be now

#### Returns
The signature of the request, as a string.

## License
Licensed under [MIT](./LICENSE).