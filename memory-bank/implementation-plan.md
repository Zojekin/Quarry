# 题匣 (Quarry) 研发实施计划 (Implementation Plan)

## 当前接手任务（2026-11-10）

先执行 [backend-handoff.md](backend-handoff.md)，界面要求以 [frontend-current-spec.md](frontend-current-spec.md) 为准。下方Phase表是原始规划，不代表完成状态，不从Phase0重做。优先补会话草稿/结束/时间与幂等，再统一筛选契约，补标签颜色和文件夹导出，最后接正式前端。每项先复用已有服务并新增有意义的契约/集成测试。

正式前端仍未接API，原型不等于Phase3—5生产交付完成。下方React/shadcn、抽屉等旧前端方案不约束本轮原型；正式技术栈另行定稿。后端分层、快照、判分和数据安全约束保持有效。

> **版本**：v1.0.0  
> **状态**：Draft Ready for Execution  
> **基准依据**：`memory-bank/design-document.md`、`memory-bank/tech-stack.md`、`AGENTS.md`  
> **目标定位**：首版 Windows 桌面离线题库与套题管理、答题及错题复习软件（支持未来平滑演进至自托管服务器）

---

## 1. 项目范围与架构设计防线

### 1.1 首版范围边界 (Scope Boundary)

- **交付范围内 (In-Scope)**：
  - 6 大题型：单选、多选、不定项选择、严格填空、非严格填空、主观题。
  - 富文本渲染：Markdown、LaTeX 数学公式 (KaTeX)、代码高亮 (Prism)、表格、本地图片附件。
  - 内容组织：多层文件夹、题库、套题（固定选题）、两套完全独立标签系统（文件标签 vs 题目标签）。
  - 套题来源跟随：单向版本关联、内容更新预览对比、失效标记。
  - 编排与打乱：题型分区、合并分区打乱、固定题目组整组移动、共用材料题小题顺序保序、选项打乱与固定选项。
  - 答题流程：练习模式（一屏一题+即时判定+解析+重做新尝试）、考试模式（整卷虚拟滚动+限时/不限时+自动交卷）。
  - 计时与练习量：手动暂停全屏遮罩、失焦不停止、异常关机不计用时、单题作答完成事件驱动、跨午夜用时按日拆分。
  - 错题本：未满分自动收录、同源同版本合并、答题快照保存、掌握状态流转、条件筛选组卷复习。
  - 学习看板：练习量、用时统计、每日学习热力图（题数/用时双维度）。
  - 数据安全与导入导出：Markdown/JSON/自有格式 zip 容器打包、导入“一票否决”严格校验、全量备份恢复前快照机制、回收站软删除。
- **交付范围外 (Out-of-Scope)**：
  - 线上服务器部署与多端自动同步（保留接口契约，首版无服务器连接入口）。
  - 用户注册/登录/认证体系。
  - 自动复习排程（如 Anki/艾宾浩斯间隔曲线，首版为手动筛选组卷）。
  - AI 语义搜索与作弊监控（切屏检测等）。

### 1.2 架构分层与四道解耦防线 (Decoupling Guardrails)

