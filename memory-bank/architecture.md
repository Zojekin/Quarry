# 题匣 (Quarry) 系统架构设计说明书

> **基准依据**：`AGENTS.md`、`memory-bank/design-document.md`、`memory-bank/visual-system.md`  
> **适用范围**：现行系统模块划分、技术栈选型、核心领域边界、前后端/桌面端运行时架构与 CLI 工具链

---

## 1. 架构总览与四道解耦防线

“题匣 (Quarry)”是一款个人离线优先的题库管理、套题编排、练习考试及错题复习桌面软件。整体遵循 **“简单、健壮、高度解耦、全链路类型安全”** 原则，采用 TypeScript 端到端同构的 **pnpm Monorepo** 拓扑。

1. **界面与宿主解耦**：`apps/web` 纯粹作为标准 Web 应用开发，严禁引入 Electron 专有模块（如 `ipcRenderer`、`remote`），100% 具备独立部署或迁往云端浏览器的能力。
2. **通信契约解耦**：前端通过统一封装的 `BackendClient`（`apps/web/src/api/client.ts`）发起标准 HTTP REST 请求，不直接接触数据库驱动或 IPC。
3. **业务层与数据库解耦**：`packages/server` 控制器与服务层只依赖抽象仓储接口（Repository Interface）及注入的 `withTransaction` 事务回调，不直接访问底层驱动；数据库层采用 Kysely + `better-sqlite3`（WAL 模式 + 外键约束），未来切换至 PostgreSQL 等数据库只需替换 `packages/database` 适配器。
4. **附件与文件系统解耦**：附件存储通过 `IAttachmentStorage` 虚拟化封装，本地按 SHA-256 哈希去重保存于应用数据目录，前端仅通过 `/api/attachments/:id` 虚拟 URL 流式访问，绝不感知或暴露本机绝对盘符路径。

---

## 2. Monorepo 工程拓扑与依赖流向

```text
                    ┌────────────────────────┐
                    │      apps/desktop      │
                    │  (Electron + esbuild)  │
                    └───────────┬────────────┘
                                │ 托管本地后端并注入 API URL
                                ▼
                    ┌────────────────────────┐
                    │    packages/server     │
                    │     (Hono REST API)    │
                    └───────┬────────┬───────┘
                            │        │
             ┌──────────────┘        └──────────────┐
             ▼                                      ▼
┌────────────────────────┐              ┌────────────────────────┐
│     packages/core      │              │   packages/database    │
│ (纯函数领域算法/100%测) │              │ (Kysely + SQLite 仓储) │
└────────────┬───────────┘              └───────────┬────────────┘
             │                                      │
             └──────────────┬───────────────────────┘
                            ▼
              ┌───────────────────────────┐
              │      packages/shared      │◄───────────┐
              │ (Zod, DTO, Enums, Portable)│           │
              └─────────────▲─────────────┘            │
                            │                          │
              ┌─────────────┴─────────────┐ ┌──────────┴───────────┐
              │         apps/web          │ │     packages/cli     │
              │  (React 19 + Vite SPA)    │ │ (DSL 校验与导入转换) │
              └───────────────────────────┘ └──────────────────────┘
```

辅助工具与 Skill：
- `skills/question-converter/SKILL.md`：指导 Agent 使用 Quarry Markdown DSL 与 `@quarry/cli` 生成合规导入文件。

### 依赖规则
- `packages/shared`：被全仓共享，只依赖 `zod`，严禁依赖任何业务逻辑、持久化或平台 API。
- `packages/core`：只依赖 `@quarry/shared`，纯函数实现，严禁任何网络 I/O、文件 I/O、系统时钟或全局可变状态；Vitest V8 强制 100% 语句/分支/函数/行覆盖率。
- `packages/database`：只依赖 `@quarry/shared`、`kysely`、`better-sqlite3`。
- `packages/server`：依赖 `@quarry/shared`、`@quarry/core`、`@quarry/database`，负责 HTTP 路由、业务服务、附件存储、导入导出与备份恢复。
- `packages/cli`：依赖 `@quarry/shared`，独立 Node.js CLI 工具（esbuild 打包至 `dist/index.js`）。
- `apps/web`：生产代码只依赖 `@quarry/shared` 与 Web 生态包，通过 HTTP 调用 `@quarry/server`；服务端真实引入仅存在于集成测试中。
- `apps/desktop`：依赖 `@quarry/shared`、`@quarry/server`、`@quarry/database`（托管启动进程）并打入 `apps/web/dist` 静态产物。

---

## 3. 现行技术栈选型

