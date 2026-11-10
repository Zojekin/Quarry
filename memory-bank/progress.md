# 题匣 (Quarry) 研发进度与里程碑看板 (Progress Tracking)

### 后端交接文档收敛（2026-11-10）

- 新增frontend-current-spec.md作为最终交互基线；backend-handoff.md明确源码核实差异、优先级、待定方案和验收。旧设计补丁迁至frontend-design-history.md。
- 更新主文档入口，区分视觉mock原型、正式前端占位、后端已有服务和差异；最新标签颜色为改色自动保存，无保存按钮，阅读/界面设置已移除。
- 本轮仅文档整理与源码核查，未改后端、未跑后端测试，不宣称契约已补齐。

- 2026-11-10选色自动保存：按最新批注移除保存按钮，input/change后持久化并显示行内结果；失败保留选色、可再次选色或change重试。统一颜色控件外壳与浏览器色块边框、圆角及焦点。自动保存/刷新/失败重试/无按钮/850px布局、JS语法和web no-emit通过；截图 `.oil-ui/color-autosave.png`。

### 保存反馈补齐（2026-11-10）

- 标签颜色增加行内未保存／已保存／保存失败提示，失败保留草稿并可重试；成功仅在持久化完成后显示，不刷新整页或丢失焦点。
- 浏览器验证修改、成功、刷新持久化、模拟存储失败、草稿保留和重试通过；850px截图检查、JS语法与web no-emit通过。证据 `.oil-ui/save-feedback.png`。仍为模拟存储原型。

### 关于产品信息实现（2026-11-10）

- 根目录新增 `product-info.json` 统一产品资料，版本仅取根 `package.json`；专用about渲染模块展示标志、名称、简介和版本，移除旧数据空间描述。
- 作者、作者主页、项目/联系入口已预留，未填写自动隐藏；无虚构姓名/链接。预览启动时注入只读元信息模块，与业务数据分离，无数据库或新业务API。
- 元信息/版本来源、可选字段、文本转义/链接分支、刷新和850px布局检查、实际看图、样式源审计及no-emit通过，证据 `.oil-ui/quarry-about`。配置后续填写方法在预览README。

- 2026-11-10设置减法：移除整个阅读与界面设置模块，标签说明改为紧随标题8px；标签颜色保存/刷新、850px截图及no-emit通过，证据 `.oil-ui/quarry-settings-trim`。关于模块用户选择产品＋作者/联系/项目链接方向，正讨论产品元信息的配置归属，尚未编造作者或链接/重写旧关于内容。

### 定点收尾与Oil UI评审（2026-11-10）

- 资料库列表文件名17px，标题/筛选/表格间距均32px；页签关闭去边框，暂停/结束按钮等宽等高40px。
- 设置分阅读/标签颜色/关于三组，组间48px，同组无横线；修正旧标签描边说明。
- 六项样式/几何、字号与标签颜色刷新保存、850px布局、源码审计、失败恢复回归与no-emit通过；证据 `.oil-ui/quarry-finish-review`。
- 独立Oil UI视觉无必须修复项，仅建议颜色选择器外壳统一；独立UX走通修改字号、实际练习与刷新恢复，无阻断，仅建议就地阅读预览/保存反馈。评审建议留待讨论，未扩展实施；不打分。

### 全页面视觉规范迁移完成（2026-11-10）

