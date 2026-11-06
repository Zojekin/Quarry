# 题匣 (Quarry) 系统架构设计说明书 (Architecture Specification)

> **版本**：v1.0.0  
> **基准依据**：`memory-bank/design-document.md`、`memory-bank/tech-stack.md`、`AGENTS.md`  
> **适用范围**：指导全系统模块划分、依赖流向、仓储抽象、数据协议与编码实现

---

## 1. 架构总览与核心设计原则

“题匣 (Quarry)”是一款个人离线题库与套题管理、答题及错题复习桌面软件。系统整体架构遵循 **“简单、健壮、高度解耦、全链路类型安全”** 的设计原则，采用 TypeScript 端到端同构的 pnpm Monorepo 拓扑。

### 1.1 四道核心解耦防线 (Decoupling Boundaries)

1. **界面与宿主解耦**：
   - 前端 (`apps/web`) 纯粹作为标准 Web 应用开发，严禁引入 Electron 专有模块（如 `ipcRenderer`、`remote`）。
   - 桌面外壳 (`apps/desktop`) 仅负责窗口生命周期托管、托盘菜单，并在启动时在本地随机可用端口拉起 Node.js 后端服务，通过预加载脚本将后端访问地址（如 `http://127.0.0.1:48123`）注入前端环境变量。
   - 前端 100% 具备平滑迁往自托管云端浏览器的能力。
2. **通信契约解耦**：
   - 前端通过统一封装的 `BackendClient` 发起标准 HTTP REST / Hono RPC 请求，不直接接触数据库驱动或 IPC 通信。
3. **业务层与数据库解耦**：
   - 业务控制器与服务层只依赖抽象的仓储接口（Repository Interface，如 `IQuestionRepository`, `IPaperRepository`）。
   - 数据库操作使用纯 TypeScript 的类型安全查询构建器 Kysely。首版使用 `better-sqlite3`（WAL 模式 + 外键约束）。未来迁移至自托管 PostgreSQL 时，只需在 `packages/database` 新增驱动适配器，核心业务逻辑零修改。
4. **附件与文件系统解耦**：
   - 附件存储通过 `IAttachmentStorage` 接口进行虚拟化封装。所有文件按 SHA-256 哈希命名防重存放在应用数据目录。
   - 前端仅通过虚拟资源标识（如 `GET /api/attachments/:id`）流式访问附件，绝不直接获取或展示本机绝对盘符路径。

---

## 2. Monorepo 工程拓扑与依赖流向

```
                    ┌────────────────────────┐
                    │      apps/desktop      │
                    │   (Electron Host)      │
                    └───────────┬────────────┘
                                │ 托管启动进程
                                ▼
                    ┌────────────────────────┐
                    │    packages/server     │
                    │      (Hono Web)        │
                    └───────┬────────┬───────┘
                            │        │
             ┌──────────────┘        └──────────────┐
             ▼                                      ▼
┌────────────────────────┐              ┌────────────────────────┐
│     packages/core      │              │   packages/database    │
│  (Pure Domain Functions│              │ (Kysely + Repositories)│
└────────────┬───────────┘              └───────────┬────────────┘
             │                                      │
             └──────────────┬───────────────────────┘
                            ▼
              ┌───────────────────────────┐
              │      packages/shared      │
              │  (Zod, DTO, Enums, Error) │
              └─────────────▲─────────────┘
                            │
              ┌─────────────┴─────────────┐
              │         apps/web          │
              │ (React 19 + shadcn/ui)    │
              └───────────────────────────┘
```

### 2.1 依赖规则 (Dependency Rules)
- `packages/shared`：所有包均可依赖，但 shared 绝不依赖任何业务逻辑或持久化包。
- `packages/core`：只依赖 shared，纯函数实现，严禁包含任何网络 I/O、文件 I/O 或数据库驱动调用。
- `packages/database`：只依赖 shared，定义仓储接口与具体 SQL 访问实现。
- `packages/server`：依赖 shared, core, database，实现路由调度、文件流式传输与备份归档。
- `apps/web`：依赖 shared，通过 HTTP 协议调用 server，严禁直接依赖 server、database 或 core 内部不可序列化状态。
- `apps/desktop`：依赖 server（作为托管启动目标）与 web（打包静态产物或窗口加载）。