| 层次 | 现行选型 | 核心依赖 / 工具 | 职责说明 |
| :--- | :--- | :--- | :--- |
| **工程管理** | pnpm Workspaces + Turborepo | `pnpm@10.28.2`, `turbo`, `typescript@^5.9.3`, `vitest` | 隔离依赖、缓存构建/测试/类型检查流水线 |
| **桌面宿主** | Electron + esbuild | `electron`, `electron-builder`, `electron-updater`, `esbuild` | 无菜单栏一体化窗口（Windows `titleBarOverlay` 42px）、随机端口本地服务进程、Windows NSIS/ZIP 打包与自动更新 |
| **网页前端** | React 19 + Vite 6 | `react`, `react-dom`, `vite`, `@tailwindcss/vite`, `@radix-ui/*`, `cmdk`, `lucide-react` | 单页应用、多标签工作区（sessionStorage）、`Ctrl+K` 快速命令、`shadcn/ui` + Tailwind v4 组件体系 |
| **富文本排版** | React Markdown + KaTeX | `react-markdown`, `remark-math`, `rehype-katex`, `katex` | 离线 LaTeX 数学公式、代码块、表格，禁用原始 HTML，独立分块懒加载 |
| **后端服务** | Node.js（Node-API 10，`^22.14.0 \|\| >=23.6.0`）+ Hono | `hono`, `@hono/node-server`, `fflate` | 轻量 RESTful API、附件流式传输、ZIP 导入导出与备份打包 |
| **领域与契约** | Pure TypeScript + Zod 4 | `zod` | 端到端 Schema 校验、一票否决导入检验、纯函数判分/打乱/跨天计时 |
| **数据持久** | Kysely + better-sqlite3 | `kysely`, `better-sqlite3` | 仓储接口隔离、SQLite WAL 模式、外键约束与版本化迁移 |
| **题目 CLI** | Node CLI + YAML/JSONC | `commander`, `yaml`, `jsonc-parser`, `esbuild` | 校验/转换 Markdown 题目 DSL 与 Loose JSON |

---

## 4. 核心领域模型与数据安全机制

### 4.1 实体组织与双标签物理隔离
- 实体关系：`Folder`（自嵌套）→ `QuestionBank` / `Paper` → `Question` / `PaperItem` → `StudySession` / `StudyRecord` → `MistakeRecord`。
- **双标签隔离**：文件标签（`file`，绑定文件夹/题库/套题）与题目标签（`question`，仅绑定题目）通过 `tag_relations.target_type` 与数据库复合外键/触发器物理隔离，互不继承、互不混用；标签支持可选 `#RRGGBB` 颜色。
- **六大题型与共用材料**：`single_choice`、`multiple_choice`、`indefinite_choice`、`strict_blank`、`loose_blank`、`subjective`；共用材料通过同属主、无环的 `material` + `material_parent_id` 组维护。

### 4.2 编排打乱、来源跟随与会话判分
- **编排与打乱**：支持按题型分区、分区内打乱、合并分区打乱、连续不重叠固定题目组原子移动、材料组整体移动（支持 `movable: false`）、以及带种子的 Fisher-Yates 算法（选项绑定 UUID 身份而非字母）。
- **来源跟随**：套题可配置 `follow_source`（默认关闭）；支持预览更新差异（`/follow-diff`）与原子应用（`/apply-follow`），保留套题选题、顺序、分值与判分规则；源删除后保留最后快照并标记失效；题型变更拒绝直接跟随而需重编排。
- **答题状态机**：
  - **练习模式**：草稿（`/draft`）仅保存作答与位置 `current_index`，不产生统计与错题，且禁止覆盖已提交题目；点击“查看答案”通过 `/submit-question` 提交并锁定本次 `attempt_index`；重做生成新尝试保留历史；显式调用 `/complete` 结束会话并冻结有效时长。
  - **考试模式**：整卷作答，交卷前（`/submit-exam`）严格隐藏答案、解析与对错；支持暂停/恢复（`/pause`、`/resume`）并扣除暂停时间。
  - **跨午夜计时**：`splitDurationAcrossMidnight` 按自然日（支持 IANA 时区与夏令时）比例拆分有效练习时长。
- **错题本与回收站**：未满分自动判分题自动收录、非判分题手动收录，同源同版本合并错误历史；历史套题名称/ID/文件夹快照随记录固化，不受后续改名或永久删除影响。内容删除采用批次软删除（`deletion_batch_id`），恢复时不复活更早独立删除的子项。