- 首页、资料库、题库、套题、错题、记录、答题/结果、设置、回收站均迁移到共用颜色/五档字号/四档字重/间距/圆角/阴影变量；常规操作统一17px/500、48px，紧凑和图标40px。卡片、输入/搜索/筛选、药丸、表格、选项复用定义。
- 清理历次覆盖、过时文件树/属性侧栏样式与静态内联样式；基础规则在前，响应式集中在后，同媒体条件下同一完整选择器无重复。动态标签颜色、进度百分比与个人阅读字号保留，新数据默认20px。
- 新增 `apps/web/workspace-preview/VISUAL-SYSTEM.md` 维护约定；规范页补齐真实输入/筛选/复选框/开关/药丸/表格示例，使用产品共用原语。
- 1703/850px十页截图及真实计算样式检查通过：只出现15/17/20/28/48五档、普通按钮均17px/500、无溢出/错误屏；选择器/变量源码审计无重复或缺失。页面/练习/考试/重做/筛选/编辑/持久化及失败恢复检查、语法/web no-emit通过，证据 `.oil-ui/quarry-unify`。
- 独立视觉发现窄屏答题响应式顺序问题，已修并定点复核关闭；独立UX完成练习至保存结果，保留已确定的查看答案确认、切题留草稿规则。仍为本地模拟原型，未接真实API。

- 2026-11-10：前两档字号改为15/17px，五档为15/17/20/28/48；规范页新增400/500/600/700四档字重及具体用途。正文/题干/数字常规，操作中等，标题/表头/字段/判分半粗，参考答案与解析标题/斩复加粗；状态变化不改字重。共享变量和规范预览已更新，实际字号/字重、窄屏及no-emit通过；全页迁移另行收敛。

### 暖米黄选中态与规范预览（2026-11-10）

- 按讨论将待判分选中态改为源自纸白背景的暖米黄#EDE5D0，配#62563C文字/#C9BB96描边，由语义变量管理；正确绿、错误红不变。
- 新增内部 `/components` 预览，集中比较选项状态、14/16/20/28/48五档字号及按钮层级；五档字号先在规范预览采用，全页面旧样式归并待确认后进行。
- 真实截图和浏览器检查通过：待判分与正误颜色区分、五档字号、实际答题选中态及850px布局；语法/no-emit通过。证据 `.oil-ui/quarry-warm-selection`。

### 答题操作与浅绿选中态（2026-11-10）

- 删除题干/作答分隔线和选择答案提示，待判分选项从黄绿改为浅松绿#E1EBDF；红绿判分不变。
- 左侧固定白色查看答案/重新作答，右侧上一题与松绿下一题；删除尝试次数。重做历史、确认锁定、末题禁用及手动加入错题保持原行为。
- 已看1703/850px截图，验证位置/配色、重做/刷新、填空与主观题；原持久化/失败恢复/导航检查、语法及web no-emit通过。证据 `.oil-ui/quarry-study-controls`。

### 答案反馈减法细修（2026-11-09）

- 答题选项去渐变/阴影，保留状态色；正误仅显示SVG图标，可访问标签保留。判分状态与得分融合至右上角题型信息，选项下方不再重复。
- 答案和解析拆为随内容高度变化的独立模块，24px间距、对称上下内边距、加粗标题。选择题不再重复参考答案，填空与主观题保留；调整限于答题/结果，错题预览独立。
- 学习记录删除顶部会话数量统计条，列表及筛选保留；所有表头直角背景、深色文字，首尾内边距不变。
- 实际截图检查及选择/填空/主观题、图标、模块留白、状态位置、统计删除、表头/窄屏验证通过；原页面/练习/考试/重做/多选/持久化与失败恢复回归、语法和web no-emit通过。证据 `.oil-ui/quarry-flat-answers`，本次明确局部修改自检。

### 左右答题与显式预览（2026-11-09）

- 已实现确认的宽白卡45/55左题干右作答，1000px以下恢复上下布局；右栏放操作与解析，宽屏题干在卡片范围内跟随页面，避免展开解析后丢失对照。短括注调整为不拆开的文本片段，不修改原题数据。
- 未判分选中态黄绿#E2E8B3；判分后正确绿、选错红，配SVG及漏选标记。验证多选漏选/选错、重做清空、刷新恢复、考试交卷前隐藏及交卷后未作答题的正确选项展示；查看答案仍保存锁定，切题仅留草稿。
- 错题右侧改为独立白色题目预览卡，眼睛图标、来源/题型、答案解析与历史分区，自然整页滚动。表格两端20px内边距与正文对齐；模式与状态药丸统一高度/内边距，状态改SVG；标签不再额外描边，网格卡操作分隔线移除。
- 独立视觉评审无返工项，短括注问题已修；独立UX走通保存结果并发现展开解析丢题干，已修及验证。1703/850px截图、作答/考试/存储失败/手动与填空回归、语法及web no-emit通过，证据 `.oil-ui/quarry-study-split`。仍为本地模拟原型，未接真实API。

