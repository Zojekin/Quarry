# 题匣代码库地图

入口和调用关系以当前实现为准。产品规则、系统契约与样式规范分别见 [需求](design-document.md)、[架构](architecture.md) 和 [视觉系统](visual-system.md)。

## 工作区

| 路径 | 职责与入口 |
| --- | --- |
| `apps/desktop` | Electron 主进程、沙箱 preload、loopback API 和分发 |
| `apps/web` | React 渲染器、Vite、页面状态和 API 客户端 |
| `packages/shared` | Zod 契约、枚举、DTO、错误类型和便携文档 |
| `packages/core` | 判分、种子打乱、跨午夜时长，纯函数 |
| `packages/database` | Kysely SQLite 仓储、迁移、事务与快照 |
| `packages/server` | Hono REST API、领域服务、归档和附件 |
| `packages/cli` | `quarry spec / validate / convert` 命令和 Markdown DSL |
| `skills/question-converter` | 将题目材料转换为便携文档的工作流程 |
| `playwright.config.ts` / `e2e/` | Electron 冒烟、业务流程、视觉回归 |
| `.github/workflows/ci.yml` | PR 标题、双平台构建验证与 `e2e-windows` 回归门禁 |
| `.github/workflows/release-please.yml` | 动态发版、Windows 构建及更新清单校验与上传 |

## 启动与平台接口

- `apps/desktop/src/main.ts` 启动本地后端，创建窗口，选择 Vite URL 或本地 `index.html`，统一协调普通退出与更新重启前的后端关闭。
- `apps/desktop/src/backend-manager.ts` 初始化 SQLite、迁移、附件目录与恢复点。桌面 API 绑定 `127.0.0.1` 随机端口。
- `apps/desktop/src/preload.ts` 校验 `--quarry-api-url` 后暴露只读的 `window.__QUARRY_API_URL__`，并在 `window.__QUARRY_DESKTOP__` 中提供 `setTitleBarOverlay`、`updater` 和 `zoom`。主进程与 preload 复用 `titlebar-overlay.ts` 校验颜色，主进程为 Windows 目标窗口更新按钮区。
- `apps/desktop/src/zoom.ts` 解析缩放快捷键和读写 `userData/zoom.json`。倍率与桌面桥接类型见 `packages/shared/src/desktop-zoom.ts`，设置入口为 `apps/web/src/components/PreferencesSettingsCard.tsx`。
- `apps/desktop/src/updater.ts` 持久化自动更新偏好，协调 NSIS 版本检查、下载进度与安装。`packages/shared/src/desktop-updater.ts` 定义桌面和 Web 共用的状态与桥接类型。
- `apps/desktop/scripts/bundle.mjs` 打包为 ESM `dist/runtime/main.js` 和 CJS `dist/runtime/preload.cjs`。
- `apps/desktop/scripts/before-pack.cjs` 在 electron-builder 打包时执行同一打包脚本。
- `apps/desktop/package.json` 声明解包与分发产物、GitHub 更新源、Web extraResources 及 SQLite 原生绑定的 ASAR 解包规则。Windows 发布产物包含 `.exe`、`.zip` 和 `latest.yml`。
- `apps/desktop/resources/installer.nsh` 定义 Windows 安装向导的快捷方式选项，`apps/desktop/tests/installer.test.ts` 验证 NSIS 配置、默认勾选和卸载约定。
- `apps/desktop/scripts/dev.mjs` 等待 Vite 后打包主进程，启动 Electron 并处理退出。
- `scripts/dev-web.mjs` 通过 `bundle-backend.mjs` 复用桌面后端组合，数据落在 `.quarry-dev-data/`。
- `apps/web/scripts/dev-server.mjs` 为两个入口启动 loopback Vite，从 5173 起尝试可用端口。
- `t3.json` 将 Web Dev / Desktop Dev 绑定到根目录脚本。

## 渲染器

