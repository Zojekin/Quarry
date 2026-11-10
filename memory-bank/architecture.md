# 题匣 (Quarry) 系统架构设计说明书 (Architecture Specification)

## 当前实施入口（2026-11-10）

- 产品规则见 `design-document.md` 和 `frontend-current-spec.md`，本轮界面变化以current-spec为准；后端接手见 `backend-handoff.md`，区分源码核实差异、已有能力和待定方案。
- 正式前端尚未接API，`apps/web/src/index.ts`仍占位。workspace-preview是独立mock原型，不是领域仓储或HTTP DTO，正式技术栈未因原型而重新定稿。
- 业务数据经服务/仓储持久化；工作区标签和页面状态属于前端；产品元信息来自根product-info.json，版本只取根package.json，在构建期注入，不新增产品信息业务API。
- 标签颜色最新是改色即保存，无逐行保存按钮；正式颜色存储契约尚待补齐。会话草稿/显式结束/时间、筛选OR/all-none和文件夹导出差异见交接，本次未修改后端。
- 下方原型逐次记录是历史证据，含已替代的字号、选中色、设置分组、侧栏宽度和筛选；不得覆盖当前基线。

## 原型实施历史记录（保留追溯，不作为当前定稿）

- 2026-11-10最新：标签颜色改为选色即自动持久化，移除逐行保存按钮与未保存状态。成功局部更新标签及已保存提示，失败保留所选颜色并提示重新选色重试。颜色控件复用紧凑40px、共用曲率/表面/边框/焦点变量，并统一浏览器色块外壳；不重建页面。

- 2026-11-10保存反馈补齐：标签颜色行复用 `ui.js` 的 `saveFeedback`，修改后显示未保存，持久化成功后显示已保存；失败保留颜色草稿并允许原地重试。局部更新标签及反馈，不重建页面，保留焦点。反馈为临时UI状态，不写入业务存储。

## Latest study controls — 2026-11-10

- About implementation is complete. Root `product-info.json` owns name/English name/description and optional author/project/contact metadata. Root `package.json` remains the sole version owner. The preview host injects these public fields as read-only `/product-info.js` at startup, equivalent to build-time data injection rather than a business API; no mock DB/localStorage coupling is introduced. Formal app builds still need their own build-stage adapter.
- `pages/about.js` renders the shared transparent logo, product identity, version and description, replacing the old tagline/data-space block. Optional author/links appear only when populated; metadata is escaped and links are restricted to HTTP(S), plus mailto for contact. Styling uses existing typography/spacing tokens. `serve.mjs` allowlists the dedicated renderer and serves the generated ES module without new dependencies.
- `.oil-ui/quarry-about` verifies root-version integration, omitted empty metadata, optional link/author branches, escaping/protocol handling, reload,850px screenshots and no page errors. Main-agent visual inspection, selector/token audit, JS syntax and web no-emit pass. Author/contact/project values remain intentionally empty until supplied.

- Latest settings trim removes the entire reading/interface section from the settings view (font-size, collapse preference and static appearance rows), while existing reading preferences and the shell collapse button remain compatible. Tag explanation is grouped directly under its heading with an8px gap. Tag-color namespace/save state remains unchanged. Screenshot, save/reload,850px and no-emit verification is in `.oil-ui/quarry-settings-trim`.
- About content is intentionally pending discussion: user chose product plus author/contact/project information. Product identity/author/links should be repository-owned product metadata rendered by the UI, rather than business database rows or an extra backend service. Exact metadata location and author/link values are not yet implemented; the prior about block remains until this discussion is resolved.

- Post-migration annotations set library list filenames to17px/500 (card titles remain20px), with equal32px heading/filter/result gaps. The heading helper accepts an escaped optional layout class, keeping this spacing page-scoped. Tab close is a borderless40px icon target with focus retained. Study pause/finish now share equal-width40px compact geometry; exam submission retains its primary color.
- Settings has three labeled sections48px apart and no row separators. Reading preference, collapse and tag-color state boundaries remain unchanged. The stale tag-outline description is corrected. Evidence `.oil-ui/quarry-finish-review` covers six annotation assertions, reading/tag-color reload,850px layout, source/token audit, persistence/failure regression and no-emit. Independent visual review `/root/finish_visual_review` found no required fix, with optional color-picker-shell polish. Independent UX `/root/finish_settings_ux` changed reading size, verified it in real practice and after refresh without blockage; optional local reading preview/save feedback is recorded. Reports are in that evidence directory; no numeric score or extra implementation of review suggestions.