### 最新确认：统一筛选外观（2026-11-09）

- 题库只保留题型、题目标签，移除日期入口及旧标签页里残留日期条件的影响。
- 资料库、题库、错题本、学习记录下拉筛选统一48px单行：默认显示类别，限定后显示所选内容并使用浅松绿#E1EBDF、深绿文字#315C47；全选恢复类别，空选显示未选择，日期应用/清除采用同一规则。长文本省略并提供完整悬停提示，菜单内标签保留其自定义颜色。
- 实际浏览器验证默认/选择/复原、菜单保持原节点、日期清除、刷新恢复、旧日期状态兼容及850px无溢出；截图已查看，JS语法及web no-emit通过。证据 `.oil-ui/quarry-filter-style`。

### 最新批注：筛选与详情打磨（2026-11-09）

- 全部多选菜单统一为全选时每项都有勾，逐项取消同步取消全选；筛选只刷新结果区，菜单保持原节点、焦点和展开状态，消除反复入场闪动。
- 题库增加题型、题目标签和修改日期筛选；面包屑移至导航旁，删除重复题数副标题。日期使用题目实际保存时间，旧无日期模拟题不匹配有界日期范围。
- 统一表头背景、记录模式药丸与状态图标；套题属性改总分/考试时间、来源状态点药丸、正常字号标签、题型题数分值标题及加号悬停背景。错题筛选止于左栏分隔处，搜索与右栏对齐。
- 真实浏览器交互、850px布局、原页面/练习/考试/持久化/失败保留输入回归、语法及web no-emit通过。截图及检查在 `.oil-ui/quarry-detail-polish`；本轮明确批注自检，仍为本地模拟原型。

## oil-ui更新与首页评审后优化（2026-11-08）

- 最新批注已完成：收起窄栏顶部隐藏Logo，仅保留与学习概览对齐的展开按钮；年份2026移到日积月累标题旁。侧栏展开/收起、键盘、嵌入比较页、热力图切换与类型检查再次通过，标题对齐误差0px。
- 按用户明确要求完成Oil UI独立10分制评审，当前桌面首页视觉8/10。主要剩余差距为顶部累计指标与继续学习区的层级、热力图底部小字的阅读舒适度；未发现重叠或裁切。报告在 `.oil-ui/quarry-dashboard/scored-review.md`，本轮不含业务API完成度或正常速度动效评分。

- 已将oil-ui更新到0.33.2，重新读取新版。保留米白松绿、衬线标题及开放式错题区，增强辅助文字的对比和字重，整理错题区行距，入口改为“去错题本选题”。
- A版热力图新增真实可操作的作答量/用时切换，使用滑动选中底板和颜色过渡；未来日期空心显示，悬停提供当天题数及用时。每日模拟投影与累计1,284次、32时18分一致，业务API仍未接入。
- 鼠标、键盘、切换往返、嵌入比较页、侧栏交互和无溢出检查通过；已看100%画面及200%关键区域，web no-emit与脚本语法通过。证据在 `.oil-ui/quarry-dashboard/shots/polish/`。独立复核受工具额度限制未完成，已完成主Agent自检。

## A 版首页批注落实（2026-11-08）

- 收起侧栏已改为72px窄栏，保留透明Logo、展开按钮及导航/工具图标；全部套题卡与高数卡片统一底色、叠页阴影、等宽布局及绿色继续作答按钮。直接页面和比较页内展开/收起、Esc、焦点、无溢出及类型检查通过。

