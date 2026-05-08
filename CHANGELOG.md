# [5.0.0](https://github.com/fgiova/aws-signature/compare/4.2.0...5.0.0) (2026-05-08)


* feat!: default to single-thread signing, opt-in worker pool ([09c4183](https://github.com/fgiova/aws-signature/commit/09c4183b2ba8de818071d0b875715dfcde638ef5))


### Features

* bound recycle window and add age-based pool rotation ([50c649c](https://github.com/fgiova/aws-signature/commit/50c649c167f5f5231912a9a32a0fbd62ecd0e799))


### Performance Improvements

* replace ts-node with native Node strip-types in workers ([cea802c](https://github.com/fgiova/aws-signature/commit/cea802cfb015d530d79a3ebe4dc7755337713e7b))


### BREAKING CHANGES

* `new Signer()` now signs on the main thread by default.
To restore the previous worker-pool behavior, pass
`new Signer({ useWorkerThreads: true })` or set the
`USE_WORKER_THREADS=true` env variable.

- Add `SignerOptions.useWorkerThreads` (default `false`) and
  `USE_WORKER_THREADS` env var (read via env-schema).
- When `false`, skip Piscina entirely: import and call `generateKey` /
  `signRequest` from `sign_worker` directly. All worker-only options
  (`minThreads`, `maxThreads`, `idleTimeout`, `maxQueue`,
  `concurrentTasksPerWorker`, `resourceLimits`, `maxTasksBeforeRecycle`,
  `maxPoolAgeMs`, `closeTimeout`) are ignored, and `destroy()` resolves
  immediately without closing a pool.
- Add a default `resourceLimits` cap of `{ maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 16 }` for worker mode, with shallow merge so
  callers can override individual fields. Bounds RSS growth between
  recycles (~−20 MB peak in benchmarks) and acts as a safety net against
  runaway allocations.
- Test parity case forces `useWorkerThreads: true` for the worker
  signer so it remains a real worker-vs-single-thread comparison after
  the default flip.
- Benchmark `volume.js` / `run-volume.js` add a
  `fgiova-single-thread` scenario, and the worker-mode scenarios
  explicitly set `useWorkerThreads: true` so the table compares like
  with like.
- README documents the new default, the env var, the tradeoffs, and the
  measured numbers.

# [4.2.0](https://github.com/fgiova/aws-signature/compare/4.1.0...4.2.0) (2026-05-07)


### Features

* default maxTasksBeforeRecycle to 250000 ([430a01a](https://github.com/fgiova/aws-signature/commit/430a01acab7d7f1551bc021fccaf4a81ebf2cf3a))

# [4.1.0](https://github.com/fgiova/aws-signature/compare/4.0.0...4.1.0) (2026-05-07)


### Features

* reduce RSS under sustained load ([dc4eaec](https://github.com/fgiova/aws-signature/commit/dc4eaecd266329ad87cc5eaa00a8073b7c37c716))

# [4.0.0](https://github.com/fgiova/aws-signature/compare/3.2.0...4.0.0) (2026-02-12)


### Features

* add destroy methods and fix benchmark abort error ([6792a2a](https://github.com/fgiova/aws-signature/commit/6792a2ab8846bc00d4d0050cda0a637ea2e2851e))

# [3.2.0](https://github.com/fgiova/aws-signature/compare/3.1.2...3.2.0) (2025-09-07)


### Features

* Add option on constructor for aws credentials ([9320882](https://github.com/fgiova/aws-signature/commit/9320882c54594239d926dc9398e36ab2420aede8))

## [3.1.2](https://github.com/fgiova/aws-signature/compare/3.1.1...3.1.2) (2025-09-03)


### Bug Fixes

* fix mjs worker ([2a40544](https://github.com/fgiova/aws-signature/commit/2a40544be65c141e9f17f79a66d815a283c1ca5d))

## [3.1.1](https://github.com/fgiova/aws-signature/compare/3.1.0...3.1.1) (2025-09-03)


### Bug Fixes

* fix cjs exports ([83be20e](https://github.com/fgiova/aws-signature/commit/83be20e18caeed0a70511b6c7c6f827da9761b66))

# [3.1.0](https://github.com/fgiova/aws-signature/compare/3.0.0...3.1.0) (2025-09-02)


### Features

* update dependencies ([273b607](https://github.com/fgiova/aws-signature/commit/273b6072d2036d1bd143b7e77a7670c2c1597fe3))

# [3.0.0](https://github.com/fgiova/aws-signature/compare/2.1.0...3.0.0) (2025-03-11)


### Features

* Add ESM export ([043cc22](https://github.com/fgiova/aws-signature/commit/043cc227024c6644caf582eec2818b1b86da29cd))

# [2.1.0](https://github.com/fgiova/aws-signature/compare/2.0.0...2.1.0) (2023-12-29)


### Features

* add signature singleton ([135e76e](https://github.com/fgiova/aws-signature/commit/135e76e74a24f2c326fd400595dac1d627d81587))

# [2.0.0](https://github.com/fgiova/aws-signature/compare/1.0.0...2.0.0) (2023-10-29)

# 1.0.0 (2023-10-25)


### Features

* release ([1615234](https://github.com/fgiova/aws-signature/commit/16152340f869b281245508d1ad8de7ca5004386f))
