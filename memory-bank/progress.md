# 题匣 (Quarry) 研发进度与里程碑看板

> **基准依据**：`AGENTS.md`、`memory-bank/architecture.md`、`memory-bank/design-document.md`  
> **版本日志说明**：日常细粒度变更记录与正式发版 `CHANGELOG.md` 由 `release-please` 基于 Conventional Commits 自动维护；本看板记录工程级里程碑与重大架构决策。

---

## 1. 里程碑概览 (Milestones Overview)

| 阶段 / 事项 | 描述 | 状态 | 核心交付成果 |
| :--- | :--- | :---: | :--- |
| **Phase 0** | **工程骨架与基础设施** | 🟢 已完成 | pnpm Monorepo + Turborepo 初始化；`packages/shared` Zod 契约；`packages/core` 纯函数领域核心（100% 覆盖率）；`packages/database` Kysely/SQLite WAL 仓储；`packages/server` Hono 骨架 |
| **Phase 1 & 1.5** | **后端核心业务 API 与契约补齐** | 🟢 已完成 | 文件夹/题库/套题/6 题型 CRUD、双标签隔离、附件 SHA-256 虚拟存储、来源跟随预览/应用、练习草稿与显式结束、考试交卷、错题本多维筛选、文件夹 `.quarry` 导出、一票否决导入与带恢复点回滚备份 |
| **Phase 2 & 6** | **Electron 桌面宿主与 Windows 打包** | 🟢 已完成 | 随机端口本地 Hono 守护进程、沙箱化单值 `preload`、Windows x64 NSIS/ZIP 分发配置、自动化双 ABI `better-sqlite3` 切换 |
| **Phase 3–5** | **正式 React 19 前端交付** | 🟢 已完成 | React 19 + Vite 生产应用、多标签工作区、KaTeX 公式分块加载、资料库/编排/练习（45/55 分栏）/考试（防提前泄露）/错题复习组卷/学习看板热力图/设置/回收站，与真实 Hono/SQLite 联调通过 |
| **Issue #5** | **Quarry CLI 与题目转换 Skill** | 🟢 已完成 | `packages/shared` Portable Schema、`packages/cli`（`spec`/`validate`/`convert`）、`skills/question-converter/SKILL.md` |
| **工程治理** | **仓库清理、文档收敛与自动化流水线** | 🟢 进行中 | 清理历史原型与重复大文件、归档过时文档、收敛 `AGENTS.md`/`memory-bank`、建立双平台 CI、PR 标题门禁、`release-please` 动态发版与 Windows Release 自动打包 |

---

## 2. 关键架构决策记录 (Architecture Decisions)

| 决策 ID | 事项说明 | 决策结果 | 状态 |
| :--- | :--- | :--- | :---: |
| **DEC-001** | 前后端解耦 | 前端完全不使用 Electron IPC，只通过 `BackendClient` 面向标准 HTTP REST 通信 | ✅ 已敲定 |
| **DEC-002** | 数据库抽象 | 排除 Prisma，采用 Kysely + `better-sqlite3`（WAL + 外键）；业务层仅依赖 Repository 接口 | ✅ 已敲定 |
| **DEC-003** | 附件虚拟化 | 本地按 SHA-256 哈希防重存储，对外仅暴露 `/api/attachments/:id` 虚拟 URL | ✅ 已敲定 |
| **DEC-004** | 选项身份绑定 | 选项使用稳定 UUID 标识，答案绑定选项 ID；打乱仅改变展示顺序与 A/B/C/D 映射 | ✅ 已敲定 |
| **DEC-005** | 自动化发版与产物规范 | 采用 `release-please` Manifest 模式统一同步 Monorepo 全包版本号，Tag 不带 `v` 前缀；Windows 发版产物以英文 `Quarry-*` 命名并附带逐文件 `.sha256` 校验文件 | ✅ 已敲定 |