---

## 3. 核心领域模型与状态机 (Domain Models & State Machines)

### 3.1 实体关系模型 (Entity Relationship)

```
[Folder] 1 ──── * [Folder] (多层嵌套)
   │
   ├─────── * [QuestionBank] 1 ──── * [Question] (归属题库)
   │                                     │
   └─────── * [Paper] 1 ──── * [PaperItem] ──── (引用 Question 或独立新建)
                │
                └─────── * [StudySession] 1 ──── * [StudyRecord] (单题作答)
                                                    │
                                                    ▼
                                            [MistakeRecord] (未满分自动收录)
```

### 3.2 两套独立标签系统物理隔离 (Dual Tag Isolation)
- **文件标签 (FileTag)**：仅允许与 `Folder`、`QuestionBank`、`Paper` 建立多对多关系。
- **题目标签 (QuestionTag)**：仅允许与 `Question` 建立多对多关系。
- **隔离约束**：
  - 数据库层面通过 `tag_relations.target_type` 严格限制枚举（`file` vs `question`）。
  - 两套标签无继承关系，严禁混用或跨对象检索。

### 3.3 套题编排、打乱与固定规则
1. **题型分区**：套题按单选、多选、不定项、严格填空、非严格填空、主观题自动形成分区。
2. **打乱策略**：
   - 分区内打乱：分区内部顺序重排。
   - 合并分区打乱：选定多个分区后整体打乱，每道题保留题型标记。
   - 固定题目组：组内题目保持相对次序，整组作为一个原子单元参与打乱或拖拽。
   - 共用材料题：材料与子题绑定，子题内部次序不可变，材料组可整体参与排序。
3. **选项身份绑定 (Identity Binding)**：
   - 选项保存固定 `option_id`，正确答案字段绑定 `option_id`。
   - 随机打乱仅变更前端展示顺序及 A/B/C/D 映射，不影响判定逻辑。
   - 若题目设置“选项顺序固定”，打乱算法跳过该题。

### 3.4 答题会话与判分状态机 (Session & Scoring)
- **练习模式 (Practice)**：
  - 状态：`UNANSWERED` -> `ANSWERED` -> `LOCKED`。
  - 一屏一题，点击“确认答题”后即时判定并锁定当前作答，展开解析与标准答案。
  - 允许重新练习该题，但重做必须生成全新的作答尝试（`attempt_index + 1`），保留历史作答数据。
- **考试模式 (Exam)**：
  - 状态：`IN_PROGRESS` -> `PAUSED` -> `SUBMITTED` -> `GRADED`。
  - 整卷虚拟滚动作答，交卷前允许自由跳题与改答，侧边栏导航卡仅标记已填/未填，绝不透露正误。
  - 限时到期触发系统自动交卷，锁定全卷作答并输出判定看板。
- **计时与暂停**：
  - 手动暂停后触发全屏不透明遮罩，计时器完全挂起。
  - 窗口失焦、最小化不暂停计时。
  - 异常关机或重启恢复后，离线跨度不计入练习时长。
  - 单次答题跨午夜时，系统调用 `splitDurationAcrossMidnight` 纯函数，按自然日比例拆分累计有效用时。

### 3.5 错题本流转机制 (Mistake Notebook)
- **自动收录**：自动判分题未获满分，在提交瞬间自动生成/合并错题记录。
- **手动收录**：主观题与非严格填空题，由用户在查看解析时手动点击“加入错题本”。
- **版本合并**：
  - 具有相同 `source_question_id` 且题目版本号一致的多次错误合并为单条错题，追加答题历史。
  - 题目内容已变更或无来源关联的题目，作为独立记录保存。
