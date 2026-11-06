# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [2.0.0](https://github.com/wfalowski/bull-board-hono/compare/v1.2.1...v2.0.0) (2026-11-06)

### ⚠ BREAKING CHANGES

* Node.js 22 or newer is required (engines >=22).

* upgrade to bull-board 9, node-server 2 and Node 26, add tests to CI ([47c92c9](https://github.com/wfalowski/bull-board-hono/commit/47c92c96eaa3693e0cb2eefc2011c4acdb63dbe7))

### Bug Fixes

* **config:** treat REDIS_TLS=false as off and decode URL credentials ([2200772](https://github.com/wfalowski/bull-board-hono/commit/2200772ed750bd093a38ede64855befcb6d8a71c))
* **discovery:** remove closed queues from the board and harden scanning ([9db344a](https://github.com/wfalowski/bull-board-hono/commit/9db344a574e15b6580e66ef60cb9915b247ca734))
* **example:** define missing sleep/random helpers and add a demo producer ([a9bb300](https://github.com/wfalowski/bull-board-hono/commit/a9bb30088a9fa5849e8de1a9c236d152cc710e97))

## [1.2.1](https://github.com/wfalowski/bull-board-hono/compare/v1.2.0...v1.2.1) (2026-04-09)


### Refactoring

* separate Redis connections for scanning and queue management in QueueDiscovery ([#6](https://github.com/wfalowski/bull-board-hono/issues/6)) ([faa8d1f](https://github.com/wfalowski/bull-board-hono/commit/faa8d1fa18941fd18ffecee5e307649cadf48be8))

## [1.2.0](https://github.com/wfalowski/bull-board-hono/compare/v1.1.0...v1.2.0) (2026-04-08)


### Features

* enhance release workflow with GitHub App token generation for secure access ([#4](https://github.com/wfalowski/bull-board-hono/issues/4)) ([85fca99](https://github.com/wfalowski/bull-board-hono/commit/85fca9903798a3b1c8d76211a9741a9b9310c113))

## [1.1.0](https://github.com/wfalowski/bull-board-hono/compare/v1.0.2...v1.1.0) (2026-04-08)


### Features

* add GitHub Actions workflow for automated releases ([#3](https://github.com/wfalowski/bull-board-hono/issues/3)) ([139bf32](https://github.com/wfalowski/bull-board-hono/commit/139bf32930973f9cfdc3a02792a105db9aa8bd92))


### Bug Fixes

* update dependencies for commitizen, lodash, hono, and @hono/node-server ([#2](https://github.com/wfalowski/bull-board-hono/issues/2)) ([45758ae](https://github.com/wfalowski/bull-board-hono/commit/45758aec81cc46677f5071c09a0e6d73427991fd))


### Refactoring

* enhance Docker publish workflow with multi-platform support and digest handling ([#1](https://github.com/wfalowski/bull-board-hono/issues/1)) ([5f4eb8b](https://github.com/wfalowski/bull-board-hono/commit/5f4eb8bb655af5c58d9257d2315324ce0d053662))

## [1.0.2](https://github.com/wfalowski/bull-board-hono/compare/v1.0.1...v1.0.2) (2026-03-29)


### Bug Fixes

* push only on tags ([4b5396e](https://github.com/wfalowski/bull-board-hono/commit/4b5396ea447cfa4bf0af5af962882d2a87c26a21))

## [1.0.1](https://github.com/wfalowski/bull-board-hono/compare/v1.0.0...v1.0.1) (2026-03-29)


### Bug Fixes

* allow to use redis family ([04ef6ce](https://github.com/wfalowski/bull-board-hono/commit/04ef6ce9e1e6b6b55a4f8bb523b098b43c310414))

## 1.0.0 (2026-03-29)