```
┌─────────────────────────────────────────────────────────────┐
│               apps/desktop (Electron Host)                  │
│    - 窗口生命周期  - 托盘与菜单  - 托管启动本地 Node.js 进程  │
└──────────────────────────────┬──────────────────────────────┘
                               │ 仅提供 Local Backend URL (如 http://127.0.0.1:48123)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 apps/web (React 19 + Vite)                  │
│  - 纯 Web 前端，无任何 Electron 专有依赖                    │
│  - 统一 BackendClient (面向标准 HTTP REST / Hono RPC)       │
│  - Zustand (UI状态) + TanStack Query (数据缓存与乐观更新)    │
│  - @dnd-kit 编排拖拽 + @tanstack/react-virtual 长列表虚拟化 │
└──────────────────────────────┬──────────────────────────────┘
                               │ 标准 HTTP 请求 (前后端完全同构契约)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 packages/server (Hono Web)                  │
│  - RESTful API 路由与控制器  - 全局错误语义拦截             │
│  - 附件流式服务  - 导入导出打包引擎                         │
└──────────────┬───────────────────────────────┬──────────────┘
               │ 依赖领域函数                  │ 依赖仓储接口
               ▼                               ▼
┌──────────────────────────────┐┌──────────────────────────────┐
│    packages/core (Domain)    ││ packages/database (Kysely)   │
│  - 6 大题型判分算法 (纯函数) ││  - Repository 仓储接口定义   │
│  - Fisher-Yates 种子打乱     ││  - SQLite 驱动 (better-sqlite3)
│  - 跨午夜计时拆分计算        ││  - WAL 模式 + 外键约束       │
│  - 零 IO、100% 单元测试覆盖  ││  - 未来可无缝切换 Postgres   │
└──────────────────────────────┘└──────────────────────────────┘
               ▲                               ▲
               └───────────────┬───────────────┘
                               │ 共享类型与契约
┌──────────────────────────────┴──────────────────────────────┐
│                  packages/shared (Contracts)                │
│  - Zod DTO 模型校验  - 统一错误码  - 实体类型定义            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 研发里程碑与推进路线图 (Milestones)

| 阶段 (Phase) | 阶段名称 | 核心交付成果 | 验收里程碑 (Gate) |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **工程骨架与基础基础设施** | Monorepo 拓扑、共享契约、纯函数领域算法、SQLite 仓储层 | Core 纯函数测试通过率 100%，SQLite 迁移与仓储测试闭环 |
| **Phase 1** | **后端核心业务 API 与数据安全** | 内容管理、编排逻辑、会话与判分、错题本、备份还原与导入导出 API | 覆盖全业务的 API 冒烟测试、zip 备份恢复回滚机制验证 |
| **Phase 2** | **Electron 桌面宿主与后端编排** | Desktop 进程托管本地 Node 后端、安全通信、窗口管理 | 桌面端冷启动无感拉起后端，优雅退出无僵尸进程 |
| **Phase 3** | **前端框架与通用交互基础** | React 19 + shadcn/ui 框架、文件管理器布局、Markdown/KaTeX 渲染 | 左右侧边栏固定/抽屉丝滑切换，数学公式与代码高亮正常 |
| **Phase 4** | **内容管理与套题编排工作台** | 文件夹/题库/套题管理、题目编辑器、`@dnd-kit` 编排打乱 | 6 种题型编辑闭环、固定组整组拖拽、选项打乱与固定测试 |
| **Phase 5** | **答题引擎、错题复习与学习看板** | 练习模式、考试模式虚拟长列表、计时遮罩、错题收录、学习看板热力图 | 百题整卷考试流畅无卡顿、跨天统计正确、错题快照留存 |
| **Phase 6** | **集成验收、打包分发与文档更新** | Windows 安装包构建、离线运行全流程压测、工程文档归档 | 离线安装包解压即用，更新 `architecture.md` 与 `progress.md` |

---

## 3. 详细实施任务拆解 (Phases & Tasks)

### Phase 0: 工程骨架与基础基础设施建设 (Monorepo & Toolchain Setup)

#### Task 0.1: pnpm Monorepo 与构建工程初始化
- **目标**：搭建 pnpm Workspaces + Turborepo，配置根级别 TypeScript、Biome/ESLint、Prettier 及 Vitest 测试基础设施。
- **涉及路径**：
  - `package.json`（根目录）
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `tsconfig.base.json`
  - `vitest.workspace.ts`
- **步骤**：
  1. 初始化 Monorepo 目录结构：`apps/desktop`, `apps/web`, `packages/core`, `packages/shared`, `packages/server`, `packages/database`。
  2. 配置 `pnpm-workspace.yaml` 与 Turborepo 流水线缓存策略。
  3. 配置共享 TypeScript 严格模式 (`strict: true`, `noImplicitAny: true`)。
- **验收标准**：
  - 执行 `pnpm install` 正常完成依赖链接。
  - 执行 `pnpm turbo build` 与 `pnpm turbo test` 能够正常执行且零报错。

#### Task 0.2: `packages/shared` 共享类型、DTO 与 Zod 契约
- **目标**：定义前后端共享的数据模型接口、枚举、统一错误码、Zod Schema，确保全链路类型安全。
- **涉及路径**：`packages/shared/src/`
  - `enums/`：`QuestionType` (6 种), `ScoreMode` (完全匹配/比例得分), `StudyMode` (practice/exam), `TagTargetType` (file/question), `MasteryStatus` (reviewing/mastered)。
  - `schemas/`：题目结构 Zod Schema、导入导出验证 Schema、会话作答请求 Schema。
  - `dto/`：API 输入输出接口定义。
  - `errors/`：统一错误枚举与 `AppError` 结构（包含 code, message, details）。
- **步骤**：
  1. 编写 6 种题型的结构化 Schema（单选、多选、不定项、严格填空、非严格填空、主观题，包含共用材料小题）。
  2. 编写文件标签与题目标签的强类型隔离校验。
  3. 导出所有类型并配置 `tsup` 进行跨包导出。
- **验收标准**：
  - Vitest 运行 Zod 解析与非法字段拦截断言，确保 100% 拦截非法题型和空题目。

#### Task 0.3: `packages/core` 领域纯函数与判分算法
- **目标**：实现无副作用、零 IO、100% 单元测试覆盖的核心算法库。
- **涉及路径**：`packages/core/src/`
  - `scoring/`：
    - `judgeSingleChoice(standardAnswer, userAnswer)`
    - `judgeMultipleChoice(standardAnswers, userAnswers, scoreMode, fullScore)`（支持完全匹配得分、少选按比例得分、错选 0 分）
    - `judgeIndefiniteChoice(...)`（同上）
    - `judgeStrictFillInBlank(standards: string[][], users: string[], scoreMode, fullScore)`（逐字符完全匹配、空格/大小写/全半角严格、多备选答案支持）
    - `judgeSubjective()`（返回未判分状态，不计入可判分总分）
  - `shuffling/`：
    - `seededFisherYates(array, seed)`（确定性伪随机打乱）
    - `shufflePaperSections(paperStructure, options)`（题型分区间/合并打乱、固定组整组保序、共用材料题小题保序）
    - `shuffleOptions(question, seed)`（打乱选项且保留唯一 identity ID，非字母绑定）
  - `timing/`：
    - `splitDurationAcrossMidnight(startTime, endTime, rawSeconds)`（跨午夜时段切割至具体自然日统计）
- **步骤**：
  1. 采用严格 TDD 方式编写单测用例。
  2. 针对填空题多备选项、少选得分比例计算、固定组移动等编写大量边界条件测试。
- **验收标准**：
  - Vitest 运行 `packages/core` 单元测试，覆盖率 100%，全部 PASS。

#### Task 0.4: `packages/database` Kysely 仓储与 SQLite (better-sqlite3) 适配器
- **目标**：实现数据库访问层与仓储模式（Repository Pattern），使用 Kysely + better-sqlite3，确保与具体数据库引擎解耦。
- **涉及路径**：`packages/database/src/`
  - `schema/`：数据库表结构定义（folders, question_banks, papers, questions, paper_items, tags, tag_relations, study_sessions, study_records, mistake_records, attachments）。
  - `migrations/`：Kysely 迁移脚本（自动创建索引、外键约束、WAL 模式配置）。
  - `repositories/`：
    - `IFolderRepository`, `IQuestionBankRepository`, `IPaperRepository`
    - `IQuestionRepository`, `ITagRepository`, `IStudySessionRepository`
    - `IMistakeRepository`, `IAttachmentRepository`
  - `sqlite/`：基于 `better-sqlite3` 实现上述接口。
- **步骤**：
  1. 编写建表迁移脚本，显式启用 `PRAGMA foreign_keys = ON;` 和 `PRAGMA journal_mode = WAL;`。
  2. 实现统一事务机制（`runInTransaction`）。
  3. 实现各仓储的具体 CRUD 查询。
- **验收标准**：
  - 启动内存 SQLite 运行全量仓储测试：增删改查、级联删除保护、事务回滚断言全部通过。

#### Task 0.5: `packages/server` Hono 路由骨架与中间件基础
- **目标**：搭建轻量高性能 Node.js + Hono 服务端，集成统一错误处理、请求日志与依赖注入。
- **涉及路径**：`packages/server/src/`
  - `app.ts`：Hono 实例配置。
  - `middlewares/`：错误捕获中间件、Zod 验证中间件、CORS 中间件。
  - `routes/`：路由模块划分。
- **步骤**：
  1. 封装 Hono 应用，注入仓储接口实例。
  2. 统一错误响应结构 `{ success: false, error: { code, message, details } }`。
- **验收标准**：
  - 使用 Hono Client 发起请求测试，端到端类型推断生效，健康检查接口返回正常。

---

### Phase 1: 后端核心业务 API 与数据安全 (Backend & Storage Core)

#### Task 1.1: 附件虚拟化存储服务 (Attachment Service)
- **目标**：实现附件抽象存储，以 SHA-256 哈希命名防重，提供虚拟 URL，杜绝前端接触本地盘符。
- **涉及路径**：`packages/server/src/services/attachment.service.ts`
- **步骤**：
  1. 定义 `IAttachmentStorage` 接口（upload, readStream, delete, exists）。
  2. 实现本地文件系统存储：计算文件 SHA-256，保存至应用附件目录（如 `<APP_DATA>/attachments/<hash>`）。
  3. 提供 `POST /api/attachments`（上传）与 `GET /api/attachments/:id`（流式输出带 MIME 类型的资源）。
- **验收标准**：
  - 重复上传同一图片仅存储一份，通过接口读取流能完整还原文件二进制。

#### Task 1.2: 文件夹、题库、题目与双标签系统 API
- **目标**：实现内容组织的核心增删改查，并严格实施文件标签与题目标签的物理隔离。
- **涉及路径**：`packages/server/src/routes/` (`folders.ts`, `banks.ts`, `questions.ts`, `tags.ts`)
- **步骤**：
  1. 实现多层文件夹嵌套树形查询与移动校验（防循环依赖）。
  2. 实现题库及题目管理（支持 Markdown 题干、选项表单、共用材料父子关联）。
  3. 实现两套独立标签系统：
     - 文件标签只能绑定 folder, question_bank, paper。
     - 题目标签只能绑定 question。
     - 严禁交叉混用与自动继承。
  4. 题目全文检索与多条件组合筛选。
- **验收标准**：
  - 尝试给题目打上文件标签时，API 返回 400 校验错误并明确拒收。
  - 嵌套文件夹移动循环检测有效拦截。

#### Task 1.3: 套题编排、打乱与来源跟随引擎
- **目标**：实现套题固定组卷、题型分区编排、按规则打乱以及源题库单向跟随机制。
- **涉及路径**：`packages/server/src/routes/papers.ts`, `packages/server/src/services/paper.service.ts`
- **步骤**：
  1. 套题创建：支持直接建题或从题库选题（保存 `source_question_id` 与当时版本号）。
  2. 分区与分组管理：记录题型分区、合并分区打乱标记、固定组标记、共用材料关联。
  3. 来源跟随引擎：
     - 默认关闭跟随；开启前提供 Diff 预览（题干、选项、答案、解析、材料、题目标签）。
     - 更新跟随内容，但不改变套题选题名单、排序、分值和判分规则。
     - 源题删除后标记 `source_invalid = true`，保留套题内最后内容。
- **验收标准**：
  - 模拟修改题库中的题目，套题开启跟随预览显示精确 Diff；应用跟随更新后，套题内题目内容同步且顺序分值不变。

#### Task 1.4: 答题会话、实时判分与用时切分服务
- **目标**：驱动练习与考试模式的会话生命周期、防重复计数与跨天统计。
- **涉及路径**：`packages/server/src/routes/sessions.ts`, `packages/server/src/services/session.service.ts`
- **步骤**：
  1. 开始答题：固定本次题目列表、打乱后的选项顺序及判分规则，生成 `study_session`。
  2. 练习模式单题提交：调用 `@quarry/core` 判定单题得分，记录 `study_record`，返回判定结果与解析；同一题重复提交报错，重做需明确开启新重做尝试。
  3. 考试模式交卷：接收整卷作答快照，批量判定，空白题保留在结果中但不增加已作答题数统计。
  4. 计时汇总：累加会话有效用时（扣除暂停时长），调用 `splitDurationAcrossMidnight` 写入按日统计表。
- **验收标准**：
  - 单题重做生成独立记录，原记录完好；跨午夜做题记录被准确拆分到两天。

#### Task 1.5: 错题本与学习看板聚合服务
- **目标**：实现错题未满分自动收录、同源同版本合并、状态流转以及看板多维度聚合查询。
- **涉及路径**：`packages/server/src/routes/mistakes.ts`, `packages/server/src/routes/analytics.ts`
- **步骤**：
  1. 错题收录：自动判分题未得满分自动存入 `mistake_records`；非严格填空/主观题支持手动收录。
  2. 错题合并：检查 `source_question_id` 与题目版本号，相同者合并答题历史；不同版本独立记录。保存当时题目与用户答案快照。
  3. 错题状态：维护 `reviewing`（待复习）与 `mastered`（已掌握），支持手动切换；再次判错自动回到 `reviewing`。
  4. 筛选组卷：按题型、标签、来源、状态筛选错题，一键生成新的复习套题。
  5. 学习看板：聚合每日答题量、用时、去重题数，生成热力图矩阵数据。
- **验收标准**：
  - 同一题目做错两次合并为一条错题记录，保留两次做题详情；标记已掌握后再次做错自动回退至待复习。

#### Task 1.6: 严格导入导出、备份快照与回收站机制
- **目标**：实现 Markdown、JSON 及 zip 格式的严格校验导入、无损导出、全量备份恢复前快照回滚机制，以及两阶段删除。
- **涉及路径**：`packages/server/src/services/backup.service.ts`, `packages/server/src/services/import-export.service.ts`
- **步骤**：
  1. 导入一票否决：全量解析校验 Markdown/JSON，任何一处格式错误整份拒绝，输出具体错误行号与原因。
  2. 导出打包：使用 `archiver` 将题目、结构、元数据及附件打包为 `.quarry` (zip 容器)。
  3. 全量备份与恢复：备份包含完整数据库与附件目录；恢复时在事务中先生成当前数据库与附件恢复点快照（Recovery Point），校验无误后替换，发生异常自动回滚。
  4. 回收站：删除题目、套题、题库进入回收站软删除，清空时彻底物理删除；学习记录与错题快照独立保留。
- **验收标准**：
  - 构造包含一行错误语法的导入文件，系统完整拒绝且数据库零脏数据；模拟恢复中断，自动回滚至恢复点。

---

### Phase 2: Electron 桌面宿主与后端编排 (Desktop Shell)

#### Task 2.1: `apps/desktop` 项目搭建与安全配置
- **目标**：使用 `electron-vite` 搭建桌面主进程，配置窗口、生命周期、安全策略（CSP、禁用 nodeIntegration、启用 contextIsolation）。
- **涉及路径**：`apps/desktop/src/` (`main/index.ts`, `preload/index.ts`)
- **步骤**：
  1. 配置 Electron 主进程窗口尺寸、无边框/自定义标题栏预留、深色模式跟随。
  2. 配置安全策略：渲染进程禁用 Node 运行时，只通过 `preload.ts` 暴露受限环境变量（如本地后端端口）。
- **验收标准**：
  - 启动 Electron 窗口，DevTools 审查零安全警告，IPC 暴露面严格受限。

#### Task 2.2: 本地 Node.js 后端守护与生命周期管理
- **目标**：在 Electron 主进程启动时自动在随机可用端口拉起本地后端服务，退出时优雅终止，避免端口冲突与孤儿进程。
- **涉及路径**：`apps/desktop/src/main/backend-manager.ts`
- **步骤**：
  1. 随机端口分配：检测 `127.0.0.1` 空闲端口。
  2. 进程内嵌入或子进程运行：在 Electron 主进程或 Worker 进程中拉起 Hono Node 服务，传入本地数据存储绝对路径（`%APPDATA%/Quarry/`）。
  3. 健康检查：主进程轮询 `GET /api/health` 确认服务就绪后再加载前端页面。
  4. 退出生命周期：监听 Electron `before-quit`，通知后端关闭 SQLite 连接、刷新 WAL 并退出。
- **验收标准**：
  - 启动桌面端，后端在 1 秒内就绪并成功响应；强杀/正常退出桌面端，无残留后台 node 僵尸进程。

---

### Phase 3: 前端核心框架与通用交互基础 (Web UI Foundation)

#### Task 3.1: `apps/web` 框架初始化与设计系统搭建
- **目标**：基于 React 19 + Vite + Tailwind CSS + shadcn/ui，搭建零运行时 CSS、高度可复用的前端框架。
- **涉及路径**：`apps/web/src/`
- **步骤**：
  1. 安装并配置 Tailwind CSS、shadcn/ui 基础组件库（Button, Dialog, DropdownMenu, Tooltip, Input, Select, Toast 等）。
  2. 配置 `next-themes` 实现主题切换：浅色、深色、跟随系统。
  3. 配置全局字体缩放体系（基于根 html rem 动态调整，支持答题界面字号多级放大/缩小）。
- **验收标准**：
  - 页面在浅色与深色模式下无缝切换，无闪烁；调整字号配置，题目排版自适应缩放。

#### Task 3.2: 统一 BackendClient 与数据层封装
- **目标**：封装端到端类型安全的 API 客户端，隔离网络通信细节，预留未来远程自托管切换能力。
- **涉及路径**：`apps/web/src/lib/api-client.ts`, `apps/web/src/hooks/`
- **步骤**：
  1. 实现 `BackendClient`：从 Electron 注入的环境变量或全局配置中读取 `baseURL`（开发环境为本地 Vite 代理或 localhost 端口）。
  2. 封装统一错误拦截器，对 400/404/500 输出标准 Toast 提示。
  3. 结合 `@tanstack/react-query` 封装各类 Entity 的 CRUD Hooks 与缓存刷新逻辑。
- **验收标准**：
  - 前端请求具备完整类型提示，请求失败时能弹出规范友好的错误语义提示。

#### Task 3.3: Markdown、LaTeX 公式与代码高亮渲染器
- **目标**：实现满足数学、代码及复杂格式题目的高性能排版渲染组件。
- **涉及路径**：`apps/web/src/components/markdown/`
- **步骤**：
  1. 基于 `markdown-it` 构建渲染器，挂载 `katex` 数学公式插件（离线字体打包）、`prismjs` 语法高亮插件。
  2. 扩展图片解析规则：自动拦截虚拟协议（如 `attachment://<id>`）转换为实际后端的图片流式 URL。
  3. 封装 `<MarkdownViewer content={...} />` 组件，内置 KaTeX CSS 与 Prism CSS。