- Full-page visual-system migration is complete in `apps/web/workspace-preview`, superseding the earlier preview-only typography status. `VISUAL-SYSTEM.md` is the current implementation contract; `styles.css` owns one semantic token set and one exact-selector definition per media context, with base rules before centralized responsive variants. Repeated legacy sidebar/card/action/type overrides and retired folder/property-panel styles were consolidated. No framework, backend or dependency change was introduced.
- All ten page families now use15/17/20/28/48px roles and400/500/600/700 weights. Regular action buttons share17px/500 and48px geometry, compact/icon actions40px. Inputs/selects/search/pills/tables/cards/options consume shared definitions. Document cards and the mistake preview explicitly reuse `.card`; static inline presentation was replaced with shared classes. Only tag appearance, progress percentage and user-selected reading size remain runtime styling data. New reading defaults to20px while existing preferences are retained.
- `#/components` now previews the same live button, option, input, select, checkbox, switch, pill/status and table primitives. Palette/state, spacing, radii/shadows and typography are centrally tokenized. Page rules own layout differences. No duplicate exact selector within a media condition or undefined static token reference remains; static CSS has no literal font-size declarations outside roles and reading preferences.
- Evidence `.oil-ui/quarry-unify` includes baseline/current screenshots for1703x871 and850x871, actual computed five-size/normal-button assertions, token/selector source audit, no-overflow/error-screen checks, and form/dialog states. Main-agent syntax/web no-emit and page/practice/exam/draft/redo/persistence/failure/filter/editor/manual/blank checks pass. Independent visual review `/root/unify_visual` identified the narrow study grid cascade issue; responsive order and a stack assertion were corrected, and the focused visual recheck closed it. No numeric rescore. Independent UX `/root/unify_ux` completed practice through saved results; its note about unconfirmed draft navigation is recorded in `.oil-ui/quarry-unify/ux-review/report.md`. Previously user-confirmed 查看答案 commit/lock and navigation-draft semantics are preserved rather than changed during visual migration.

- Typography specification now uses15/17/20/28/48px. Shared weight roles are400 prose/questions/numbers,500 controls/navigation/file names/pills,600 headings/table headers/form labels/grading results, and700 reference/explanation headings/mastery actions. State changes do not change weight. Specification screenshots, computed size/weight assertions,850px layout and no-emit pass. Legacy page-wide migration remains a separate consolidation step.

- Latest color discussion replaces pending pale-green selection with warm paper-derived beige#EDE5D0, ink#62563C, border#C9BB96, owned by semantic selection tokens. Correct green and wrong red remain grading-only. `/components` provides an internal specification preview using existing option/button primitives and five candidate typography roles14/16/20/28/48px. Typography roles are previewed, not yet applied across the legacy stylesheet; full consolidation follows visual confirmation. Browser screenshots/checks at `.oil-ui/quarry-warm-selection` verify the palette distinction, five roles, live study selection and850px layout; syntax/no-emit pass.

- Removes the inner question/response divider and the redundant choice-answer prompt, preserving column spacing and responsive stacking. Pending chosen options now use pale pine#E1EBDF, ink#315C47 and border#B9CDB7; graded correct/incorrect styles retain precedence.
- Practice actions use one shared left slot for a surface-colored 查看答案 or 重新作答. Previous/next stay right, with next using the pine primary style and the existing last-question disabled state. Attempt counts are no longer rendered; redo history and commit/lock semantics remain unchanged. Non-graded questions retain the separate manual mistake action.
- `.oil-ui/quarry-study-controls` verifies screenshots, control position/color, no divider/prompt/count, redo/reload and retained blank/manual behavior at1703px/850px. Existing persistence/failure/navigation regressions, JS syntax and web no-emit pass. This explicit local annotation pass is self-reviewed.

## Previous preview refinement — 2026-11-09

- Latest scoped annotations flatten answer options by removing gradients and raised/inset shadows while retaining pending yellow-green and graded red/green. Feedback is SVG-only visually, with accessible labels for correct/wrong/missed states. Practice score/status is fused with type metadata at the upper right; it is not repeated below options.
- Study/result solution rendering separates reference and explanation into content-sized panels with24px gaps, equal vertical padding and bold headings. Choice questions omit the redundant reference panel because graded options already show the answer; non-choice questions retain reference content. This change is scoped to study/results, not the mistake preview's read-only question renderer.
- Records removes only its aggregate session/completed/ongoing strip; filters and row progress remain. All shared table header backgrounds have square corners and ink-colored labels while retaining the previously corrected cell insets.
- Self-reviewed screenshots and checks in `.oil-ui/quarry-flat-answers` cover choice/strict-blank/manual panels, equal padding/gaps, header-only score/status, icon-only feedback, flat surfaces, record-strip removal, table headers and850px layout. Existing page, persistence/failure, split/redo/multi-choice and exam conceal/reveal checks plus syntax/web no-emit pass. User-specified local refinements did not trigger a new independent rescore.

- Latest confirmed study layout uses a full-width paper card with45/55 question/response columns above1000px and natural stacked flow below. Metadata spans the card; actions and revealed analysis belong to the response column. Short parenthetical notes remain together when space permits, without changing stored text. A wide-screen question stem follows document scrolling within its card so the revealed analysis remains comparable; there is no internal scrolling surface.
- `answerFields` derives pending/chosen/revealed styles from the existing attempt/lock boundary. Pending choices are yellow-green#E2E8B3 with dark ink; graded correct options are green, chosen incorrect options red, missed correct options labeled漏选. Real SVG check/close marks accompany feedback. Redo removes old feedback; completed result details reveal the answer options including unanswered questions. Exams expose no correctness classes/feedback before submission. Existing 查看答案 commit/lock semantics and draft-only navigation remain, as previously requested.
- Mistake inspector is an explicit white题目预览 surface with SVG eye heading, source/type, question, inset answer/analysis and separate error history; it stays in document flow. Shared tables inset first/last cells20px, matching header and body. Record statuses use SVG icons and the same30px capsule height/padding as modes. Tag selection no longer adds decorative outlines, while keyboard focus remains visible. Library grid actions have no top divider.
- Evidence `.oil-ui/quarry-study-split` covers actual1703px/850px screenshots, selected/revealed/redo/reload, multi-choice missed/wrong states, exam conceal/reveal, unanswered result feedback, stem visibility after automatic scrolling, SVG capsules, table insets and preview flow. Existing page/practice/exam/save-failure and manual/blank editor checks, syntax and web no-emit pass. Independent visual review `/root/split_visual_review` found one short-note wrap issue, corrected; no numeric score. Independent UX `/root/split_ux_review` completed practice through saved results, identified the hidden stem on analysis reveal (fixed and verified), and noted the retained user-chosen 查看答案 confirmation semantics. Report: `.oil-ui/quarry-study-split/ux-review/report.md`. No production API integration is added.

