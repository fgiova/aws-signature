# threaded AWS Signature V4

[![NPM version](https://img.shields.io/npm/v/@fgiova/aws-signature.svg?style=flat)](https://www.npmjs.com/package/@fgiova/aws-signature)
![CI workflow](https://github.com/fgiova/aws-signature/actions/workflows/node.js.yml/badge.svg)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![Linted with Biome](https://img.shields.io/badge/Linted_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)
[![Maintainability](https://qlty.sh/gh/fgiova/projects/aws-signature/maintainability.svg)](https://qlty.sh/gh/fgiova/projects/aws-signature)
[![Code Coverage](https://qlty.sh/gh/fgiova/projects/aws-signature/coverage.svg)](https://qlty.sh/gh/fgiova/projects/aws-signature)

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
const signedRequest = await signer.request({
			method: "POST",
			path: "/",
			headers: {
				host: "foo.us-bar-1.amazonaws.com",
			},
			body: "Action=SendMessage&MessageBody=test&Version=2012-11-05",
		}, "sqs");

// To destroy the thread pool
await signer.destroy();
```

### SignerSingleton
```js
const { SignerSingleton } = require("@fgiova/aws-signature");

const signer = SignerSingleton.getSigner();
const signedRequest = await signer.request({
  method: "POST",
  path: "/",
  headers: {
    host: "foo.us-bar-1.amazonaws.com",
  },
  body: "Action=SendMessage&MessageBody=test&Version=2012-11-05",
}, "sqs");

// Get same instance of Signer
const newSigner = SignerSingleton.getSigner();

// To destroy the thread pool and release resources
await SignerSingleton.destroy();
```

### API
```js
Signer(options?: SignerOptions)
Signer.request(request: HttpRequest, service: string, region?: string, date?: Date): Promise<HttpRequest>
Signer.destroy(): Promise<void>
SignerSingleton.getSigner(options?: SignerOptions): Signer
SignerSingleton.destroy(): Promise<void>
```
#### Environment variables
* `AWS_ACCESS_KEY_ID` - The AWS access key ID to sign the request with.
* `AWS_SECRET_ACCESS_KEY` - The AWS secret access key to sign the request with.
* `AWS_REGION` - The AWS region to sign the request for
* `AWS_SIGNATURE_USE_WORKER_THREADS` - Boolean. When set to `true`, enables the Piscina worker pool. Default `false` (single-thread signing). Overridden by the `useWorkerThreads` option when both are provided.

#### Parameters
* `SignerOptions` - The options for the signer. It can have the following properties:
    * `useWorkerThreads` - When `false` (default), signing runs synchronously on the main thread, bypassing Piscina entirely. When `true`, signing runs on a Piscina worker pool. Can also be set via `AWS_SIGNATURE_USE_WORKER_THREADS` env variable.
        * **Default `false` rationale**: benchmarks show single-thread mode is ~3.2× faster than worker mode at single-process concurrency 64 (no structured-clone thread boundary cost) with near-zero RSS baseline. Suitable for serverless (Lambda), CLI tools, and most service workloads.
        * **When to set `true`**: long-running multi-core services with sustained high signing throughput where you want CPU parallelism across signing operations. Pays a ~150–250 MB RSS baseline for the worker pool.
        * **Bench note**: at 300k signs / concurrency 64, single-thread shows RSS peak Δ near 0 MB and ~150k ops/sec; worker mode shows ~190 MB peak and ~47k ops/sec.
        * **Ignored options when `false`**: `minThreads`, `maxThreads`, `idleTimeout`, `maxQueue`, `concurrentTasksPerWorker`, `resourceLimits`, `maxTasksBeforeRecycle`, `maxPoolAgeMs`, `closeTimeout`. They have no effect because no pool is created.
    * `minThreads` - Sets the minimum number of threads that are always running for this thread pool. The default is based on the number of available CPUs.
    * `maxThreads` - Sets the maximum number of threads that can be running for this thread pool. The default is based on the number of available CPUs.
    * `idleTimeout` -  A timeout in milliseconds that specifies how long a Worker is allowed to be idle, i.e. not handling any tasks, before it is shut down. Default: `30000` (30 seconds). Set to `0` for immediate shutdown when idle.
    * `maxQueue` - The maximum number of tasks that may be scheduled to run, but not yet running due to lack of available threads, at a given time. By default, there is no limit. The special value 'auto' may be used to have Piscina calculate the maximum as the square of maxThreads.
    * `concurrentTasksPerWorker` - Specifies how many tasks can share a single Worker thread simultaneously. The default is 1. This generally only makes sense to specify if there is some kind of asynchronous component to the task. Keep in mind that Worker threads are generally not built for handling I/O in parallel.
    * `resourceLimits` - V8 heap caps applied to every worker. See [Node.js new Worker options](https://nodejs.org/api/worker_threads.html#worker_threads_new_worker_filename_options). Default: `{ maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 }` — caps each worker isolate so RSS cannot grow unbounded between recycles. Sign payloads are small (KB-range), so 128 MB old gen is generous for the workload. Override per-field via shallow merge: passing `{ maxOldGenerationSizeMb: 64 }` keeps the default young-gen cap.
    * `maxTasksBeforeRecycle` - Maximum number of completed tasks across the worker pool before the pool is recycled (gracefully drained and replaced). Mitigates V8 heap fragmentation and slow native handle leaks in long-running processes. Default: `250000`. Set to `0` or `undefined` to disable recycling.
        * **Tuning guide** (always-on services): pick a value such that recycle fires every 15–60 minutes under expected sustained sign rate (`maxTasksBeforeRecycle / signsPerSecond = secondsBetweenRecycles`). For DynamoDB-intensive workloads (1k–10k signs/s per Signer instance) consider raising to `1_000_000`–`5_000_000` to avoid pool thrash.
        * **Cost**: each recycle spawns a new pool while draining the old one (`force: false`). Brief double-memory window and ~14% throughput hit at low thresholds; cost amortizes as the threshold rises.
    * `maxPoolAgeMs` - Maximum age (in milliseconds) of the worker pool before recycle is forced, regardless of `maxTasksBeforeRecycle`. Ensures memory accumulated in long-lived workers is released even under low/intermittent traffic where the task threshold would never be reached. Default: `900000` (15 minutes). Set to `0` or `undefined` to disable age-based recycling.
    * `closeTimeout` - Timeout in milliseconds passed to Piscina's `close()` during pool recycle. Caps the double-pool window: in-flight tasks have up to `closeTimeout` to drain on the old pool, after which workers are forcibly destroyed. Default: `10000` (10 seconds). Lower values reduce RSS spike during recycle but may abort slow in-flight tasks; raise it if your workload has long-running tasks.
    * `credentials` - An object containing the AWS credentials to sign the request with. If not specified, the credentials will be extracted from the env variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION`. It can have the following properties:
        * `accessKeyId` - The AWS access key ID to sign the request with.
        * `secretAccessKey` - The AWS secret access key to sign the request with.
        * `region` - The AWS region to sign the request for.
* `request` - The request to sign (`HttpRequest`). It is an object with the following properties:
    * `method` - The HTTP method of the request.
    * `path` - The path of the request.
    * `headers` - The headers of the request.
    * `body` - The body of the request.
    * `query` - The query string of the request.
* `service` - The AWS service to sign the request for.
* `region` - The AWS region to sign the request for. If not specified, the region will be extracted from the env AWS_REGION
* `date` - The date to sign the request for. If not specified, the date will be now

#### Returns
`Signer.request` - The signed request as an `HttpRequest` object, with authorization headers added.

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