- **验收标准**：
  - 测试用例渲染包含行内公式 `$E=mc^2$`、块级公式 `$$\int_0^\infty ...$$`、TypeScript 代码块及表格的 Markdown 文本，渲染准确流畅无破损。

#### Task 3.4: 应用导航、资料库布局与侧边栏抽屉机制
- **目标**：应用默认进入学习看板首页；一级导航包含首页、资料库、错题本和学习记录，另提供回收站与设置。文件管理器布局用于资料库，支持侧边栏固定与浮层抽屉切换、遮罩覆盖、Esc 收起。
- **涉及路径**：`apps/web/src/components/layout/`
- **步骤**：
  1. 使用 `react-resizable-panels` 实现左侧导航树与右侧主视图的可拖动分栏。
  2. 侧边栏模式切换：
     - 固定模式：占据物理布局空间，可拖拽调整宽度。
     - 抽屉浮层模式：取消固定后主视图全宽，点击展开按钮弹出侧边栏抽屉，带半透明遮罩覆盖，点击遮罩或按 `Esc` 键平滑收起。
  3. 答题时侧边栏自动切换为题目导航卡，退出答题后恢复管理导航与原栏目；文件树在资料库中显示。
- **验收标准**：
  - 点击固定/取消固定按钮，侧边栏在物理布局与浮层抽屉之间准确切换，按 Esc 键正常收起抽屉。