- User-confirmed filter presentation supersedes the earlier two-line category/value cards. Library, bank, mistakes and record-mode filters share one48px row: unrestricted shows only the category; constrained shows selected values with background#E1EBDF, ink#315C47 and border#B9CDB7. Long selections truncate visually with a complete category/value title and a stable accessible category label. Original tag colors remain in menu options and content pills. Explicit empty selections remain visibly active as 未选择.
- Bank has only question-type and question-tag facets. The removed date constraint is ignored even when an older tab view contains dateStart/dateEnd, preventing an invisible filter after reload. Mistake dates remain supported with the same category/value/tint states; all-values selection restores the category appearance. Non-filter editor/settings selects retain their ordinary values.
- `.oil-ui/quarry-filter-style` verifies category/value/tint/reset states, all/individual checks without replacing the menu, date apply/clear, refresh persistence, two bank facets, legacy-date compatibility and850px layout. Main-agent screenshots were inspected; syntax and web no-emit pass. This is a scoped refinement, without independent rescore.

- Latest annotations supersede exclusive unlimited facets: every multiselect now uses inclusive all/none; all individual items remain checked when all is checked. Filter changes patch only the marked result region, retaining native select, trigger, popover, focus and scroll identity. No menu reopen or repeated entry animation occurs. Hidden bank/mistake selections are trimmed consistently with composition.
- Bank pages reuse question-type, question-tag and modification-date filter cards with one shared question projection for rows/select-all. Editors record actual question modification timestamps; undated legacy mocks are excluded by a bounded date range, rather than assigned invented dates. Breadcrumbs sit beside navigation controls with explicit separator spacing.
- Shared table headers use a tinted surface. Records use mode capsules and status icons; paper source-follow uses green/red dot capsules. Paper labels read 总分/考试时间, file tags use body-sized text without changing padding, type headings include question count and score, and the plus has a hover surface. Mistake facets remain within the left result column; search aligns to the inspector column, stacking responsively.
- Self-reviewed real browser evidence: `.oil-ui/quarry-detail-polish`. Checks cover unchanged popover identity/toggle count through multiple selections, all/individual synchronization, empty-result recovery, date filtering, hover styles, labels, status/tag presentation, column geometry and 850px overflow. Existing page/practice/exam/persistence/save-failure checks, JS syntax and web no-emit pass. No production API, new framework or numeric review score is claimed.

> **版本**：v1.0.0  
> **基准依据**：`memory-bank/design-document.md`、`memory-bank/tech-stack.md`、`AGENTS.md`  
> **适用范围**：指导全系统模块划分、依赖流向、仓储抽象、数据协议与编码实现

---

## 1. 架构总览与核心设计原则

“题匣 (Quarry)”是一款个人离线题库与套题管理、答题及错题复习桌面软件。系统整体架构遵循 **“简单、健壮、高度解耦、全链路类型安全”** 的设计原则，采用 TypeScript 端到端同构的 pnpm Monorepo 拓扑。

### 当前前端信息架构（2026-11-07）

- 默认首页为学习看板，展示练习量、去重题数、学习用时、每日热力图、待复习错题概况与继续未完成答题入口。
- 一级栏目为首页、资料库、错题本、学习记录；另提供回收站与设置，不重复设置独立的学习看板栏目。
- 资料库用单主区域列表/图标管理文件夹、题库、套题及其所属题目；按2026-11-09批注移除内层文件树侧栏，文件标签移到分段切换下方，文件夹通过主区打开/返回。不新增全局题目仓库，答题仍须来自保存的套题。
- 第13至15节为历史探索，不能作为当前首页职责的依据。已有预览尚未按本次信息架构调整；本次仅更新文档，不修改后端契约或业务规则。

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

## 10. Server framework milestone (2026-11-06)

- `packages/server/src/app.ts` exports `createQuarryServer({ db, repositories?, attachmentsDir? })`. It creates a standard Hono instance without starting a listener or taking ownership of database cleanup. The composition root supplies default SQLite repositories; callers can inject alternative implementations. Request context exposes repository interfaces and optional attachment configuration.
- Health routing is isolated in `routes/health.ts`. `GET /api/health` runs a portable Kysely constant-select connection probe and returns `{ success: true, data: { status, version, timestamp, database } }`. Business routes should consume repository interfaces rather than database drivers.
- Global Hono error handling wraps `AppError.toJSON()` in `{ success: false, error }` and preserves its HTTP status. Unknown failures return HTTP 500 with `INTERNAL_SERVER_ERROR` and a generic message; missing routes return HTTP 404 with `NOT_FOUND`. Error objects contain code, message, details and statusCode.
- CORS accepts HTTP/HTTPS origins on localhost, 127.0.0.1 and IPv6 loopback, including variable development ports. It grants no access-control origin to other hosts or opaque origins.
- The public index exports the app factory, options/environment types and inferred `AppType`. Chained route registration retains Hono RPC endpoint inference. Twelve in-memory SQLite integration tests cover this contract; all workspace builds and tests pass.

## 11. Phase 1 Batch A: content API and source following (2026-11-06)

