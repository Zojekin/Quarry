# Changelog

## [0.3.0](https://github.com/Zojekin/Quarry/compare/0.2.1...0.3.0) (2026-11-24)


### Features

* **desktop:** 还原桌面端视觉与图标、修复前后端缺陷并建立 Playwright E2E 与视觉回归门禁 ([#13](https://github.com/Zojekin/Quarry/issues/13)) ([055d9fb](https://github.com/Zojekin/Quarry/commit/055d9fb8f37003c971b261883c7b2319ee5b0777))

## [0.2.1](https://github.com/Zojekin/Quarry/compare/0.2.0...0.2.1) (2026-11-24)


### Bug Fixes

* **desktop:** 升级 better-sqlite3 至 N-API v13 修复启动错配、还原图标原色并精简发版流水线 ([#11](https://github.com/Zojekin/Quarry/issues/11)) ([ec3ce87](https://github.com/Zojekin/Quarry/commit/ec3ce87e83f51890c75ebe6e6cb7791b621f5c82))

## [0.2.0](https://github.com/Zojekin/Quarry/compare/0.1.0...0.2.0) (2026-11-24)


### Features

* **cli:** 实现轻量 Markdown 题目 DSL、Quarry CLI 与转换 Skill ([#5](https://github.com/Zojekin/Quarry/issues/5)) ([#6](https://github.com/Zojekin/Quarry/issues/6)) ([5520131](https://github.com/Zojekin/Quarry/commit/55201316bd5072ddac43b738f95bf25a47202422))
* **core:** implement pure domain algorithms for scoring, shuffling and timing with 100% test coverage ([c16983b](https://github.com/Zojekin/Quarry/commit/c16983b301d2b293ac9d46485f65bb72d60636bc))
* **database:** implement Kysely schema, migrations, repository interfaces and SQLite adapter ([d6a846c](https://github.com/Zojekin/Quarry/commit/d6a846c5ab498d5aad0c828a4a923a3cf8167917))
* **desktop:** implement Electron host, local backend manager, secure preload and electron-builder packaging config ([53b0048](https://github.com/Zojekin/Quarry/commit/53b0048d07afac8ce9b0ac462c50a64582108e63))
* **desktop:** 完善 Windows 应用打包配置、向导安装体验与自动化原生 ABI 管理 ([f0cb79e](https://github.com/Zojekin/Quarry/commit/f0cb79e5fb8231d33984726c6c6d98ad76fad2cc))
* **infra:** initialize 6-package pnpm monorepo with turborepo and typescript ([523f8d0](https://github.com/Zojekin/Quarry/commit/523f8d02bf7c5f10a31349b309df9de4875aba15))
* **server:** complete Phase 1.5 backend gap closures (session drafts, practice completion, tag colors, mistake projections and folder export) ([eb6179e](https://github.com/Zojekin/Quarry/commit/eb6179e865e0c819fe6f012386d349cae89d75c5))
* **server:** implement Hono server factory, CORS, global error handling and health route ([95c9592](https://github.com/Zojekin/Quarry/commit/95c95929769c08656310d67c7a73614053d22b05))
* **server:** implement Phase 1 Batch A (attachments, folders, banks, questions, tags, papers, source-following) ([adfcb14](https://github.com/Zojekin/Quarry/commit/adfcb14c0b62ea70bee87a76bbb83c10da526a1a))
* **server:** implement Phase 1 Batch B (sessions, mistakes, analytics, strict import-export, backups with rollback, trash) ([ef9d158](https://github.com/Zojekin/Quarry/commit/ef9d1588a4baa3b1610bcc4e99049dc26d38658f))
* **shared:** implement domain schemas, enums, DTOs, AppError and 32 contract tests ([8e2030b](https://github.com/Zojekin/Quarry/commit/8e2030bb6153fd656e5c071c61293e1d0b54080d))
* **web:** implement production React 19 web app with full BackendClient integration and KaTeX math ([1275f0e](https://github.com/Zojekin/Quarry/commit/1275f0e9ffee0426052ca2a17de8663f0af02ce9))


### Bug Fixes

* **desktop:** 限制 SQLite ABI 脚本仅在 Windows 下执行，修复 Linux CI 环境 invalid ELF 报错 ([#3](https://github.com/Zojekin/Quarry/issues/3)) ([9ec6ab0](https://github.com/Zojekin/Quarry/commit/9ec6ab0fb07e22740279de9b9573eca2d018cdb7))


### Miscellaneous Chores

* **release:** 准备 0.2.0 首个正式发行版 ([#9](https://github.com/Zojekin/Quarry/issues/9)) ([17b2594](https://github.com/Zojekin/Quarry/commit/17b259445d1d56cdd0eb027e0d4f057dada13c45))