---

### Phase 4: 内容管理与套题编排工作台 (Content Management & Composition UI)

#### Task 4.1: 资料库、文件管理器树形导航与标签筛选
- **目标**：实现左侧树状目录、顶部面包屑、主区域列表/图标双视图，以及独立的标签过滤面板。
- **涉及路径**：`apps/web/src/pages/explorer/`
- **步骤**：
  1. 资料库：提供“新建文件夹”、“新建题库”、“新建套题”、“导入文件”入口；学习看板首页与继续答题入口见 Task 5.5。
  2. 文件树支持文件夹多层展开/收起、拖拽移动、重命名、移入回收站。
  3. 文件标签过滤：独立于题目标签，仅对当前目录下的文件夹、题库、套题进行标签筛选。
- **验收标准**：
  - 资料库能流畅切换列表与图标视图，并保留文件树导航；首页保持学习看板，不展示文件管理器作为默认主内容。

#### Task 4.2: 题库详情与题目编辑器
- **目标**：实现题库管理页面与全功能题目编辑器，支持 6 种题型及共用材料题的创建与修改。
- **涉及路径**：`apps/web/src/pages/questions/`
- **步骤**：
  1. 题干与解析采用左右分栏 Markdown 即时编辑与预览。
  2. 结构化选项表单：
     - 单选/多选/不定项：动态增减选项，标记正确答案，配置“固定选项顺序”。
     - 严格填空：动态增加空位，每空支持配置多个等效标准答案。
     - 非严格填空与主观题：仅填写参考答案与解析。
  3. 共用材料题：支持父级材料录入与下方嵌套小题列表。
  4. 附件上传：支持工具栏插入图片、本地文件拖拽、剪贴板截图直接粘贴（自动调用附件上传接口）。