- Hono mounts `/api/{attachments,folders,banks,questions,tags,papers}` as independent route modules. Services use injected repository interfaces and shared question/section/tag contracts with `AppError` validation. Request input defaults, persistence conversion, ownership validation and versioning are centralized in services. See `packages/server/README.md` for endpoint bodies and composition conventions.
- Content mutations run through an injected `withTransaction` callback. The default composition root creates SQLite transaction-bound repositories; custom repository adapters must supply their matching runner for content writes. Services never access the database driver or issue SQL. Folder moves detect ancestor cycles; subtree deletion soft-deletes owned content while retaining learning history.
- `IAttachmentStorage` separates binary storage from attachment metadata. The local implementation publishes complete SHA-256 files using temporary files and atomic hard links, deduplicates concurrent uploads, and opens streams before responding so missing content returns 404. Storage can be injected; virtual attachment responses expose no absolute path.
- `TagService` validates stored namespaces and concrete target existence before mutation. File tags and question tags are isolated on writes, relation attachment/detachment and filters; no inheritance occurs. A request-local relation index avoids repeated relation queries for every listed entity. Questions use all six shared variants and same-owner, cycle-checked material parent links.
- Migration `002_batch_a_content` adds `papers.composer_json` (validated JSON text) and nullable `questions.material`; existing rows receive compatible defaults. `IPaperRepository.updateItem` supports source/version flags and composition changes without replacing item identities. Composer metadata records section UUIDs/type/title, per-section shuffle settings, ordered fixed groups, merged sections and material shuffle settings; item rows retain their ordering/group assignments.
- Paper composition clones bank questions and their material ancestry, retaining source question/version, while inline questions receive paper ownership. Section type consistency, unique IDs, nonoverlapping ordered fixed groups, merged-section references and atomic ordered material siblings are validated transactionally. Item removal repairs fixed groups and section order.
- Follow preview compares stem, options, answer identities/blank standards/reference answers, analysis, effective material and question tags. Applying enabled following updates snapshots and source versions atomically, preserving selection/item identities, order, composition and paper/question scoring rules. Missing source questions or banks mark items invalid without losing content; unchanged reapplication does not increment snapshot versions. Source type changes require explicit recomposition and reject follow application transactionally.
- Verification: 36 server integration tests (24 new), 95 total workspace tests, and all six workspace builds pass. Tests cover binary/MIME streaming and deduplication, folder trees/cycles/subtree deletion, six question variants, tag isolation, material ownership/order, composer rollback/groups, injected transactions and source following/deletion/idempotence.

## 12. Phase 1 Batch B: sessions, review and data recovery (2026-11-06)

- Independent Hono modules mount `/api/sessions`, `/api/mistakes`, `/api/analytics`, `/api/trash`, and `/api/{import,export,backup}`. Mutations use transaction-bound repositories; the composition root also accepts an independent `ISnapshotRepository` and `recoveryPointsDir`. Injected repository implementations require a matching snapshot adapter for backup operations.
- Migration `003_batch_b_study` adds persisted session `state_json`, mistake `history_json` and logical paper-item `historical_source_question_id`. Session state captures paper/question/scoring snapshots, deterministic order/seed, timezone, pause timestamps and daily metrics. Exam answers remain concealed until completion; practice submissions reveal solutions and lock their immutable attempt index. Explicit next indexes retain earlier attempts. Exam blank result records are retained but excluded from answered counts.
- Session completion calls core `splitDurationAcrossMidnight`, deducting persisted pause durations. Daily duration allocations live in session state; analytics aggregates them with completion records and deduplicates logical source identities. Completed-session reattempts add completion records without reopening the original duration interval; a new session starts a new timed interval.
- Mistake capture merges identical source/version identities, stores answer history, and resets automatic errors to reviewing. Manual question capture is idempotent by study record. Review paper creation preserves historical content/version independently of live source existence and tolerates deleted tags without changing historical snapshots. Source identity survives purge for future sessions and deduplicated statistics.
- `ISnapshotRepository` isolates full-table capture/replacement from server services. SQLite captures all eleven tables, including trash and study history, and replaces them in a foreign-key-checked transaction. Backup ZIPs contain a versioned checksum manifest, database JSON and SHA-256 attachment blobs. Restore writes a recovery archive to disk before mutation; attachment uploads occur before database commit, and failures roll back rows and remove newly written blobs. Existing blobs remain available for recovery. Recovery storage defaults to the OS temporary directory's `quarry-recovery` folder and can be configured for durable application storage.
- Content import/export uses a strict versioned portable JSON document and a Markdown template containing that document. ZIP `.quarry` exports bundle referenced attachments. Schema and reference validation reject the entire document, with path/line diagnostics; commits repeat validation and create new identities transactionally. Paper exports preserve composition and shuffle/scoring configuration. `fflate` supplies ZIP encoding/decoding.
- `ITrashRepository` exposes deleted content without weakening ordinary live-only repositories. Migration `004_batch_b_trash` adds deletion batch identities; cascading soft deletion shares one token per transaction. Restore revives the matching subtree and required ancestors while preserving earlier deletions. Purge removes content in foreign-key order, retaining paper copies, logical source identity, study records and mistake snapshots.
- Verification: 57 server integration tests, 116 workspace tests and all six package builds pass. Tests exercise strict whole-file rejection and source-line diagnostics, immutable attempt/snapshot recovery, historical review after purge, same-batch restoration, full backup restoration and real partial attachment-write rollback.

## 13. Frontend desktop design exploration (2026-11-07)