- 最新批注已完成：A使用仅保留绿色的透明Logo；侧栏按钮无边框；两张套题卡均删除PRACTICE编号，将分类移到顶部、移除继续按钮箭头。同类详情统一14px、操作及复习列表统一16px，共用超椭圆半径增大到卡片36px/控件20px。实际字体角色、透明Logo一致性、侧栏交互、42px间距及底边对齐检查通过，web no-emit通过。

- 已补齐后续批注：上下区块间距统一42px，学习概览与Logo水平对齐；导航维持原背景和12px内边距，文字16px、图标24px。`ui-primitives.css` 统一超椭圆曲线与分级半径，卡片、按钮、导航、进度和热力格共用规则。背景定为 #F9F9F7 / #F9F9F9，强调色选定松绿 #386450。
- `sidebar.js` 实现收起/展开及Esc、焦点管理；比较页A开启内联交互。实际点击恢复、Esc、嵌入比较页交互均通过；标题/Logo与复习入口/卡片底边对齐误差均0px，页面无溢出。证据在 `.oil-ui/quarry-dashboard/shots/shell/`，web no-emit和脚本语法检查通过。未接业务API。

- 按用户确认深化 A「松间案台」：标题、英文与展示数字统一思源宋体，控件和辅助文字保留无衬线。官方可变 WOFF2 与许可证位于 `apps/web/dashboard-lab/fonts/`；比较页内嵌字体，支持离线使用。
- 指标依次为累计用时32时18分、累计答题1,284次、去重题数936题。删除指标说明、侧栏装饰、标题英文、错题说明及底部小字；标题改为“复习错题”，热力图右上仅保留2026。
- 保留创建复习套题入口及业务规则；B/C历史预览不改。浏览器确认中英文标题与展示数字实际使用打包字体，1440×900无溢出和裁切，浏览器无错误；web no-emit和服务语法检查通过。截图及报告在 `.oil-ui/quarry-dashboard/shots/refinement/`。本轮局部修改由主Agent自检，未增加动效和独立评审。

## 学习首页三方向探索（2026-11-07）

- 新增 `apps/web/dashboard-lab`：A 松间案台、B 蓝图仪表、C 朱砂轨迹，围绕最新学习首页职责探索三种不同结构，未沿用历史技术栈决定。
- 比较入口为 `style-explorer.html`，支持离线并排、单张与实际尺寸查看；本机服务为 `node apps/web/dashboard-lab/serve.mjs`，地址 `http://127.0.0.1:4176/`。
- 三版使用统一模拟学习指标、未完成套题、全年热力图与待复习错题，复用现有标志。业务控件静态，未接 API、保存、响应式或动效。
- 概念及灰度独立审核通过。主Agent检查实际截图并修复溢出、时间单位换行；最终三页均为1440×900，无横向溢出、标题/按钮裁切、损坏图片或检查对象超出首屏。截图在 `.oil-ui/quarry-dashboard/shots/`。
- `node --check apps/web/dashboard-lab/serve.mjs` 与 web TypeScript no-emit 检查通过；未运行生产构建和全量测试。推荐 A 尚未由用户选定，正式框架和后续页面待方向确定后实现。旧预览与已有未提交修改保留。

## 首页信息架构调整（2026-11-07）

- 按用户确认将学习看板设为默认首页，展示学习概况、热力图、待复习错题概况与继续答题入口。
- 文件夹、题库、套题管理移至独立的资料库栏目，与错题本、学习记录并列；不再设置重复的学习看板栏目。
- 用户已确认栏目名称为“资料库”，替代此前暂用的“题目”；统一导航为首页、资料库、错题本、学习记录。
- 已同步设计文档、架构及实施计划 Task 3.4、4.1、5.5。本次仅改文档，现有三版预览尚未调整；题目归属、套题答题规则与后端 API 保持原有约定。

> **当前版本**：v0.1.0-alpha  
> **基准依据**：`memory-bank/design-document.md`、`memory-bank/tech-stack.md`、`memory-bank/architecture.md`、`memory-bank/implementation-plan.md`  
> **当前状态**：Phase 1 Batch A/B 后端已完成；Phase 3 已提供真实 HeroUI 组件的五布局预览，正式业务前端待实现