- **验收标准**：
  - 复制剪贴板截图直接粘贴进 Markdown 编辑器，自动上传为附件并替换为虚拟图片链接；6 种题型均能正常保存与回显。

#### Task 4.3: 套题编排工作台与 `@dnd-kit` 分区打乱交互
- **目标**：实现高度灵活且受约束的套题编排器：题型分区、固定组整组移动、共用材料保序、合并分区打乱配置。
- **涉及路径**：`apps/web/src/pages/papers/composer/`
- **步骤**：
  1. 套题基本属性：满分设置、判分规则（多选少选比例/完全匹配；填空按比例/全对）、考试限时/不限时配置。
  2. 题目来源跟随设置：开启/关闭跟随开关；开启前弹出 Diff 预览对比弹窗。
  3. 基于 `@dnd-kit` 的编排画布：
     - 按题型自动划分分区（单选题区、多选题区等），支持分区内拖拽排序。
     - “固定题目组”创建：选中多题合并为一个固定组，拖拽时整组移动，禁止拆开。
     - 共用材料题：整组移动，内部小题禁止打乱。
     - 分区打乱配置：支持勾选“分区内部打乱”或“选中多个分区合并后打乱”。
- **验收标准**：
  - 拖拽固定组时，组内所有题目保持原有相对顺序整组移动；合并打乱配置正常保存至套题元数据。

