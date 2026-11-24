# 历史归档文档索引 (Documentation Archive)

本目录存放项目早期设计探索、阶段交接及已收敛合并的子包说明文档，仅作历史溯源留档。

> [!CAUTION]
> **AI Agent 禁止读取警示**  
> 本目录中的任何文件均**不代表当前有效规范、技术栈或 API 契约**。AI Agent 在开发、审查或规划任务时，**严禁**将 `docs/archive/` 下的内容作为当前需求或实现依据。  
> 当前唯一权威规范请阅读根目录 [`AGENTS.md`](../../AGENTS.md)、[`README.md`](../../README.md)、[`CONTRIBUTING.md`](../../CONTRIBUTING.md) 及 [`memory-bank/`](../../memory-bank/)。

## 归档清单

| 归档文件 | 原位置 | 归档原因与替代去向 |
| :--- | :--- | :--- |
| `tech-stack.md` | `memory-bank/tech-stack.md` | 早期规划曾列出未最终采纳的前端库（如 `shadcn/ui`、`Zustand`）；真实技术栈已整合至 `memory-bank/architecture.md` |
| `implementation-plan.md` | `memory-bank/implementation-plan.md` | 首版研发前拆解计划，Phase 0–6 已落地完成；现行状态见 `memory-bank/progress.md` |
| `backend-handoff.md` | `memory-bank/Codex/backend-handoff.md` | 2026-11-10 前后端合龙前交接记录；已实施契约与剩余边界已并入 `memory-bank/architecture.md` |
| `frontend-current-spec.md` | `memory-bank/Codex/frontend-current-spec.md` | 原型定稿期前端基线；有效交互规则已并入 `memory-bank/design-document.md` 与 `memory-bank/visual-system.md` |
| `frontend-design-history.md` | `memory-bank/Codex/frontend-design-history.md` | 原型阶段逐日批注历史流水账，已被正式版替代 |
| `web-README.md` | `apps/web/README.md` | 运行时说明已收敛至根 `README.md` 与 `memory-bank/architecture.md` |
| `desktop-README.md` | `apps/desktop/README.md` | 桌面宿主与打包架构已收敛至根 `README.md` 与 `memory-bank/architecture.md` |
| `server-README.md` | `packages/server/README.md` | 后端接口说明已收敛至 `memory-bank/architecture.md` |