---

## 1. 里程碑概览与当前状态 (Milestones Overview)

| 阶段 (Phase)  | 描述                     | 状态       | 负责人 / 引擎           | 备注                                                                          |
|:----------- |:---------------------- |:--------:|:------------------ |:--------------------------------------------------------------------------- |
| **Phase 0** | **工程骨架与基础基础设施**        | 🟢 已完成   | Codex CLI / 主智能体调度 | Monorepo 初始化、纯函数判分与打乱、SQLite 仓储、Hono 服务骨架全部闭环                               |
| **Phase 1** | **后端核心业务 API 与数据安全**   | 🟢 已完成   | Codex CLI          | Batch A/B 内容管理、会话判分、错题分析、导入备份、回收站已实现                                        |
| **Phase 2** | **Electron 桌面宿主与后端编排** | ⚪ 未开始    | Codex CLI          | electron-vite、随机端口后端托管、生命周期                                                 |
| **Phase 3** | **前端框架与通用交互基础**        | 🟡 设计探索中 | Codex CLI          | React 19 + Tailwind CSS 4 + HeroUI 3；五布局真实组件预览已就绪，正式组件整合与 BackendClient 待实现 |
| **Phase 4** | **内容管理与套题编排工作台**       | ⚪ 未开始    | Codex CLI          | 6 题型编辑、@dnd-kit 分区与固定组编排、导入严格校验                                             |
| **Phase 5** | **答题引擎、错题复习与看板**       | ⚪ 未开始    | Codex CLI          | 练习/考试模式、@tanstack/react-virtual 虚拟滚动、计时遮罩、热力图                               |
| **Phase 6** | **集成验收、打包分发与文档更新**     | ⚪ 未开始    | Codex CLI / 主智能体   | Windows x64 安装包、离线验证、最终架构与进度同步                                              |

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

| 决策 ID       | 事项说明       | 决策结果                                                                    | 状态    |
|:----------- |:---------- |:----------------------------------------------------------------------- |:-----:|
| **DEC-001** | 前后端解耦与独立性  | 前端完全不使用 Electron IPC，只通过统一 `BackendClient` 面向标准 HTTP REST / Hono RPC 通信 | ✅ 已敲定 |
| **DEC-002** | 数据库选型与仓储隔离 | 排除 Prisma，采用 Kysely + `better-sqlite3`，业务层仅依赖抽象接口，未来可无缝切换 Postgres      | ✅ 已敲定 |
| **DEC-003** | 附件存储虚拟化    | 本地按 SHA-256 哈希防重存储，对外仅提供虚拟资源 URL，前端不暴露绝对物理路径                            | ✅ 已敲定 |
| **DEC-004** | 选项与打乱机制    | 选项生成唯一 UUID 标识，答案绑定选项 ID，打乱仅改变呈现顺序与字母映射                                 | ✅ 已敲定 |

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

## Phase 1 Batch B milestone (2026-11-06)

- Tasks 1.4-1.6 implemented: persisted deterministic session snapshots, practice scoring/immutable attempts, exam blank results, pause/resume duration deductions and timezone-aware midnight metrics; automatic/manual versioned mistake history, mastery transitions, filtered historical review papers and dashboard aggregation.
- Strict Markdown/JSON/Quarry content import rejects invalid files atomically with line/path diagnostics. Export preserves questions, answers, material ancestry, paper composition/configuration and referenced ZIP attachments. Ordinary import creates new content identities.
- Full checksum-validated ZIP backups include all database tables, trash, learning history and attachment blobs. Restore first persists a recovery archive and uses transactional row replacement plus attachment cleanup on failure. Custom persistence adapters provide their own snapshot implementation.
- Trash lists, restores and purges content transactionally. Deletion batches prevent parent restoration from reviving earlier independent deletions. Source identities and historical snapshots survive permanent source deletion.
- Added integration coverage for snapshots across app recreation/content edits, invalid-answer rollback, deterministic fixed/material blocks, duplicate attempts, versioned mistakes, manual idempotence, removed tags, midnight pauses, exam blanks, precise strict rejection, content roundtrips, backup restoration/partial attachment failures/checksums, subtree restoration and permanent deletion history.
- Verification: `npx pnpm --filter @quarry/server test` passes 57 tests (21 added); `npx pnpm test` passes all 116 workspace tests; `npx pnpm build` passes all six packages. Unchanged tasks may use Turbo cache. `git diff --check` passes.