### 4.3 数据库迁移、导入导出与事务回滚
- **SQLite 迁移**：`packages/database/src/migrations` 包含 `001`~`005`（11 张主表 + `composer_json` + 会话状态/草稿 + 标签色 + 历史来源固化 + 软删除批次）。
- **一票否决导入**：`/api/import/{preview,commit}` 对 JSON / `# Quarry` Markdown / `.quarry` ZIP 执行严格 Zod 与引用校验，任一错误整份拒绝并给出具体行号/字段路径。
- **文件夹归档往返**：`GET /api/export/folder/:id` 导出 `quarry-folder` 格式的 `.quarry` ZIP。导入校验清单中的文件与 SHA-256、子树引用及附件内容，并预览文件夹、题库、套题、题目与唯一附件数量。提交通过同一仓储事务在根目录创建新子树，重新映射资料、题目 ID 和子树内套题来源，并按标签命名空间与附件哈希去重。
- **备份与恢复防线**：`/api/backup/create` 导出包含校验清单、全表数据与附件的 `.quarry-backup` ZIP；`/api/backup/restore` 先持久化当前数据库恢复点（`recoveryPointsDir`）并先写入新附件，若数据库事务替换失败则回滚数据库并清理新写入附件，保留旧快照可恢复。

---

## 5. 后端 REST API 契约摘要 (`packages/server`)

`createQuarryServer({ db, repositories?, withTransaction?, attachmentsDir?, attachmentStorage?, snapshotRepository?, recoveryPointsDir? })` 创建标准 Hono 实例（不自启监听端口）。所有 JSON 响应统一为 `{ success: true, data }` 或 `AppError` 信封 `{ success: false, error: { code, message, details } }`。

- **系统健康**：`GET /api/health`（Kysely 探针检测数据库连接）
- **内容管理**：`/api/folders`（支持 `?tree=true`）、`/api/banks`、`/api/questions`、`/api/papers`（含 `/:id/items`、`/:id/follow-diff`、`/:id/apply-follow`）
- **标签**支持通过 `GET /api/tags?target_type=file|question` 按命名空间获取，只有 `include_usage=true` 时响应才附加 `usage_count`。计数包含回收站项目的现存关联。`PUT /api/tags/:id` 支持改名和修改颜色（`null` 为系统默认色）。`DELETE /api/tags/:id` 在仓储事务内利用 SQLite 外键级联删除标签关联，标签不存在时返回 404。
- **附件**通过 `/api/attachments` 提供 multipart SHA-256 去重上传与流式读取。
- **答题、错题与统计**：`/api/sessions`（`start`、`/:id/draft`、`/:id/submit-question`、`/:id/submit-exam`、`/:id/pause`、`/:id/resume`、`/:id/complete`）；`/api/mistakes`（多维 `types`/`source_paper_ids`/`folder_ids`/`tag_ids` 同维 OR 跨维 AND 过滤、掌握状态、`/create-paper`）；`/api/analytics/dashboard`
- **回收站与迁移**：`/api/trash`（列表、批次恢复、物理清除）；`/api/import/{preview,commit}`、`/api/export/{bank|paper}/:id`、`/api/export/folder/:id`（子树 `.quarry` ZIP 导出）、`/api/backup/{create,restore}`

**已知后端边界**：
- 尚未实现崩溃/休眠心跳协议或脱离客户端的独立服务端考试超时强交卷（当前依赖客户端运行期定时与重启恢复超时提交）。

---

## 6. 正式网页前端架构 (`apps/web`)

- **构建与注入**：`tsc -p tsconfig.json && vite build` 输出至 `apps/web/dist/`（`base: './'` 兼容桌面端 `loadFile` 离线加载）。`vite.config.ts` 在构建期将根目录 `product-info.json` 与根 `package.json` 的 `version` 注入 `__PRODUCT__`，不为此创建额外后端 API。
- **资源与附件**：`src/assets/logo.svg` 为外部透明的闭合六棱柱图标，竹纹与柱面接缝填充暖米白（`#faf8f2`）。图标与 `src/assets/serif.woff2` 思源宋体经 Vite 打包。题干存储 `attachment://<id>`，渲染时由 `BackendClient` 解析至当前 API。旧的 `/api/attachments/<id>` 和随机端口 loopback 地址继续可读。
- **BackendClient 地址解析顺序**：
  1. 宿主注入的 `window.__QUARRY_API_URL__`
  2. 构建/环境变量 `VITE_API_URL`
  3. 回退默认值 `http://127.0.0.1:48123`