#### Task 4.4: 导入导出与全量备份恢复交互
- **目标**：实现具有严格错误校验反馈的导入面板、多种格式导出、以及具备快照回滚提示的系统备份恢复。
- **涉及路径**：`apps/web/src/pages/settings/backup-import.tsx`
- **步骤**：
  1. 导入向导：选择 Markdown/JSON 文件，调用后端预检接口；若存在格式或字段错误，弹窗展示格式错误明细（行号、原因），明确拒绝导入；校验通过后预览题目清单并确认创建。
  2. 导出面板：选择题库或套题，选择格式（Markdown / JSON / .quarry 归档包），触发下载。
  3. 备份恢复：
     - 点击“创建全量备份”导出 `.quarry-backup` 文件。
     - 点击“恢复备份”时，强提醒风险，后台自动创建当前数据快照，恢复成功后刷新数据，恢复失败时展示恢复点还原选项。
- **验收标准**：
  - 导入错误文件时，错误清单准确指出第几道题/第几行校验失败；备份恢复流程顺畅。

---

### Phase 5: 答题引擎、错题复习与学习看板 (Answering Engine & Review UI)

#### Task 5.1: 练习模式交互引擎 (一屏一题 + 解析锁定)
- **目标**：实现专注沉浸的练习流程：一屏一题、选项打乱呈现、作答提交锁定、答案解析对比、重做尝试流转。
- **涉及路径**：`apps/web/src/pages/study/practice/`
- **步骤**：
  1. 进入练习：从套题根据打乱规则拉取题目与呈现顺序。
  2. 题目渲染：根据当前题型渲染对应作答组件（单选/多选点击、填空输入框、主观题自答框）。
  3. 提交判题：点击“确认答题”（非判分题点击“完成并查看答案”），调用判题接口，返回判定结果，界面立即锁定为只读状态，展开答案与详细解析。
  4. 答题导航：侧边栏显示题号卡（标记已做/未做/正确/错误），支持快捷键切题（上一题、下一题）。
  5. 重做功能：已作答题目提供“重新练习”按钮，生成该题新的作答尝试，不覆盖原有作答历史。
- **验收标准**：
  - 点击“确认答题”后选项被锁定不可改动，解析正常展开；刷新页面或重新打开能恢复到当前答题进度。

#### Task 5.2: 考试模式长列表虚拟滚动与交卷引擎
- **目标**：实现长卷考试模式：`@tanstack/react-virtual` 动态高度虚拟滚动、整卷作答、交卷确认与时限自动交卷。
- **涉及路径**：`apps/web/src/pages/study/exam/`
- **步骤**：
  1. 长列表虚拟化：针对包含大量题目、公式和图片的整卷，采用 `@tanstack/react-virtual` 动态测量高度，确保百题长卷滚动无掉帧。
  2. 考试导航卡：侧边栏实时联动滚动位置，显示各题已填/未填状态（交卷前严禁显示对错）。
  3. 倒计时与自动交卷：限时考试顶部固定显示倒计时；时间耗尽时强制锁定输入并自动提交。
  4. 交卷后结果看板：交卷后整卷展开显示得分、正确率、每道题的判定结果与解析。
- **验收标准**：
  - 模拟包含 100 道含公式图片的整卷考试，长列表滚动流畅，内存占用平稳；倒计时归零时自动触发交卷。