- `apps/web/vite.config.ts` 在 `index.html` 内联 `lib/themes.ts` 的启动入口，在 `main.tsx` 挂载 React 前应用主题。后续由 `lib/theme-context.tsx` 处理模式、颜色和本地存储变化。
- `apps/web/src/main.tsx` 挂载 React，加载 `index.css`（Tailwind CSS v4、`@theme inline` 令牌与标题栏/热力图样式）和 `production.css`（Markdown/KaTeX 与文件输入按钮适配）。
- `apps/web/src/App.tsx` 负责一体化标题栏工作区标签、可折叠侧栏、全局 `Ctrl+K` 快速命令面板、前进后退与视图滚动恢复。标题栏和侧栏共用 `--titlebar-height`。
- `apps/web/src/components/ui/` 存放 `shadcn/ui` 与 Radix 基础原语（`button`、`card`、`badge`、`table`、`input`、`select`、`dialog`、`popover`、`dropdown-menu`、`tabs`、`checkbox`、`switch`、`progress`、`tooltip`、`command`）；`apps/web/src/lib/utils.ts` 提供 `cn`。
- `apps/web/src/state.ts` 定义路由、页签和计时格式，`components/ui.tsx` 提供弹窗、可搜索的多选 `Facet`、搜索框、状态药丸与 `useConfirmation`。
- `apps/web/src/api/client.ts` 包装 HTTP、错误与文件处理。API 地址优先使用 preload，其次使用 `VITE_API_URL`。
- `pages/Library.tsx` 实现 Master-Detail 题库工作台（列表/网格 + 右侧概览 Inspector + 多选浮栏）与两层紧凑详情页，`components/DocumentEditor.tsx` 编辑资料属性与套题编排。
- `components/QuestionEditor.tsx` 编辑六种题型和上传图片。资料与题目编辑器经 `components/TagInput.tsx` 管理标签草稿，在保存时调用 `lib/tags.ts` 获取或创建标签 ID。
- `components/Icons.tsx` 基于 `lucide-react` 提供共用的导航与操作图标。
- `components/QuestionPreview.tsx` 渲染资料详情和错题本复用的题目、答案与解析。
- `components/Workflows.tsx` 包含题库选题、来源差异与批量导入弹窗。
- `pages/Study.tsx` 实现练习左右分栏（常规字重题干、无方框 `A/B/C/D` 选项、无底座三操作按钮与数字键/回车快捷键）、考试整卷作答、防并发 409 草稿队列、暂停遮罩与焦点返回以及成绩报告。
- `pages/Learning.tsx` 包含学习概览、记录、错题、设置与回收站。设置组合 `ThemeSettingsCard`、`TagManagerCard`、`UpdateSettingsCard`、`PreferencesSettingsCard`、`DiagnosticsCard`、备份恢复区和 `CliGuideCard`。`lib/preferences.ts` 管理独立于页签状态的本地偏好。
- `components/ThemeSettingsCard.tsx` 在设置页提供预设预览、自定义颜色与对比度调整。`components/ThemeModeToggle.tsx` 提供标题栏快捷切换。
- `components/UpdateSettingsCard.tsx` 显示桌面更新状态和操作，纯 Web 环境查询 GitHub Releases API。`lib/desktop-updater.ts` 读取桌面更新状态，供设置卡片和侧栏提示使用。
- `components/Markdown.tsx` 懒加载 `MarkdownContent.tsx`，离线渲染 Markdown 与 KaTeX。
- `assets/logo.svg` / `assets/serif.woff2` 由 Vite 解析和打包，字体授权保留在 `public/assets/LICENSE.txt`。

## API、仓储与附件