- The user selected React 19 + Tailwind CSS + HeroUI for `apps/web`; this supersedes the older shadcn/ui label in the topology above. Framework installation and product implementation have not yet started.
- Three independent desktop-first visual candidates explore the same file-manager domain: a wide library list with a resume strip, a three-pane list and paper inspector, and a dark icon workspace with a resume dock. All retain folder navigation, separate file/question tags, and saved-paper-only study entry.
- Exploration is isolated in `.oil-ui/quarry-desktop/`: static 1440×900 HTML candidates, a manifest, an offline self-contained comparison page, and screenshots. These are design artifacts, not application modules or a second design system. No production code imports these files, and no API or persisted-state behavior is claimed.
- Subsequent React work should implement the selected direction through a shared application shell, feature modules and a single BackendClient. Shared domain entities must be mapped against actual HTTP responses rather than assumed to match every route payload.

## 14. HeroUI five-layout preview (2026-11-07)

- `apps/web/design-preview` is an isolated visual-preview package using React 19, HeroUI React/Styles 3.2.7, Tailwind CSS 4 and Vite. Its own npm lockfile avoids rewriting the existing workspace's pnpm links, which currently refer to a different mirrored workspace path. The parent web package remains unchanged.
- `src/data.ts` owns common mock content; `src/components.tsx` composes actual HeroUI Button, Card, Chip, SearchField, Table and ProgressBar components; `src/layouts` contains five independently styled layout compositions. All five share one visual language and differ in navigation/content/detail placement.
- `public/comparison.html` is the generated comparison shell, serving the five `/?layout=1..5` views from the local preview server. It has no dependency on process files at runtime. Screenshots and design notes remain in `.oil-ui/quarry-heroui-five`.
- These are layout candidates, not connected product features. No BackendClient, storage, scoring, business navigation or session state is implemented in the preview. A selected layout can later be integrated into the main web frontend without introducing Electron or database dependencies.

## 15. Fresh frontend style exploration (2026-11-07)

- The latest user instruction supersedes previous frontend stack decisions for this exploration. No production framework is selected in this milestone. Existing React/HeroUI previews and earlier architecture entries remain historical records.
- `apps/web/style-lab` contains three independent, standalone HTML/CSS first-screen candidates: cinnabar archive (file list), cobalt folios (four-column cover grid), and berry study room (file management alongside a saved-paper session). An offline self-contained `style-explorer.html` embeds all three and supports comparison/selection. `node apps/web/style-lab/serve.mjs` serves only explicit preview artifacts on `127.0.0.1:4175`.
- `content.json` centralizes the same three folders, three banks, three papers and unfinished practice session for fair comparison. The existing SVG logo is reused. Shared schema/DTO/enums were inspected; counts and session summaries are display projections, not invented wire fields. Banks have no direct practice action, session navigation conceals correctness, and displayed tags belong to the file namespace.
- These are fixed 1440×900 static design candidates, with no application behavior, BackendClient, persistence, scoring, animation or responsive implementation. Subsequent implementation must preserve host/API/storage separation and verify actual HTTP payloads.
- Concepts and grayscale structure passed an independent review. Main-agent screenshot inspection corrected below-fold content; all three final screenshots show no horizontal overflow, clipped headings, offscreen content rows, broken images or page errors. Evidence and generator remain in `.oil-ui/quarry-style-lab`, with no runtime references from delivery files. No production build or full test suite was required.

## 16. Learning-home visual exploration (2026-11-07)

### A direction refinement (2026-11-08)

- Latest shell annotation overrides the earlier rail branding: collapsed rail hides the logo and keeps only the expand control in its header, vertically aligned with the main title; navigation/utility icons remain. The activity year is grouped beside “日积月累”, with metric controls on the right. Direct/embedded sidebar and activity interactions pass, including0px collapsed-control/title alignment error.

- Review follow-up preserves the existing visual direction and open mistake summary. `activity.js` adds presentation-only answer-count/duration switching with accessible pressed state, animated selection plate and reduced-motion support. Day cells expose both values in hover titles and distinguish future dates. The generator's mock `daily_activity` projection sums to the displayed1,284 answers and116,280 seconds; no backend contract or API is changed.
- Supporting text contrast/weights are strengthened through shared tokens; the mistake action now reads “去错题本选题” to clarify the selection step. Mouse/keyboard/embedded-preview switching, sidebar behavior,100% screenshots,200% key-region inspection, syntax and web no-emit checks pass. Evidence is in `.oil-ui/quarry-dashboard/shots/polish/`. Oil UI was updated to0.33.2 and reread. Independent follow-up review could not complete due to tool usage quota; main-agent visual inspection is complete.

- The latest collapsed-sidebar behavior retains a72px icon rail with its transparent logo, expand button, navigation and utility icons; it does not hide the entire sidebar or make it inert. Sidebar script preserves labels/tooltips and focus handling. All A paper cards now share an equal-width layout, surface/shadow tokens and the same green resume action. Direct/embedded expand-collapse checks and web no-emit pass.

- Latest annotations keep role-based typography in `ui-primitives.css`: 14px detail/status/progress/time labels and 16px action/review-list labels. Shared superellipse radii increase to36px for surfaces and20px for controls. The A-only paper renderer removes English ordinals, moves category paths into the top row and removes resume arrows. A embeds the separately preserved green-only transparent SVG; B/C retain the original logo. Sidebar button borders are removed. Display, asset, geometry and interaction checks plus web no-emit pass.

