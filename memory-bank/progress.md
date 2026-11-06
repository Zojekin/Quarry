# 题匣 (Quarry) 研发进度与里程碑看板 (Progress Tracking)

> **当前版本**：v0.1.0-alpha  
> **基准依据**：`memory-bank/design-document.md`、`memory-bank/tech-stack.md`、`memory-bank/architecture.md`、`memory-bank/implementation-plan.md`  
> **当前状态**：Phase 0 准备就绪，基础设施与骨架搭建阶段

---

## 1. 里程碑概览与当前状态 (Milestones Overview)

| 阶段 (Phase) | 描述 | 状态 | 负责人 / 引擎 | 备注 |
| :--- | :--- | :---: | :--- | :--- |
| **Phase 0** | **工程骨架与基础基础设施** | 🟢 已完成 | Codex CLI / 主智能体调度 | Monorepo 初始化、纯函数判分与打乱、SQLite 仓储、Hono 服务骨架全部闭环 |
| **Phase 1** | **后端核心业务 API 与数据安全** | ⚪ 未开始 | Codex CLI | 内容管理、两套标签、会话判分、错题本、备份还原 |
| **Phase 2** | **Electron 桌面宿主与后端编排** | ⚪ 未开始 | Codex CLI | electron-vite、随机端口后端托管、生命周期 |
| **Phase 3** | **前端框架与通用交互基础** | ⚪ 未开始 | Codex CLI | React 19 + shadcn/ui、BackendClient、Markdown/KaTeX、文件管理器布局 |
| **Phase 4** | **内容管理与套题编排工作台** | ⚪ 未开始 | Codex CLI | 6 题型编辑、@dnd-kit 分区与固定组编排、导入严格校验 |
| **Phase 5** | **答题引擎、错题复习与看板** | ⚪ 未开始 | Codex CLI | 练习/考试模式、@tanstack/react-virtual 虚拟滚动、计时遮罩、热力图 |
| **Phase 6** | **集成验收、打包分发与文档更新** | ⚪ 未开始 | Codex CLI / 主智能体 | Windows x64 安装包、离线验证、最终架构与进度同步 |

*图例说明：⚪ 未开始 ｜ 🟡 进行中 ｜ 🟢 已完成 ｜ 🔴 阻塞/待决策*

---

## 2. 详细任务分解状态 (Phase 0 细化)

### Phase 0: 工程骨架与基础基础设施建设
- [x] **Task 0.1: pnpm Monorepo 与构建工程初始化**
  - [x] 根目录 `package.json`、`pnpm-workspace.yaml`、`turbo.json` 配置
  - [x] 共享 TypeScript 严格配置 (`tsconfig.base.json`) 与 Vitest 配置
  - [x] 全部 6 个工作区包初始化与链接验证
- [x] **Task 0.2: `packages/shared` 共享类型、DTO 与 Zod 契约**
  - [x] 6 大题型结构定义与 Zod Schema
  - [x] 文件标签 vs 题目标签枚举与类型隔离
  - [x] 统一应用错误枚举与响应模型
  - [x] 文件、套题分区与打乱、共用材料、学习会话/作答/错题快照契约及输入 DTO
  - [x] 32 项 Vitest 测试通过；`npx pnpm --filter @quarry/shared test` 与 `build` 验证通过（2026-11-06）
- [x] **Task 0.3: `packages/core` 纯函数领域核心实现 (TDD)**
  - [x] 单选/多选/不定项判分纯函数（完全匹配、少选比例得分）
  - [x] 严格填空逐字符匹配纯函数（支持多空、每空多答案、全半角严格）
  - [x] 非严格填空与主观题未判分状态处理
  - [x] 带种子 Fisher-Yates 算法、选项打乱（identity 绑定）、分区与固定组编排打乱
  - [x] 跨午夜计时时间段自然日切分
  - [x] Vitest 单元测试覆盖率达 100%
- [x] **Task 0.4: `packages/database` Kysely 仓储与 SQLite 适配器**
  - [x] Kysely 数据库 Schema 定义与迁移脚本（启用 WAL 与外键约束）
  - [x] Repository 仓储接口定义 (`IFolderRepository`, `IQuestionRepository` 等)
  - [x] 基于 `better-sqlite3` 实现 SQLite 仓储适配器
  - [x] 内存 SQLite 仓储 CRUD 与事务回滚测试
- [x] **Task 0.5: `packages/server` Hono 路由骨架与中间件基础**
  - [x] Hono 实例与全局错误处理中间件
  - [x] 依赖注入仓储实例
  - [x] 健康检查 API 与 Hono RPC Client 连通性测试