#### Task 5.3: 计时器、手动暂停全屏遮罩与异常恢复
- **目标**：实现符合规范的答题计时机制：失焦不暂停、手动暂停黑屏遮罩、关机不计用时。
- **涉及路径**：`apps/web/src/components/study/timer.tsx`
- **步骤**：
  1. 计时状态机：基于 Zustand 管理 `StudyTimer`。页面失焦、最小化时继续计时。
  2. 手动暂停：用户点击“暂停答题”按钮，计时停止，界面弹出全屏不透明遮罩完全遮盖题目内容；点击“继续答题”后恢复计时并移除遮罩。
  3. 关机休眠防作弊/防虚高：记录活跃心跳时间戳；重启恢复时，如果上次心跳距当前恢复时间超过阈值，整段离线时间不计入练习时长。
- **验收标准**：
  - 最小化应用窗口 5 分钟，计时准确累加 5 分钟；手动暂停时题目内容被彻底遮挡且计时停止。

#### Task 5.4: 错题本工作台与一键组卷复习
- **目标**：实现错题本管理：按题型/标签/来源/掌握状态筛选，错题快照查看，以及一键创建复习套题。
- **涉及路径**：`apps/web/src/pages/mistakes/`
- **步骤**：
  1. 错题列表：展示错题卡片，显示做错次数、最近做错时间、当前掌握状态（待复习/已掌握）。
  2. 错题详情弹窗：展示错题快照（答错时的题干与选项）、用户当时的作答记录与标准答案解析。如果源题库已更新，给出“源题有更新”提示并允许切换查看新版。
  3. 状态切换：用户可手动标记“已掌握”或“设为待复习”。
  4. 一键组卷：勾选多道错题或按筛选条件全选，点击“创建复习套题”，跳转至套题编排工作台自动生成套题并保存。
- **验收标准**：
  - 筛选“待复习”的错题一键创建复习套题，成功生成新套题且进入练习。

#### Task 5.5: 学习看板首页与每日热力图
- **目标**：将学习看板作为默认首页，实现练习量、去重题数、累计用时、每日学习热力图与学习趋势，展示待复习错题概况和继续未完成答题入口。
- **涉及路径**：`apps/web/src/pages/dashboard/`
- **步骤**：
  1. 首页概况：总练习题数、去重题数、总用时、平均正确率；存在未完成答题时展示继续入口，待复习错题概况链接至错题本，不提供自动复习排程。
  2. 每日热力图组件：基于轻量 SVG 网格实现 365 天热力图矩阵。
     - 支持切换“按答题数量着色”与“按用时着色”。
     - 鼠标悬停显示 Tooltip（如：`2026-11-06：完成 45 题，用时 38 分钟`）。
  3. 学习趋势折线图：使用 `recharts` 绘制近 30 天每日练习量趋势。
- **验收标准**：
  - 热力图在两种着色模式下色彩层级分明，悬停信息准确对齐自然日拆分数据。

---

### Phase 6: 端到端集成测试、打包分发与文档更新 (Integration, Packaging & Verification)

#### Task 6.1: 全链路端到端自动化测试与边界压测
- **目标**：编排完整的业务生命周期集成测试，涵盖题库创建 -> 套题编排打乱 -> 练习提交 -> 错题收录 -> 看板统计 -> 备份导出的全闭环。
- **涉及路径**：`tests/e2e/`
- **步骤**：
  1. 编写集成测试脚本，模拟真实用户完整操作流程。
  2. 针对大数据量场景进行压力测试（测试 5000 道题检索与 200 题虚拟滚动）。
- **验收标准**：
  - 集成测试全部通过，无内存泄漏与死锁现象。

#### Task 6.2: Electron 打包与 Windows 安装包构建
- **目标**：配置 `electron-builder` 打包生产环境制品，处理 Node 原生模块 (`better-sqlite3`) 的正确二进制打包。
- **涉及路径**：`apps/desktop/electron-builder.yml`
- **步骤**：
  1. 配置 `electron-builder`，针对 Windows 平台构建 x64 安装包 (`.exe` NSIS) 及免安装绿色版压缩包。
  2. 针对 `better-sqlite3` 配置 `asarUnpack` 规则，防止 native addon 打入 ASAR 导致加载失败。
  3. 验证离线环境冷启动（断网测试，确保无需联网下载字体与依赖）。
- **验收标准**：
  - 生成 Windows 安装程序，全新干净机器上安装运行正常，完全离线可用。

#### Task 6.3: 架构文档与进度归档 (`memory-bank`)
- **目标**：按照 `AGENTS.md` 规范，沉淀完整的系统架构文档与里程碑进度记录。
- **涉及路径**：
  - `memory-bank/architecture.md`（新建/更新，沉淀实际架构实现细节）
  - `memory-bank/progress.md`（新建/更新，记录功能完成状态）
- **步骤**：
  1. 编写 `architecture.md`，记录最终落地目录拓扑、数据库 ER 图、核心接口契约与关键算法设计。
  2. 编写 `progress.md`，对齐首版功能清单与验收状态。
- **验收标准**：
  - 文档完整反映实际工程拓扑，无矛盾或过时信息。

---

## 4. 关键技术难点与实现细节策略

### 4.1 选项身份绑定与打乱算法 (Identity-based Shuffling)