- **工作区与页面**：`App.tsx` 与 `state.ts` 在 `sessionStorage` 维护多标签工作区及各标签独立搜索/筛选/勾选/滚动/前进后退历史。无边框侧栏贯通品牌区与导航区。标签栏以 `42px` 为基准高度，对齐主内容，留白可拖动窗口并为 Windows 原生按钮预留空间。支持 `Ctrl+K` 快速命令跳转。一级栏目为首页（学习概览）、资料库、错题本和练习记录，另含回收站与系统设置。资料库在视口达到 `1340px` 时显示粘性右侧文件概览，低于该宽度时只显示列表或网格。
- **本地偏好**由 `lib/preferences.ts` 以 `quarry-preferences-v1` 写入 `localStorage`。题目字号通过 `--question-size` 应用于答题、详情和题目预览。侧边栏默认状态在应用启动时读取，资料库只有在页签没有手动视图选择时采用默认值。
- **标签输入与设置**复用 `TagInput` 维护编辑器草稿，保存时通过 `BackendClient` 创建新标签并提交关联，成功后由资料库或详情刷新数据。保存失败时，编辑器尝试通过 `DELETE /api/tags/:id?unused_only=true` 清理此次创建且仍未关联的标签。系统设置加载外观与主题、标签管理、显示与操作、运行诊断、备份恢复与关于，以及 CLI 指南。诊断使用 `BackendClient.health()` 探测本地服务及数据库。
- **共用视觉组件**：`components/ui/` 提供 `shadcn/ui` 与 Radix 基础原语，`components/ui.tsx` 提供模态框、多选 `Facet` 与状态药丸，`components/Icons.tsx` 封装 `lucide-react` 图标，`components/QuestionPreview.tsx` 供详情和错题本复用。`index.css` 将主题变量映射为 Tailwind CSS v4 令牌，`production.css` 适配 Markdown、KaTeX 与文件输入按钮。
- **主题启动与持久化**：`lib/themes.ts` 校验 `localStorage` 键 `quarry.theme.v1`，解析预设、模式与四项可选覆盖色并生成语义令牌。Vite 从同一解析器生成内联启动脚本，在首次绘制与 React 挂载前将令牌、`data-theme-mode` 及 `dark` 类写入根元素。`lib/theme-context.tsx` 统一管理设置页和标题栏的主题状态，订阅系统配色与本地存储变化。该配置随各浏览器或桌面渲染器存储，独立于后端 SQLite 数据备份。
- **富文本与按需分块**：`Markdown.tsx` 通过 `React.lazy` 懒加载 `MarkdownContent.tsx`（`react-markdown` + `remark-math` + `rehype-katex`），禁用原始 HTML。

---

## 7. Electron 桌面宿主与 Windows 打包 (`apps/desktop`)

- **后端托管 (`src/backend-manager.ts`)**：主进程在 `127.0.0.1` 上通过操作系统分配的随机可用端口拉起同进程 Hono 服务，轮询 `/api/health` 就绪后打开主窗口；数据目录位于 Electron `userData`（`quarry.sqlite`、`attachments/`、`recovery-points/`）。退出时先排空 HTTP 请求再销毁 SQLite（最长等待 5 秒），支持启动失败清理与幂等多次关闭。
- **安全边界 (`src/main.ts` & `src/preload.ts`)**：开启 `sandbox` 与 `contextIsolation`、禁用 `nodeIntegration`，禁止新建窗口与 renderer 页面跳转。`preload.cjs` 暴露经校验的只读 `window.__QUARRY_API_URL__`，在可选的 `window.__QUARRY_DESKTOP__` 接口提供标题栏配色、`updater` 和 `zoom`。主进程仅接受应用窗口主帧的对应请求，业务通信经 `BackendClient`。桌面端 CORS 额外允许 `loadFile` 产生的不透明 `null` origin。
- **窗口与界面缩放 (`src/main.ts` & `src/zoom.ts`)**：窗口初始 `1440×900`、最小 `900×600`，两者分别按主屏可用工作区的逻辑尺寸限幅。主进程通过 `webContents.setZoomFactor` 应用快捷键或设置选择的倍率，并保存于 `userData/zoom.json`。预加载通过 `packages/shared/src/desktop-zoom.ts` 的类型读取、设置及订阅倍率。Windows 原生标题栏以 42 为基准随应用倍率改变高度，前端通过 `env(titlebar-area-height, 42px)` 对齐标题栏和侧栏。独立 Web 版沿用浏览器缩放。
- **版本更新 (`src/updater.ts`)**：带更新源配置的 Windows 发布构建启动 5 秒后默认检查公开的 `Zojekin/Quarry` GitHub Releases，`userData/updater-settings.json` 保存自动检查和下载偏好。`electron-updater` 后台下载完整 NSIS 安装包并校验 `latest.yml` 的 SHA-512。当前构建为无签名发布，关闭 Authenticode 发布者匹配。安装器在本地 HTTP 服务与 SQLite 关闭后启动，支持手动重启和正常退出时安装。纯 Web 设置页手动查询 GitHub Releases API 并显示下载链接。
- **运行时打包与 N-API 原生绑定**：
  - `scripts/before-pack.cjs` 调用 `scripts/bundle.mjs`，通过 `esbuild` 生成包含 `electron-updater` 的 `dist/runtime/main.js`（ESM）与 `dist/runtime/preload.cjs`（CJS）。
  - `better-sqlite3` v13 随包提供 N-API 预编译二进制，Node.js 与 Electron 共用原生绑定。pnpm 跳过该依赖的原生构建脚本，electron-builder 以 `npmRebuild: false` 保留预编译绑定，并通过 `asarUnpack` 将依赖部署到 `app.asar.unpacked`。