---

## 3. 阻塞项与技术决策记录 (Decisions & Blockers)

| 决策 ID | 事项说明 | 决策结果 | 状态 |
| :--- | :--- | :--- | :---: |
| **DEC-001** | 前后端解耦与独立性 | 前端完全不使用 Electron IPC，只通过统一 `BackendClient` 面向标准 HTTP REST / Hono RPC 通信 | ✅ 已敲定 |
| **DEC-002** | 数据库选型与仓储隔离 | 排除 Prisma，采用 Kysely + `better-sqlite3`，业务层仅依赖抽象接口，未来可无缝切换 Postgres | ✅ 已敲定 |
| **DEC-003** | 附件存储虚拟化 | 本地按 SHA-256 哈希防重存储，对外仅提供虚拟资源 URL，前端不暴露绝对物理路径 | ✅ 已敲定 |
| **DEC-004** | 选项与打乱机制 | 选项生成唯一 UUID 标识，答案绑定选项 ID，打乱仅改变呈现顺序与字母映射 | ✅ 已敲定 |

---
*更新时间：2026-11-06*

## Core domain milestone (2026-11-06)

- Task 0.3 complete using a red/green TDD cycle: six question scoring variants, seeded Fisher-Yates option/section/merged-section shuffling, atomic fixed groups and ordered shared material children, and timezone-aware proportional calendar duration splitting.
- Core tests: 16 passed; V8 statements, branches, functions and lines all 100%, with enforced thresholds. Includes empty/wrong/partial answers, duplicate selections, fractional scoring, exact text sensitivity, deterministic seeds, anchored materials, multiple dates and DST short/long days.
- Validation: `npx pnpm --filter @quarry/core test` passed; `npx pnpm build` passed for all 6 packages.


## Database persistence milestone (2026-11-06)

- Task 0.4 complete: eleven-table Kysely schema, versioned transactional migration, eight repository interfaces, better-sqlite3 adapters, factory lifecycle and transaction-bound repository execution.
- Added foreign keys, WAL configuration, ownership/JSON/enum constraints, dual tag namespace and target validation, attempt deduplication, versioned mistake uniqueness and attachment hash deduplication.
- `npx pnpm --filter @quarry/database test`: 11 integration tests passed. In-memory SQLite tests cover CRUD, commit/rollback, constraints, tags, paper items, learning records, mistakes and attachments. A temporary file test confirms WAL and persistence across reopen; pure memory SQLite uses its native memory journal.
- `npx pnpm build`: all six workspace packages passed.

## Server framework milestone (2026-11-06)

- Task 0.5 complete: `createQuarryServer` composes a standard Hono app with injected repositories and optional attachment directory, local-origin CORS, global application/unknown error handling and standard 404 responses.
- `/api/health` verifies the supplied database connection before returning version, timestamp and connection status. The public `AppType` preserves the route schema for typed Hono RPC clients.
- `npx pnpm --filter @quarry/server test`: 12 integration tests passed using in-memory SQLite, including typed RPC health, database failure, application/unknown errors, not-found responses, dependency injection and CORS.
- `npx pnpm build` and `npx pnpm test` passed across the monorepo (71 tests; unchanged tasks may use Turbo cache).

## Phase 1 Batch A milestone (2026-11-06)

- Tasks 1.1-1.3 implemented: attachment upload/streaming with SHA-256 deduplication and replaceable storage; folder tree CRUD/cycle protection/subtree soft deletion; bank and six-variant question CRUD with search, filters, material relationships and strict dual tag isolation.
- Paper CRUD and composition persist sections, ordered fixed groups, merged/per-section/option/material shuffle flags and source snapshots. Inline questions and existing bank questions are supported. Material children remain together and preserve relative order. Removing items repairs fixed groups.
- Source-follow preview includes stem/options/answers/analysis/material/tags. Enabled application preserves selection, ordering, scores and scoring rules; missing sources retain their snapshots with invalid flags. Following is off by default, and repeated unchanged application is idempotent. Type-changing source edits require recomposition before following.
- Added a backward-compatible database migration for composer JSON/material text and a repository item-update operation. Content writes use transaction-bound repositories; custom adapters inject their own transaction runner. API conventions and injection requirements are documented in `packages/server/README.md`.
- Validation: `npx pnpm --filter @quarry/server test` passes 36 tests (24 new); `npx pnpm test` passes 95 tests across the workspace; `npx pnpm build` passes all six packages. Unchanged tasks may use Turbo cache.
- Batch A is complete. Session/scoring APIs, mistakes/analytics, import/export, backups/restoration and recycle-bin administration remain later Phase 1 work.