## Desktop workspace design exploration (2026-11-07)

- 用户要求探索多种桌面工作台方向；制作 A「竹青书目」、B「精密工作台」、C「墨色案头」三份静态首屏与同屏比较入口，共用模拟题库、套题和未完成练习数据。
- 过程文件位于 `.oil-ui/quarry-desktop/`，对比入口为 `explore/style-explorer.html`，目标视口 1440×900；支持离线打开与本机 HTTP 预览，未接 API、未实现业务交互、响应式或动效。
- 正式前端技术栈按本次用户指令为 React 19 + Tailwind CSS + HeroUI。`apps/web` 仍为原有包骨架，选定方向后再进行组件实现。
- 使用临时独立浏览器生成三版实际截图并检查图片加载、横向溢出和构图；修复 B 底部重叠后重新检查。证据在 `shots/`。探索阶段不作视觉评分或完整业务验收，未运行生产构建或全量测试。

## Unified frontend pages milestone (2026-11-08)

- 沿用已认可首页样式完成资料库、题库/套题详情、练习、错题本、学习记录，交付到 `apps/web/workspace-preview`，入口4177。补齐考试、结果、设置与回收站串起预览路径；旧4176比较入口保留。
- 复用共享shell、样式变量、控件/弹窗及隔离模拟仓储。支持选题保存套题、确认/解析/重做、暂停恢复、错题筛选保存复习套题、记录与结果查看，localStorage恢复演示数据。未接后端；JSON仅为原型自身格式；完整Markdown/数学/材料/附件/追随与正式规则留待API集成。
- 独立静态视觉评审8/10，定点复核通过标题、详情和热力图调整；独立UX走通恢复练习到保存结果。修复重复恢复和展开解析后下一题移出首屏的问题。公式仍为转义纯文本，未宣称富文本集成完成。
- 浏览器检查通过：主要页面无错误、横向溢出或可见标题控件裁切；作答刷新保留、考试交卷前隐藏结果、复习套题保存读回、筛选全选5题保存套题、掌握度持久化、回收站恢复、存储失败保留输入和原数据、未结束会话不可直接查看结果、850px窄视口无横向溢出。JS语法及web no-emit通过，未执行生产构建/全仓测试。证据见 `.oil-ui/quarry-pages/`。

## Annotation refinement (2026-11-09)

- 落实17项批注：资料库移除内侧栏，标签放分类切换下并可筛选；统一连续底板切换、白底次级按钮、图标视图切换、带色标签、删除/导出按钮，去掉多余说明。
- 套题详情单栏，属性归入标题下，补返回。工作区标签页支持切换、关闭和当前浏览器会话恢复，资料库页签保留；返回此前资料库文件夹。
- 错题复用首页白卡片和超椭圆，筛选区加宽；共用HeroUI风格下拉弹层、选中勾标及键盘操作。原型仍为原生模块，未宣称使用实际HeroUI React组件。记录状态分色，去掉快照说明。
- 独立存量视觉复核无返工问题，不重新评分；独立UX走通练习到结果。修复其解析被浮动栏遮挡的轻微问题：确认后将解析带入留有底部阅读空间的可见区域。
- 验证标签筛选、页签切换/关闭/刷新、属性保存/返回、导出、删除取消/恢复、下拉鼠标/键盘/Esc；1703x871及850宽无横向溢出，200%等效视口下拉可读可操作。原练习/考试/保存失败检查及JS语法、web no-emit通过。证据 `.oil-ui/quarry-annotations/`，未接真实API。