- **掌握状态**：
  - `REVIEWING`（待复习）与 `MASTERED`（已掌握）。
  - 用户可手动标记已掌握；已掌握题目再次答错时，状态自动倒回 `REVIEWING`。
- **筛选组卷**：按题型、标签、来源、掌握状态多维度筛选，一键生成“复习套题”。

---

## 4. 导入导出与数据安全规范 (Data Safety & Recovery)

### 4.1 导入“一票否决” (Zero-Tolerance Import)
- 支持 Markdown（约定模板）、JSON 及 `.quarry`（zip 归档）。
- 导入前必须经过完整的 Zod 模式与引用完整性校验。
- 若任一题目、选项、或结构存在语法错误，整份文件立即拒绝导入，并输出格式错误清单（明确至行号与字段），数据库零脏写入。

### 4.2 备份与恢复回滚机制 (Transactional Backup & Rollback)
- **备份结构**：包含 `manifest.json`（元数据及版本号）、`database.sqlite`（或全量数据表 JSON）及 `attachments/` 目录，打包为单个归档容器。
- **恢复防线**：
  1. 预检备份文件的签名与结构完整性。
  2. 在执行恢复前，系统自动在本地快照目录创建当前应用状态的恢复点（Recovery Point）。
  3. 执行全量原子替换。
  4. 若写入或重载失败，立即自动从恢复点还原，确保系统不处于损坏或半写状态。

---

## 5. 开发规范与代码质量要求

严格遵守项目根目录 `AGENTS.md`：
1. **解耦优先**：禁止跨层直接调用底层的驱动与私有查询。
2. **纯函数核心**：判分与打乱逻辑不得依赖系统时钟、全局变量或外部状态。
3. **命名规范**：遵循 TypeScript 标准 CamelCase 与 PascalCase，数据库表与字段采用 snake_case。
4. **里程碑更新**：每完成一个重大里程碑，必须同步更新 `memory-bank/progress.md` 与本架构文档。


## 6. ????????2026-11-06?

- pnpm 10.28.2 Workspaces ??? `packages/{shared,core,database,server}` ? `apps/{web,desktop}` ???????? `0.1.0`??????? `workspace:*`???????????
- ????? Turborepo 2 ? `tasks` ???? build?test?dev?lint?build ?????????? `dist/**`?dev ??????????
- TypeScript 5.9 ?? ES2022?ESNext?Bundler ??????????? `src/index.ts` ????????? JavaScript ?????? `dist/`?Web ?? DOM/React ???shared/core ??? Node ?????
- ?? dev ? TypeScript watch?lint ? TypeScript ??????test ?? Vitest??????????????????????????Vite/Electron ??????????????
- desktop ???????????? shared????? server ??? web ????????????SQLite ????? esbuild ??????? pnpm `onlyBuiltDependencies` ?????
- ?????????????????????????? better-sqlite3 ?????

## 7. Shared contracts implementation (2026-11-06)

- `packages/shared/src` now exposes enums, strict Zod schemas, inferred entity types, input DTOs and serializable application errors through its public index. It depends only on Zod and has no platform or persistence dependencies.
- Wire fields use snake_case. Questions require explicit bank/paper ownership and a positive version; six question variants discriminate on `type`. Choice answers bind UUID option identities. Strict blank answers are preserved verbatim. Manual questions have reference answers and exclude grading fields.
- Shared material is a separate ordered group of validated child questions, without introducing a seventh question type. Papers embed question snapshots, source identity/version, sections, fixed groups and shuffle settings; source following defaults to false and exists only at paper level.
- Tag relations require matching `tag_type` and `target_type` namespaces plus the corresponding concrete `entity_type`. The repository must verify the referenced stored tag namespace and target existence; schemas cannot resolve external UUID references. File tags accept only folders, banks and papers; question tags accept only questions.
- Study contracts retain paper/question snapshots, persisted order, answers, attempt indexes, timing, nullable grading and mistake source/version history. Schemas validate local references and permutations; transactional persistence, global reference integrity and state transitions remain responsibilities of later service/repository implementations.
- Verification: shared Vitest suite (32 tests) and TypeScript build pass.

