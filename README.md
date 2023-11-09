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
const { Signer } = require("@fgiova/aws-signature");

const signer = new Signer();
const signature = signer.request({
			method: "POST",
			path: "/",
			headers: {
				host: "foo.us-bar-1.amazonaws.com",
			},
			body: "Action=SendMessage&MessageBody=test&Version=2012-11-05",
		}, "sqs");

// To destroy the thread pool 
signer.destroy();
```

### API
```js
Signer(options?: SignerOptions)
Signer.request(request: Request, service: string, region?: string, date?: Date): string
Signer.destroy(): Promise<void>
```
#### Environment variables
* `AWS_ACCESS_KEY_ID` - The AWS access key ID to sign the request with.
* `AWS_SECRET_ACCESS_KEY` - The AWS secret access key to sign the request with.
* `AWS_REGION` - The AWS region to sign the request for

#### Parameters
* `SignerOptions` - The options for the signer. It can have the following properties:
    * `minThreads` - Sets the minimum number of threads that are always running for this thread pool. The default is based on the number of available CPUs.
    * `maxThreads` - Sets the maximum number of threads that can be running for this thread pool. The default is based on the number of available CPUs.
    * `idleTimeout` -  A timeout in milliseconds that specifies how long a Worker is allowed to be idle, i.e. not handling any tasks, before it is shut down. By default, this is immediate.
    * `maxQueueSize` - The maximum number of tasks that may be scheduled to run, but not yet running due to lack of available threads, at a given time. By default, there is no limit. The special value 'auto' may be used to have Piscina calculate the maximum as the square of maxThreads.
    * `concurrentTasksPerWorker` - Specifies how many tasks can share a single Worker thread simultaneously. The default is 1. This generally only makes sense to specify if there is some kind of asynchronous component to the task. Keep in mind that Worker threads are generally not built for handling I/O in parallel.
    * `resourceLimits` - See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options)
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
`Signer.request` - The signature of the request, as a string.

## License
Licensed under [MIT](./LICENSE).

### Benchmark
I have made a simple benchmark using [Benchmark.js](https://benchmarkjs.com/), comparing this module with official [@smithy/signature-v4](https://www.npmjs.com/package/@smithy/signature-v4) module. <br/>
The benchmark suite is available [here](./benchmark/benchmark.js). <br/>
The benchmark results on my MacBook M1 are: <br/>

| Module                |                  |          |
|-----------------------|------------------|----------|
| @fgiova/aws-signature | 240,981 ops/sec  | ±47.91%  |
| @smithy/signature-v4  | 62,992 ops/sec   | ±61.30%  |