- Subsequent annotations are implemented through `apps/web/dashboard-lab/ui-primitives.css` (shared superellipse curve, surface/control/cell/track radii and shell geometry) and `sidebar.js` (preview-only collapse/expand, Esc and focus management). The generator embeds both into A, and marks A interactive so offline comparison preserves behavior; B/C remain static.
- User-selected A colors are #F9F9F7 background, #F9F9F9 surfaces and #386450 accent. Two section gaps measure42px, title/logo centers align, and navigation keeps its background size/padding with larger type/icons. Native Edge superellipse rendering, direct and embedded shell interactions, no-overflow checks and web no-emit pass. Evidence is in `.oil-ui/quarry-dashboard/shots/shell/`. Older browsers retain ordinary-radius fallbacks; the shell has no API or persistence dependencies.

- User-approved annotations refine A only: ordered metrics are duration, cumulative answers and deduplicated questions. Metric explanations, sidebar ornament, heading English and review explanatory copy are removed; the review heading is “复习错题” and the activity heading retains only its year.
- A uses bundled official Source Han Serif CN variable WOFF2 for Chinese headings, English and display numerals; operation labels retain sans serif. `apps/web/dashboard-lab/fonts` contains the unchanged font, SIL OFL license and source notes. The allowlisted preview server serves fonts with their correct MIME type; the comparison generator embeds this font for offline use and retains its license text.
- Framework and backend boundaries remain unchanged. Browser font inspection confirms the custom font for headings, English and numbers; 1440×900 inspection, web no-emit and server syntax checks pass. Evidence for this self-reviewed local refinement is in `.oil-ui/quarry-dashboard/shots/refinement/`.

- `apps/web/dashboard-lab` explores the current learning-dashboard home. Three standalone HTML/CSS candidates share learning data: 松间案台 (sidebar, paper folios, annual matrix), 蓝图仪表 (top navigation, metrics, activity matrix and task column), and 朱砂轨迹 (vertical session trail and twelve monthly calendars).
- The latest user instruction supersedes prior frontend stack decisions. No production framework is selected. The parent web package, backend contracts and previous preview directories remain unchanged; this exploration has no new dependencies, BackendClient or persistence.
- `style-explorer.html` embeds candidates for offline comparison. `node apps/web/dashboard-lab/serve.mjs` exposes only allowlisted preview files at `http://127.0.0.1:4176/`. Delivery files have no runtime dependency on `.oil-ui`.
- Shared schemas/DTOs/enums/errors were read; analytics fields were checked against `/api/analytics/dashboard`. Progress and subject aggregates are display projections. All content is mocked. Resume actions refer to saved papers; mistake review requires filtering and saving a review paper before study.
- Concepts and grayscale passed independent review. Main-agent inspection corrected overflow and duration wrapping. Final 1440×900 checks report 900px page heights, no horizontal overflow, clipped headings/buttons, broken images or checked content below the viewport. Web TypeScript no-emit and server syntax checks pass. Evidence is in `.oil-ui/quarry-dashboard/shots`. Static exploration does not include responsive implementation, business interactions or animation; no visual score, production build or full test run is claimed.

## 17. Unified frontend page prototype (2026-11-08)

- `apps/web/workspace-preview` extends the approved A direction into navigable pages at `http://127.0.0.1:4177/`. The existing4176 comparison remains available. No production framework is selected or backend API connected in this milestone.
- `app.js` owns shared shell/routing/timing, `styles.css` owns visual tokens/superellipse controls, `ui.js` owns escaped content/dialogs/common controls, and `store.js` owns isolated localStorage mock persistence. Page modules separate content management, sessions/results, learning history/mistakes and home. These display projections are not shared HTTP DTOs; no database/Electron dependency is introduced.
- Pages include library/folders/list-grid, bank selection/question form, paper composition/details, practice, exam, results, mistake filtering/history/mastery/review-paper creation, records, settings and recoverable trash. They share the transparent logo, bundled serif, pine accent and72px collapsed icon rail without header logo.
- Mutations clone/save before publishing state. Paper/session snapshots preserve content and stable option identity. Practice confirms before grading and retains redo attempts; exam conceals answers until submission; pausing masks and inerts the background. Pending result URLs return to study. Mock timer/scoring/JSON import are demonstration adapters, not replacements for server semantics. Full Markdown/math/material/attachment/source-follow integration remains future work.
- Independent visual review (`/root/pages_visual_review`) rated initial screenshots8/10 and verified follow-up title, inspector and heatmap refinements. Independent UX review (`/root/pages_ux_review`) completed practice through results; one-click resume and sticky next-question controls address its minor findings.
- Browser checks cover persistence, concealed exam answers, review-paper save/reload, filtered bank composition, mastery reload, trash restore, failed-save context retention, pending-result routing and1440/850px overflow. JS syntax and web TypeScript no-emit pass. Evidence is under `.oil-ui/quarry-pages`, without delivery runtime dependency. No production build or full repository tests were run for this isolated preview.

### Annotation refinement (2026-11-09)