## 8. Core domain algorithms (2026-11-06)

- `packages/core/src/{scoring,shuffling,timing}` expose pure domain functions through `src/index.ts`. No I/O, system clock, ambient randomness, mutable global state or persistence dependencies are used. Inputs are never mutated; returned shuffle arrays retain item/option identities.
- Scoring supports all six shared question variants through `scoreQuestion`, plus standalone single/multiple/indefinite/strict-blank functions. Multiple answers use set semantics (duplicates do not earn extra credit); any incorrect selection earns zero. Strict blanks compare verbatim at each position and accept alternatives. Missing blanks are incorrect; extra answers or empty standards earn zero. Manual question types return `{ isGraded: false, score: 0 }`. Proportional scores retain floating-point precision without presentation rounding.
- `seededRandom` is a pure Mulberry32 state transition; `shuffle` uses Fisher-Yates with explicit numeric seeds. `shuffleOptions` honors both task spelling `fixed_options_order` and shared spelling `options_order_fixed`.
- Section shuffling consumes validated shared-compatible structural inputs. Fixed groups follow the explicit ID order in `fixed_groups` and move atomically. Merged section shuffling returns display regions with `section_ids` and original item snapshots, keeping question type metadata. Material shuffling moves complete material/children objects and retains `movable: false` objects in their original slots. Callers apply paper-level shuffle switches and persist resulting orders for session recovery.
- `splitDurationAcrossMidnight` returns chronological `{ date, seconds }` entries for the half-open session interval. UTC is the deterministic default; an explicit IANA zone enables local dates and DST-aware boundaries. Effective seconds are allocated proportionally to elapsed time, with the final entry absorbing floating-point residual. Zero effective duration returns an empty array; invalid timestamps, intervals, effective seconds or zones throw `RangeError`.
- TDD verification: tests first failed against the empty implementation, then passed after implementation. Vitest V8 enforces 100% statements, branches, functions and lines on every core test run. All six workspace packages build successfully.


## 9. Database persistence milestone (2026-11-06)

- `packages/database/src/schema` defines all eleven Kysely tables and `QuarryDatabase`. Storage uses UUID-compatible text identities supplied by callers, UTC ISO timestamp defaults, integer booleans, and validated JSON text. Database rows are persistence contracts; they are not the richer shared wire snapshots.
- `repositories` exposes eight driver-independent repository interfaces and a transaction callback contract. SQLite classes implement typed Kysely CRUD, paper item ordering, tag relations, session attempts, mistake snapshots and attachment hash lookup. The factory returns `{ db, repositories, withTransaction, destroy }`; services consume the interfaces and transaction-bound repository collections.
- Content `delete` is soft deletion, and ordinary reads exclude deleted rows. Other repository deletes are physical. Higher-level recycle-bin restoration, subtree deletion, source following, snapshot capture and state transitions remain service responsibilities. Learning/mistake source identities intentionally have no foreign keys to live content so permanent deletion preserves history. Session records cascade only when their session is explicitly deleted.
- A versioned Kysely migrator initializes the schema transactionally and can run again on reopen. Every SQLite connection enables foreign keys, requests WAL and sets a five-second busy timeout. Pure `:memory:` SQLite necessarily reports `memory` journal mode; file databases use WAL.
- Composite tag foreign keys enforce stored namespace consistency. Insert/update triggers validate polymorphic target existence in the correct namespace; deletion triggers clean target relations. Question ownership is exclusive to a bank or paper. Unique session/question/attempt keys prevent duplicate completion, source/version keys distinguish mistakes, and attachment SHA-256 values are unique.
- Validation: 11 integration tests pass, including a temporary file WAL/reopen check alongside in-memory tests; all six workspace packages build successfully.