## Explicit workspace tab behavior (2026-11-09)

### Subsequent page-scoped filter and appearance milestone

- 按页面分别落实：错题统计同行、五类筛选卡片/日期范围/右侧搜索、题型/右侧文字与斩字放大、选题浮栏体积；资料库单独类型/文件标签下拉、标签保留本色描边、悬停视图按钮和文件夹操作。
- 设置新增按文件/题目命名空间分别保存标签颜色；文件夹支持属性、导出、级联移入回收站及恢复、预览归档导入并生成新身份。独立删除批次和缺失父文件夹恢复顺序通过检查。
- 桌面全部侧栏统一280px；按用户澄清保留侧栏套题名，仅删正文标题和底部完成量，末题下一题禁用。首页铅笔为未来布局编辑预留，未实现自定义组件；记录模式默认全部、菜单留间隔、去题数副标题。
- 独立存量视觉复核无阻断；独立UX发现默认全部点单项反而排除、隐藏勾选进入复习套题，已修正并定点复核通过。资料库类型仍遵从用户要求全部全勾选，其他筛选默认全部为无限制；更换筛选清除隐藏选中，仅保存当前筛选内题目。
- 主 Agent 验证多条件/日期/键盘/刷新、色彩保存与失败恢复、目录导出删除恢复导入、新身份、历史保留和850px无横溢出；原练习/考试/存储失败检查与语法/web no-emit通过。证据 `.oil-ui/quarry-filter-panels/`，仍使用本地演示数据。

### Subsequent filing and card annotations

- 首页错题栏按最新反馈恢复；资料库改为当前目录的直接子项，根目录不再平铺其他文件夹的题库/套题。标签编辑用英文逗号回显，计时改数字冒号，模式移侧栏；桌面答题侧栏回到192px，已答色#818E7E，选项有轻微体积感。
- 题目编辑跳转条移除；套题题目区新增胶囊搜索、无背景加号菜单和无衬线题型标题，支持新建及从题库选题。错题卡片改文件名+题目标签、右侧两行错误/日期和“斩”掌握/“复”撤回，详情随页面滚动。
- 错题历史记录实际提交套题身份和名称，避免复用题目时误认来源。浏览器验证目录隔离、英文逗号读回、搜索/新建持久化、掌握撤回、来源身份、计时边界、侧栏/配色、整页详情及850px无横溢出；原会话/考试/页签、手动/填空/失败保存检查和语法/no-emit通过。证据 `.oil-ui/quarry-filing/`，本轮明确批注主 Agent 自检。

### Subsequent editing and study milestone

- 新批注已落实：首页去复习错题栏，页签固定，返回/前进/首页图标导航；套题属性纵向排列、修改日期时间和标签可见；跟随开关只在编辑菜单、打乱只在创建时设置。
- 新增独立编辑模块，题库/套题元数据及题目内容、选项、答案、解析、分值、题目标签可保存刷新读回；选项身份/旧会话不变，副本与源题隔离，跟随预览/关闭冻结/来源删除保留最新内容通过检查。
- 答题侧栏加宽可收起，计时/暂停/结束移入；选项深绿浅字，查看答案仍保存锁定，删固定/锁定提示和操作外卡片。讨论后采用已答灰深绿#526A5B、当前鲜松绿#2F6B50加外圈、未答浅底。
- 独立视觉复核及定点回看无剩余可见问题，独立UX完成练习/解析/暂停/记录/恢复；主 Agent 验证持久化、快照/选项身份、跟随/源删除、手动/填空、校验/保存失败上下文、创建打乱、导航/固定/收起/配色及850px布局，原会话/考试/页签检查和语法/web no-emit通过。证据 `.oil-ui/quarry-editing/`，仍为本地模拟数据原型。