- **应用图标**：`resources/icon.png`（1024×1024）与 `resources/icon.ico`（16–256 px 多尺寸）沿用 Web 图标的暖米白填充和透明外部，分别供桌面窗口和 Windows 打包使用。
- **Windows x64 发布产物**（位于 `apps/desktop/release/`，桌面展示名与快捷方式为“题匣”，产物文件名为英文 `Quarry`）：
  1. NSIS 向导安装包 `Quarry-Setup-<version>-x64.exe` 支持自定义安装路径。简体中文向导通过 `apps/desktop/resources/installer.nsh` 在路径页后独立选择桌面与开始菜单快捷方式。两项默认勾选，首次 `/S` 静默安装沿用默认值，自动更新保留已有快捷方式状态。创建与卸载清理由 electron-builder 的快捷方式逻辑负责，`deleteAppDataOnUninstall: false` 保留本地题库。
  2. 绿色压缩包：`Quarry-<version>-win-x64.zip`
  3. `latest.yml`：`electron-builder --publish never` 生成更新清单，`release-please.yml` 先核验版本、安装包文件名和 SHA-512，再随安装包与 ZIP 上传至 GitHub Releases。

---

## 8. Quarry CLI 与题目转换 Skill (`packages/cli`)

- `packages/shared/src/schemas/portable.ts` 定义校验统一的便携式 `ContentDocument`（带版本 1）及字段放宽的 `LooseContentDocument`（允许缺省 UUID/默认值，由转换器补齐）。
- `packages/cli` 提供三个命令（根目录可通过 `pnpm quarry <cmd>` 调用）：
  - `quarry spec`：输出轻量 Markdown 题目 DSL 规范与完整六题型/材料题示例；
  - `quarry validate <file>`：校验 `.md` 或 `.json` 草稿并输出错误行号/字段或统计摘要；
  - `quarry convert <file> -o <output> [--format json|md]`：输出可直接导入题匣的标准化 JSON 或 `# Quarry` Markdown 文件。
- `skills/question-converter/SKILL.md` 为 AI Agent 提供将各类原始文本/文档规范转换为题匣可导入题库的操作指南。

## 9. 实时开发与桌面测试

- `scripts/dev-web.mjs` 由 `pnpm run dev:web` 调用，在同一 Node 进程运行开发 API 和 Vite，通过 `VITE_API_URL` 连接，使用工作树内 `.quarry-dev-data/`。
- `apps/desktop/scripts/dev.mjs` 由 `pnpm run dev:desktop` 调用，等待 Vite 后用 esbuild 打包主进程和 preload，再启动 Electron。`QUARRY_USER_DATA_DIR` 可覆盖后端数据目录。HTTP(S) 与 mailto 的新窗口链接交给系统处理。
- `e2e/fixtures/electron.ts` 使用 Playwright `_electron.launch()` 启动 Electron 45.2.3。开发运行时与解包应用都从磁盘加载渲染器，使用临时 SQLite 与 Chromium 配置目录，测试可重启并复用数据。
- 视觉项目从真实 API 写入测试数据，以固定的 Electron 显示缩放验证展开、收起与窄屏三种布局。Windows 对比 36 张基线，统一遮罩服务端日期、时间戳和用时，允许每张图至多 1% 像素差异。其他平台执行同样的页面交互与健康检查。详细入口见 [代码库地图](codebase-map.md)。
- `.github/workflows/ci.yml` 的 `e2e-windows` 作业构建解包应用，运行 `Quarry.exe` 冒烟、业务流程、缩放与小窗口布局和重启持久化测试，再执行 Windows 视觉回归。Electron 自带 Chromium，失败时保留 Playwright HTML 报告与测试工件 7 天。