- **痛点**：传统题库常将答案与字母（A/B/C/D）绑定，打乱后容易出现答案指代混乱。
- **设计策略**：
  1. 每个选项在创建时分配唯一 UUID（`option_id`）。
  2. 正确答案字段保存 `option_id`（如 `["opt-uuid-1", "opt-uuid-3"]`）。
  3. 打乱阶段：使用带 Session ID 种子的 Fisher-Yates 算法对选项列表进行重排。
  4. 渲染阶段：纯前端根据打乱后的当前数组下标，映射展示 `A`、`B`、`C`、`D` 序号。
  5. 题目若标记“选项顺序固定”，则打乱函数直接跳过该题选项重排。

### 4.2 严格填空题判分引擎 (Strict Fill-in-the-Blank Matching)

- **痛点**：填空题存在多空、每空多个等效答案、且要求严格逐字符匹配（包含空格、大小写、标点及全半角）。
- **设计策略**：
  ```typescript
  export function judgeStrictFillInBlank(
    standards: string[][], // standards[i] 表示第 i 个空的所有合法等效答案
    users: string[],       // users[i] 表示用户填写的答案
    scoreMode: 'all_or_nothing' | 'proportional',
    fullScore: number
  ): { isCorrect: boolean; score: number; details: boolean[] } {
    const details = standards.map((validAnswers, idx) => {
      const userAns = users[idx] ?? '';
      // 严格逐字符比对，不 trim，不 toLowerCase，不转换全半角
      return validAnswers.includes(userAns);
    });

    const correctCount = details.filter(Boolean).length;
    const totalCount = standards.length;

    if (scoreMode === 'all_or_nothing') {
      const isAll = correctCount === totalCount;
      return { isCorrect: isAll, score: isAll ? fullScore : 0, details };
    } else {
      const ratio = totalCount > 0 ? correctCount / totalCount : 0;
      const score = Math.round((ratio * fullScore) * 100) / 100;
      return { isCorrect: correctCount === totalCount, score, details };
    }
  }
  ```

### 4.3 跨午夜计时时间段拆分 (Midnight Splitting)

- **痛点**：用户在夜间做题跨过 00:00 时，单次会话时间若直接计入开始日或结束日都会导致日统计失真。
- **设计策略**：
  1. 会话记录精确的 `start_time` 与 `end_time`（毫秒时间戳）以及总有效秒数 `effective_seconds`。
  2. 若 `start_time` 与 `end_time` 处于不同自然日（按本地时区），按午夜 00:00:00 切分为两个时间段区间 $[t_{start}, t_{midnight}]$ 与 $[t_{midnight}, t_{end}]$。
  3. 计算两段自然时间比例，将 `effective_seconds` 按比例分配至两天的日常学习统计表。

### 4.4 better-sqlite3 原生模块与 Electron ASAR 打包

- **痛点**：`better-sqlite3` 是 C++ Node 原生插件，直接打入 ASAR 压缩包会导致运行时找不到 `.node` 二进制文件。
- **设计策略**：
  1. 在 `electron-builder.yml` 中明确配置：
     ```yaml
     asarUnpack:
       - "**/node_modules/better-sqlite3/**"
     ```
  2. 主进程启动本地后端时，通过动态路径解析加载解包后的二进制文件。

---

## 5. 质量保障与验收标准矩阵 (QA & Verification Gates)

| 测试类型 | 测试范围 | 工具 / 方式 | 准入通过标准 |
| :--- | :--- | :--- | :--- |
| **单元测试 (Unit)** | `@quarry/core` (判分、打乱、计时) | Vitest | 覆盖率 100%，覆盖 6 种题型边界用例全部 PASS |
| **仓储集成测试 (DB)** | `@quarry/database` (SQLite 仓储与迁移) | Vitest + In-memory SQLite | 事务回滚断言通过，外键约束保护正常 |
| **API 契约测试 (API)** | `@quarry/server` (Hono 路由与中间件) | Hono Client + Supertest | 输入校验 100% 拦截非法结构，错误格式语义统一 |
| **组件快照与交互测试** | Markdown 渲染、侧边栏抽屉、答题卡联动 | Playwright / Vitest Testing Library | 公式正常渲染，抽屉 Esc 正常收起，答题卡状态同步 |
| **长列表性能压测 (Perf)** | 考试模式 200 题虚拟滚动 | Chrome Performance DevTools | 滚动 FPS $\ge 55$，内存平稳无突增 |
| **安装包离线验证** | Windows 桌面安装包全流程 | 物理机 / VM 离线环境测试 | 断网无阻断，本地后端秒级启动，数据正常持久化 |

---

## 6. 后续协同与落地实施推荐方案

根据项目的 `AGENTS.md` 与工程分工规范：
1. **主智能体**：负责统筹规划、任务拆解、各 Phase 验收证据核对，严禁在主窗口编写大篇幅业务代码。
2. **代码实现执行引擎**：具体编码任务（Phase 0 至 Phase 6 各 Task 的具体代码编写与测试），建议通过本地终端调起独立环境的 **Codex CLI** 执行（绑定 `CODEX_HOME=C:\Users\Zojekin\.codex-cli`，模型走本地 CPA `gpt-6.1-sol`，PTY 驱动）。
3. **闭环更新纪律**：每完成一个里程碑后，由 Codex 或专用 Worker 更新 `memory-bank/architecture.md` 和 `memory-bank/progress.md`。

---
*计划编制完成，等待确认或开始分阶段落地。*