- Library is a single content area: no inner folder rail, file-tag filters under shared segmented type controls, stable colored tag chips, icon-only view switching and explicit export/delete actions in list/grid. Secondary actions use the existing light surface. Paper properties sit below its title without a right inspector. Mistakes reuse the home card surface, curve and shadow; record statuses use distinct muted colors.
- Shell workspace tabs track visited sections/documents with switching, closing and sessionStorage restoration; library stays available, per-page search survives navigation, and detail back actions return to the last library folder. Tabs store no business document data.
- `ui.js` enhances native select values with reusable styled triggers, top-layer listboxes, selected indicators, arrows/Home/End/typeahead, Escape/outside dismissal and focus restoration. This follows HeroUI Select's presentation and interaction structure in the vanilla preview; it does not install or render the actual React component. No runtime dependency or backend change.
- Main browser checks cover tags, tab switching/closing/reload, paper settings reload, folder return, export, delete/cancel/restore and keyboard selection. Desktop1703x871 and850px overflow checks and an enlarged effective viewport check pass. Existing practice/exam/save-failure checks, syntax and web no-emit pass. Evidence: `.oil-ui/quarry-annotations`.
- Independent visual refinement review found no rework issue; no numeric rescore. Independent UX (`/root/annotation_ux`) completed practice through results. Its minor analysis/action-bar overlap is addressed by bringing the confirmed analysis into view with reserved bottom scroll margin. This remains a mock-data prototype.

### Explicit workspace-tab behavior (2026-11-09)

- Latest annotations supersede visit-driven tabs: ordinary routes replace the active tab; only the backgroundless plus creates another tab, initially home. Tabs have independent UUID identities, so the same route can exist twice without merging state. The top row now contains detached card-like tabs with a gap to its divider; the old title/date header and its divider are removed. Page titles live with their content.
- `quarry-workspace-tabs-v2` in sessionStorage stores tab identity, active tab, per-route search/filter/selection/scroll views and each tab's last library folder. This is presentation state only; business data remains in the mock repository. Legacy visit-generated tabs are not reused. The final remaining tab has no close control. Arrow/Home/End navigation is available on the tab strip.
- Search controls share a capsule surface; segmented controls have reduced internal padding and include the home activity metric switch. Checkboxes preserve native form, keyboard and mixed-state semantics with shared HeroUI-style rounded control/checkmark/disabled/focus presentation; no React component installation is claimed.
- Main-agent screenshots and checks are in `.oil-ui/quarry-tab-behavior`. Tests verify ordinary navigation keeps the tab count, plus-only creation, independent same-route state, close/reload, mixed checkbox/Space behavior and top-card geometry at1219x667 and1703x871. Previous page, practice/exam, save-failure and annotation checks plus syntax/no-emit pass. This explicit annotation pass is self-verified, not independently rescored.

### Editing and study refinements (2026-11-09)

- `editors.js` isolates file-property and six-type question editors. Bank/paper fields cover name, description and file tags; paper adds exam duration and a source-follow switch with diff preview. Questions expose content/options/correct or reference answers/explanation/score/question tags, preserving option identities and incrementing versions. Paper-local edits change its snapshot, not the bank. Following papers clearly identify source editing. No real API integration is claimed.
- The mock repository projects enabled source updates while preserving paper scores and existing session/mistake snapshots. Disabling freezes current content; deleting source content first preserves latest followed snapshots. Changed source types require recomposition. Creation dialogs own the shuffle setting; detail uses one vertical property list with timestamp and tags.
- Tabs are sticky; back/forward/home use independent per-tab history. Home has no mistake-review column. The study rail is280px (responsive240px), contains clock/pause/finish and retains its72px collapse control. Selected answers use pine/white. User-confirmed nav colors: answered#526A5B, current#2F6B50 plus outer ring, unanswered light surface; current wins.
- “查看答案” retains submit/lock semantics. Removed fixed/locked/instruction copy and enclosing action card. Navigation remains outside the question card without overlap; editor section links reveal explanation/score/tags without losing input.
- `.oil-ui/quarry-editing` verifies refresh persistence, option IDs/versions, source vs paper isolation, old sessions, follow preview/freeze/deletion, manual and verbatim blank questions, validation, failed-save retention, creation-only shuffle, history/sticky tabs/rail/colors and850px layout. Existing session/exam/tab checks plus syntax/no-emit pass. Independent visual review/follow-up (`/root/editing_visual`) found no remaining visible issue; UX (`/root/editing_ux`) completed practice/pause/records/resume. The requested view-answer wording keeps its submit semantics, clarified by tooltip without reintroducing removed instructions.

### Filing and mistake-card annotations (2026-11-09)

- Latest annotations restore the home mistake summary and supersede the previous removal. Library projection now uses direct folder ownership at root and nested levels; nested banks/papers are not flattened into root. Folders remain navigable while file-type filters are selected.
- File/question tag editors canonically display English-comma-separated tags while retaining tolerant parsing. Shared stopwatch formatting is MM:SS, switching to HH:MM:SS above an hour. Practice mode joins the clock/actions in the rail. Desktop study width is192px, matching management, with72px explicit collapse; narrow study views retain an expanded192px option for usable question navigation. Answered-color token is#818E7E across breakpoints and legend; current remains the chosen pine plus ring. Selected answer surfaces gain subtle raised/inset shadows.
- Paper question tools provide local content/analysis/tag search, a backgroundless plus menu for a new inline question or bank selection, and sans-serif type headings. Preview indexes retain original paper positions after filtering. Editor jump links are removed without removing fields or draft behavior.
- Mistake rows show source paper name plus question tags, right-aligned two-line error/date metadata and a bold green mastery action “斩” (reverse “复”). Detail is normal document flow. New mistake histories capture the actual submitting session's paper identity/name instead of guessing another session containing that question; legacy records retain a fallback. This preserves tag namespace separation and historical names.
- Main-agent screenshots/checks under `.oil-ui/quarry-filing` verify folder hierarchy, paper search/create/reload, tag canonicalization, mastery/reversal persistence, source identity, inspector document flow, home restoration, stopwatch boundaries, rail geometry/colors and850px overflow. Existing session/exam/tab, manual/blank/save-failure checks plus syntax/no-emit pass. This explicit annotation pass is self-reviewed; no new independent rating.