- 按最新批注把标签卡片放入最顶部，与下方分隔线留出间距；移除旧标题/日期栏。普通点击只更新当前标签，只有无背景加号新建首页标签；最后一页保留。
- 同路由标签有独立身份，搜索、筛选、勾选、滚动与返回资料库位置分别保存，并在当前浏览器会话刷新后恢复。旧自动积累标签的逻辑被替换。
- 首页作答量/用时共用分段底栏，统一减少分段内边距；搜索改胶囊，复选框使用HeroUI风格圆角/勾标/焦点状态并保留原生键盘与半选行为。未宣称实际安装HeroUI React组件。
- 主 Agent 实际看图并验证1219x667与1703x871：普通点击不增标签、加号创建、同页双标签状态独立、关闭/刷新、复选框Space/半选和顶部卡片间距通过。原页面/作答/失败恢复检查与JS语法/web no-emit通过。证据 `.oil-ui/quarry-tab-behavior`；本次明确批注自检，不重新评分。

## Phase 1.5 backend contracts (2026-11-10)

- Migration `005_phase_1_5` adds nullable tag colors, session position/drafts and immutable source paper/name/folder columns on study and mistake records. Existing history is backfilled from persisted session paper snapshots, never from renamed live papers. Generic typed repository create/update operations persist these fields without adding driver dependencies to services.
- `POST /api/tags` accepts `color: "#RRGGBB" | null`; `PUT /api/tags/:id` accepts optional name/color and preserves namespace. Colors travel with portable question tags and full backups; folder exports also include file tags/relations.
- `POST /api/sessions/:id/draft` accepts `{current_index?: number, question_id?: UUID, user_answer?: StudyAnswer}`. Position is zero-based. GET returns `current_index` and `draft_answers` keyed by question ID. Drafts validate question/option identities, have no study/statistical/mistake effects, and reject overwriting submitted practice questions. Exam drafts remain editable before submission and reveal no solutions.
- `POST /api/sessions/:id/complete` explicitly completes practice and returns the session plus distinct `answered_count`; untouched/draft-only questions create no records. Completion is idempotent and freezes effective duration/midnight metrics, excluding an ongoing pause. Submitting every question no longer auto-completes practice. Existing completed-session reattempt behavior remains compatible: a new consecutive attempt index appends immutable history without reopening timing.
- Mistake queries accept comma-separated or repeated `types`, `source_paper_ids`, `folder_ids`, `tag_ids`; omitted means unrestricted and explicit empty means none. Values within each new dimension use OR, dimensions use AND. Legacy `tags` retains its prior all-tags semantics. `mastery_status=all` is unrestricted. Inclusive `date_from/date_to` use UTC collection dates (`created_at`, YYYY-MM-DD). Search matches stem or historical source paper names. Historical folder IDs use the current retained folder hierarchy (including soft-deleted folders); permanently purged hierarchy cannot supply descendant relationships. Merged mistakes keep first-source summary fields and all subsequent sources in history, which also participates in filtering.
- `GET /api/export/folder/:id` returns a `.quarry` ZIP. Version-1 `quarry-folder` manifest includes checksums; `content.json` contains the root, descendant folders, banks/papers and file tags/relations; `contents/<owner-id>.json` reuses the validated portable bank/paper format. Referenced attachment blobs are deduplicated. No study history is exported. Folder archive import is not added in this export-only phase; individual portable documents remain importable by the existing importer.
- Broader handoff items (heartbeat/offline timing, exam deadline enforcement, retry result recovery and general content-query alignment) remain outside this task's enumerated changes.

Phase 1.5 verification: `npx pnpm --filter @quarry/server test` passes 61 tests; `npx pnpm test` passes all 122 tests (shared 32, core 16, database 13, server 61; web/desktop have no test files). `npx pnpm build` passes all six packages. Core coverage remains 100%. New tests cover colors, draft restoration/locking/no side effects, explicit completion and attempt history, multidimensional historical-source filters, legacy migration backfill, and subtree export with attachment bytes.