- `packages/server/src/app.ts` 装配 `/api` 路由、CORS、统一错误和事务回调。
- `routes/health.ts` 经仓储探测数据库连接并返回 server 包版本。
- `routes/tags.ts` 负责标签 CRUD、关联和可选使用次数。SQLite 仓储汇总 `tag_relations`，删除标签时由外键级联清理关联。
- `services/question.service.ts` 校验题目归属、材料关系与标签。
- `services/paper.service.ts` 保存分区与套题快照，预览及应用来源更新。
- `services/session.service.ts` 固定答题快照与顺序，提交作答、统计时间并写入错题。
- `routes/analytics.ts` 通过会话与作答记录汇总热力图数据。
- `services/backup.service.ts` 处理单文档导入导出、子树归档及完整备份恢复。
- `services/folder-archive.ts` 验证归档清单、文件哈希、目录层级和内容引用。
- `services/attachment.service.ts` 定义 `IAttachmentStorage`。Blob 按 SHA-256 存储并通过 API 流式读取。
- Markdown 存 `attachment://<id>`，渲染时解析为当前后端的 `/api/attachments/:id`。旧 loopback URL 也会重写。
- `packages/database/src/repositories/index.ts` 定义服务层可调用的仓储接口及事务契约。
- `packages/database/src/sqlite/` 提供 WAL、外键、软删除、仓储与整库快照实现。
- `packages/database/src/migrations/index.ts` 执行版本化迁移，表字段类型在 `src/schema/index.ts`。
- `packages/shared/src/schemas/portable.ts` 定义版本 1 文档，验证题目、分区、标签与附件引用。
- `packages/core/src/{scoring,shuffling,timing}/index.ts` 是对应领域逻辑入口。

## 本地开发与测试

| 目标 | 命令 |
| --- | --- |
| 安装锁定依赖 | `pnpm install --frozen-lockfile` |
| Web + 本地 SQLite | `pnpm run dev:web` |
| Electron + Vite 热更新 | `pnpm run dev:desktop` |
| 类型检查 | `pnpm run lint` |
| 单元 / 集成及 core 覆盖率 | `pnpm run test` |
| 全仓构建 | `pnpm run build` |
| Electron 开发运行时冒烟及工作流 | `pnpm run test:e2e` |
| 解包产物及同套 E2E | `pnpm run package:dir` 后运行 `pnpm run test:e2e:packaged` |
| 视觉对比 / 更新全部 Windows 基线 | `pnpm exec playwright test --project=visual` / `pnpm run test:e2e:update-snapshots` |
| PNG 审阅图 | 设置 `QUARRY_CAPTURE_REVIEW=1` 后运行视觉项目 |

- `e2e/setup.ts` 为开发运行时构建 Web 并打包主进程。打包测试直接加载当前解包目录。
- `e2e/fixtures/electron.ts` 管理临时目录与重启，监控预加载、控制台、网络和渲染错误，并提供 `windowChrome()` 检查无菜单栏与 `titleBarOverlay` 状态。
- `e2e/visual.spec.ts` 写入固定题目、打乱种子和有序会话，检查 12 个页面视图（含 `result`）的 3 种布局。Windows 对比 `e2e/snapshots/win32/` 中的 36 张基线，其他平台检查页面健康。
- `[data-dynamic-date]` 标记界面中的日期和计时，`e2e/visual-screenshot.css` 固定遮罩日期的占位宽度。保留真实时间的审阅 PNG 输出到 Git 忽略的 `e2e/review-screenshots/`。
- `e2e-windows` 在 Windows 上构建并验证解包 `Quarry.exe`，随后对比视觉基线。失败时上传 `playwright-report/` 和 `test-results/`，保留 7 天。

## 桌面排查

- 启动时清除 `ELECTRON_RUN_AS_NODE`，避免 Electron 二进制进入 Node 模式。
- 调试与测试可使用 `QUARRY_USER_DATA_DIR` 隔离 SQLite、附件和恢复点。默认使用 Electron 系统数据目录。
- `file://` 渲染器依靠 Vite 的相对资源路径。loopback 后端允许桌面文件页面的 `null` origin。
- Web 端改动使用标准浏览器 API 和 `BackendClient`。原生阻塞弹窗会绕开页面交互和可访问性。
- Electron 45.2.3 可用 Playwright `_electron.launch()`，Windows 解包路径是 `apps/desktop/release/win-unpacked/Quarry.exe`。
- `e2e/zoom.spec.ts` 验证快捷键、设置同步、重启恢复、Windows 标题栏对齐，以及小窗口内的标签、热力图、资料库、弹窗和作答导航。
- 文件下载通过 Electron `will-download` 验证，fixture 将真实文件保存到测试工件目录。
- Node.js 和 Electron 使用同一个 `better-sqlite3` N-API 绑定。运行时 esbuild 将该依赖保留为外部模块。