### Page-scoped filter and appearance refinements (2026-11-09)

- Mistake header statistics move beside its title; only this page replaces its filter toolbar with five independent facets (paper/folder/question-tag/type/date) under the mastery segment, with right-aligned search. Shared `filteredMistakes` drives rendering, select-all and review composition. Dimensions combine with AND, values within a dimension with OR; dates are inclusive and folders include descendants. New filter results trim hidden selections before rendering and saving.
- Library alone uses type/file-tag dropdowns. Type retains explicitly requested inclusive select-all; other facets use an exclusive unlimited “全部” state so the first concrete choice selects rather than unexpectedly excludes. `enhanceSelects` supports native multiple values, top-layer listboxes, all/select-none, keyboard navigation and focus restoration while rerendering.
- Tag appearance now has one owner in mock settings, separately keyed by file/question namespace. Preset colors remain deterministic fallbacks. Settings exposes per-tag color saving; pills, table tags and selected filter chips use the same appearance, preserving hue and adding an outline. No tag-renaming or production tag API is claimed.
- Folder controls now support property edits, subtree JSON export, confirm-before-trash and restoration. Trash batches preserve only currently live descendants; restoring a parent does not revive an earlier independent deletion, and missing-parent restoration reports the required recovery order. Folder import validates structure/references and regenerates folder/file/question/option identities. This is the preview archive format, not the formal Quarry importer.
- Desktop shell and study rails now both280px, collapsed72px, superseding192px. User clarified removal of only the main study title: the rail retains its paper name. Bottom progress copy is removed; the final next button is disabled and finish remains in the rail. Home has a reserved hover-only layout pencil; records alone removes the row subtitle count and renames its mode default to全部. Shared menu item spacing is increased.
- `.oil-ui/quarry-filter-panels` records real screenshots, persistence/keyboard/filter-combination/date-validation/color-failure/folder-roundtrip/nested-restoration checks and850px overflow checks. Session/exam and existing save-failure regressions plus syntax/no-emit pass. Independent visual review (`/root/filters_visual`) found no visual blocker. Independent UX (`/root/filters_ux`) exposed default-all exclusion and hidden selection problems; both were fixed and its focused retest passed. No numeric rescore or backend integration is claimed.

## Phase 1.5 backend contracts (2026-11-10)

- Migration `005_phase_1_5` adds nullable tag colors, session position/drafts and immutable source paper/name/folder columns on study and mistake records. Existing history is backfilled from persisted session paper snapshots, never from renamed live papers. Generic typed repository create/update operations persist these fields without adding driver dependencies to services.
- `POST /api/tags` accepts `color: "#RRGGBB" | null`; `PUT /api/tags/:id` accepts optional name/color and preserves namespace. Colors travel with portable question tags and full backups; folder exports also include file tags/relations.
- `POST /api/sessions/:id/draft` accepts `{current_index?: number, question_id?: UUID, user_answer?: StudyAnswer}`. Position is zero-based. GET returns `current_index` and `draft_answers` keyed by question ID. Drafts validate question/option identities, have no study/statistical/mistake effects, and reject overwriting submitted practice questions. Exam drafts remain editable before submission and reveal no solutions.
- `POST /api/sessions/:id/complete` explicitly completes practice and returns the session plus distinct `answered_count`; untouched/draft-only questions create no records. Completion is idempotent and freezes effective duration/midnight metrics, excluding an ongoing pause. Submitting every question no longer auto-completes practice. Existing completed-session reattempt behavior remains compatible: a new consecutive attempt index appends immutable history without reopening timing.
- Mistake queries accept comma-separated or repeated `types`, `source_paper_ids`, `folder_ids`, `tag_ids`; omitted means unrestricted and explicit empty means none. Values within each new dimension use OR, dimensions use AND. Legacy `tags` retains its prior all-tags semantics. `mastery_status=all` is unrestricted. Inclusive `date_from/date_to` use UTC collection dates (`created_at`, YYYY-MM-DD). Search matches stem or historical source paper names. Historical folder IDs use the current retained folder hierarchy (including soft-deleted folders); permanently purged hierarchy cannot supply descendant relationships. Merged mistakes keep first-source summary fields and all subsequent sources in history, which also participates in filtering.
- `GET /api/export/folder/:id` returns a `.quarry` ZIP. Version-1 `quarry-folder` manifest includes checksums; `content.json` contains the root, descendant folders, banks/papers and file tags/relations; `contents/<owner-id>.json` reuses the validated portable bank/paper format. Referenced attachment blobs are deduplicated. No study history is exported. Folder archive import is not added in this export-only phase; individual portable documents remain importable by the existing importer.
- Broader handoff items (heartbeat/offline timing, exam deadline enforcement, retry result recovery and general content-query alignment) remain outside this task's enumerated changes.

Phase 1.5 verification: `npx pnpm --filter @quarry/server test` passes 61 tests; `npx pnpm test` passes all 122 tests (shared 32, core 16, database 13, server 61; web/desktop have no test files). `npx pnpm build` passes all six packages. Core coverage remains 100%. New tests cover colors, draft restoration/locking/no side effects, explicit completion and attempt history, multidimensional historical-source filters, legacy migration backfill, and subtree export with attachment bytes.
