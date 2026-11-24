# 题匣 (Quarry) AI 开发与协作规范

## 1. 必读规范与文档边界

编写任何代码或修改配置前，必须先了解以下现行规范文件：
- 产品需求与领域规则：[memory-bank/design-document.md](memory-bank/design-document.md)
- 系统架构、模块契约与技术栈：[memory-bank/architecture.md](memory-bank/architecture.md)
- 前端视觉令牌与组件规则：[memory-bank/visual-system.md](memory-bank/visual-system.md)
- 研发里程碑记录：[memory-bank/progress.md](memory-bank/progress.md)
- Git 与 PR 协作规范：[CONTRIBUTING.md](CONTRIBUTING.md)

> **严禁把 `docs/archive/` 作为当前依据**：`docs/archive/` 中存放的是早期规划与过渡期交接存档，包含已弃用的技术选型与过时描述，**禁止**将其中内容当作现行规范读取或执行。

---

## 2. 当前技术栈与工程快照

采用 **pnpm 10 Workspaces + Turborepo 2 + TypeScript 5.9 + Vitest 3** Monorepo：
- `apps/desktop`：Electron 45 桌面宿主 + esbuild 运行时打包 + `better-sqlite3` 双 ABI 自动切换；仅负责窗口托管与本地 loopback HTTP 服务拉起
- `apps/web`：React 19 + Vite 6 + `react-markdown` + `remark-math` + `rehype-katex` + KaTeX + 自研 `visual.css` / `production.css`（纯 Web 前端，无 Electron 专有依赖）
- `packages/shared`：Zod 4 Schema、枚举、DTO、统一 `AppError`、Portable Document 契约
- `packages/core`：纯函数领域核心（6 题型判分、带种子打乱、跨午夜切分；零 I/O，**100% 单元测试覆盖率强制阈值**）
- `packages/database`：Kysely + `better-sqlite3`（SQLite WAL 模式 + 外键约束 + Repository 仓储接口与快照适配器）
- `packages/server`：Hono Node.js RESTful API + 虚拟化 SHA-256 附件存储 + 导入导出/备份回滚引擎
- `packages/cli`：Quarry CLI（`quarry spec|validate|convert`），轻量 Markdown 题目 DSL 与 JSON/Markdown 导入转换
- `skills/question-converter`：题目转换 Agent Skill

### 必跑本地验证命令
```bash
pnpm run lint   # 全仓 TypeScript 类型检查
pnpm run test   # 全仓单元测试与集成测试（含 core 100% 覆盖率校验）
pnpm run build  # 全仓产物构建
```

---

## 3. 四道架构解耦防线与代码质量

1. **界面与宿主解耦**：`apps/web` 为纯粹标准 Web 应用，严禁引入 Electron 专有模块（如 `ipcRenderer`、`remote`）。
2. **通信契约解耦**：前端统一通过 `apps/web/src/api/client.ts`（`BackendClient`）发起 HTTP REST 请求，不直接接触数据库或 IPC。
3. **业务与数据库解耦**：`packages/server` 只依赖 `packages/database` 暴露的仓储接口（Repository Interface），禁止在业务层直接依赖数据库驱动或写原生 SQL 绕过仓储。
4. **附件与文件系统解耦**：附件统一由 `IAttachmentStorage` 管理，前端仅通过 `/api/attachments/:id` 虚拟 URL 访问，不感知本机绝对路径。
5. **代码质量**：功能解耦、减少交叉引用、统一命名与格式、不重复实现已有契约/工具；注释解释“为什么”而非“做什么”。

---

## 4. 交互与执行要求

- **中立客观**：每次对话时都要思考用户所述是否正确、完备；若存在漏洞、风险或前提缺失，应明确指出并继续讨论。
- **先确认再大改**：需求或方案完善后，确认用户意图是继续讨论还是立即执行；执行重大变更前需给出完整说明并由用户确认。
- **执行者模型询问**：**具体执行时应当询问用户是否需要调用 GPT 模型（`codex / gpt-6.2-sol`）作为执行者**。

---

## 5. Git、PR 与 T3 Code 自动化纪律

所有代码与文档修改均严格遵循 [CONTRIBUTING.md](CONTRIBUTING.md)：
1. **分支与 Worktree 隔离**：严禁直接向 `main` 分支执行 `git push`。每个独立任务在独立的 Git Worktree / 特性分支（`<type>/<desc>`）上开发。
2. **Conventional Commits**：提交信息与 PR 标题统一遵循 `<type>(<scope>): <subject>`（`feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`chore`、`ci`）。正式版本 Tag 与发布产物不带 `v` 前缀（如 `0.2.0`）。
3. **PR 内强制联动文档**：只要改动涉及**新增/变更功能、命令或脚本变化、目录/架构调整、数据契约变动**，必须在**同一个 PR** 内同步检查并更新：
   - [README.md](README.md)
   - [memory-bank/architecture.md](memory-bank/architecture.md)
   - [memory-bank/progress.md](memory-bank/progress.md)
   纯内部重构或修错未涉及上述范围时，在 PR 描述中注明“无需更新文档”。
4. **T3 Code PR 闭环**：推送并提交 PR 后，使用 `link_pull_request` 关联当前线程；必要时启动独立 Review 子 Agent 预审或生成 PR Guide，并开启 `watch_pull_request` 值守直到 CI 检查全绿，交由用户确认 Squash Merge。
