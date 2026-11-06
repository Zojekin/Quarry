# 自定义题目软件 技术栈规范 (Tech Stack Specification)

基于 `design-document.md` 的产品定位与架构约束，本技术栈遵循 **“简单、健壮、高度解耦、全链路类型安全”** 的核心原则，採用 **TypeScript 端到端同构架构 (pnpm Monorepo)**，满足 Windows 桌面离线使用、严格分层、可替换数据库适配器以及未来平滑演进至自託管服务器的需求。

* * *

## 1. 架构总览与选型矩阵

| 分层领域               | 推荐选型                        | 关键库 / 工具                                   | 核心职责与选型理由                                                                      |
| ------------------ | --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| **Monorepo 管理**    | pnpm Workspaces             | `pnpm` + `turborepo`                       | 严格隔离前端、后端、核心领域与共享类型，共享依赖硬链接节省磁盘空间，构建快速。                                        |
| **桌面外壳**           | Electron                    | `electron-vite`                            | 成熟度最高，生命週期可控；内嵌託管本地后端进程，在 Windows 全版本环境中稳定可靠，避免 Webview 兼容性碎片化。                |
| **前端框架**           | React 19 + Vite             | `react`, `react-dom`, `vite`               | 响应式组件生态成熟，複杂文档树、交互式表单与题目渲染的开发效率高。                                              |
| **样式与 UI 体系**      | Tailwind CSS + shadcn/ui    | `@radix-ui/*`, `lucide-react`              | 零运行时 CSS；基于 Radix 原生无障碍组件，完美实现文件管理器佈局、抽屉浮层、主题切换（浅色/深色/跟随系统）。                   |
| **富文本与排版**         | Markdown + KaTeX + Prism    | `markdown-it`, `katex`, `prismjs`          | 满足 Markdown 排版、数学公式与代码高亮。KaTeX 速度极快且离线字体包完整；markdown-it 插件体系稳定高效。              |
| **拖拽与列表虚拟化**       | @dnd-kit + TanStack Virtual | `@dnd-kit/core`, `@tanstack/react-virtual` | `@dnd-kit` 支持题目分区、固定组整组移动等複杂约束；`react-virtual` 保障考试模式整卷长列表滚动丝滑不卡顿。             |
| **客户端状态管理**        | Zustand + TanStack Query    | `zustand`, `@tanstack/react-query`         | Zustand 管理计时器、暂停遮罩、侧边栏抽屉等纯前端状态；TanStack Query 负责接口缓存、异步请求与乐观更新。                |
| **后端运行时与 Web 框架**  | Node.js (LTS) + Hono        | `hono`, `@hono/node-server`                | 启动耗时 <10ms，内存开销极低（十馀 MB）；标准 Web API 接口规范；自带 `hono/client` 实现端到端类型安全 RPC。       |
| **数据校验与模型契约**      | Zod                         | `zod`                                      | 前后端共享 DTO 与实体校验，严格拦截非法输入，保证导入导出时“一票否决”式校验。                                     |
| **业务核心层 (Domain)** | 纯 TypeScript 模块             | 无外部副作用库                                    | 单选/多选/不定项/填空等 6 大题型判分逻辑、种子随机打乱、用时跨午夜切分纯函数，100% 单元测试覆盖。                         |
| **数据库接入与抽象**       | Kysely (Repository 模式)      | `kysely`, `better-sqlite3`                 | 仓储接口解耦。Kysely 是零二进制依赖的类型安全 SQL 构建器；首版走 `better-sqlite3` WAL 模式，未来更换数据库只需替换适配器。 |
| **附件与存储**          | 虚拟化存储适配器                    | 本地文件系统 + `crypto` (SHA-256)                | 附件独立封装，按哈希去重存放于应用数据目录，对外仅暴露资源 ID，前端不直接感知绝对路径。                                  |
| **导出与备份打包**        | 归档工具                        | `archiver`, `unzipper`                     | 支持将题目模型、JSON/Markdown 与附件打包为 `.zip` 容器；导入前强制校验数据结构与版本号并支持事务回滚。                 |

* * *

## 2. 工程化拓扑 (pnpm Monorepo)

    ├── apps/
    │   ├── desktop/               # Electron 主进程与预加载脚本 (窗口管理、生命週期、託管本地后端)
    │   └── web/                   # 网页前端 UI (React 19 + Vite，可打入 Electron 或独立部署)
    └── packages/
        ├── core/                  # 领域核心 (判分算法、Fisher-Yates 打乱、时间跨天切分，纯函数无依赖)
        ├── shared/                # 共享契约 (Zod Schema、DTO、统一错误码与语义、常量)
        ├── server/                # 后端服务核心 (Hono 路由、业务控制器、附件管理服务)
        └── database/              # 数据访问层 (Kysely 定义、Repository 仓储接口、SQLite 驱动与迁移脚本)

* * *

## 3. 关键架构决策与设计依据

### 3.1 前后端解耦与通信机制 (统一 Client 契约)

* **设计规范要求**：
  * “前端通过统一后端客户端接口操作，不直接访问数据库。”
  * “首版实现本地连接与本地后端，预留远程连接接口。未来桌面端既可连接本地后端，也可连接自託管服务器后端。”
* **实现方桉**：
  * Electron 主进程启动时，在本地随机端口拉起 Node.js + Hono HTTP 服务（监听 `127.0.0.1:{random_port}`）。
  * 前端封装统一的 `BackendClient`。本地运行时设置 `baseURL = http://127.0.0.1:{port}`；未来连接自託管远程后端时，仅需切换 `baseURL` 并携带认证 Token。
  * 前端完全不使用 Electron 专有的 IPC 远程过程调用，确保前端代码在桌面端与独立浏览器端 100% 可复用。

### 3.2 数据库接入层：仓储模式 (Repository Pattern) + Kysely

* **设计规范要求**：
  * “数据库通过统一接入层访问，具体数据库由可替换适配器实现；业务层不得直接依赖数据库驱动或专用查询。更换数据库不应重写业务逻辑或页面。”
* **选型理由与排他分析**：
  * **排除 Prisma**：Prisma 依赖底层 Rust 引擎二进制文件，在 Electron 打包（ASAR 虚拟路径、杀毒软件拦截）时常引发加载失败与体积膨胀。
  * **採用 Kysely + better-sqlite3**：
    * 业务层仅依赖抽象接口（如 `IQuestionRepository`, `IPaperRepository`, `IStudyRecordRepository`）。
    * Kysely 是纯 TypeScript 的类型安全查询构建器，零原生二进制依赖，原生兼容 SQLite、PostgreSQL、MySQL 方言。
    * 本地首版适配器採用 `better-sqlite3`，开启 WAL (Write-Ahead Logging) 模式与外键约束（`PRAGMA foreign_keys = ON;`），同步读写无异步死锁风险，断电数据不损坏。
    * 未来适配自託管 PostgreSQL 时，只需在 `packages/database` 新增 `PostgresAdapter`，核心业务逻辑零修改。

### 3.3 判分算法与业务核心独立性 (Domain Isolation)

* **设计规范要求**：
  * 单选、多选（完全匹配/比例得分）、不定项、严格填空、主观题。
  * 选项身份绑定（非字母绑定）、题目打乱、共用材料题不拆散、固定组移动。
  * 答题计时防作弊不干预，但手动暂停遮罩、跨午夜时间拆分统计。
* **实现方桉**：
  * 全部沉淀于 `packages/core`，作为纯函数（Pure Functions）实现，不依赖任何外部 I/O 或数据库连接。
  * 选项随机打乱使用带种子的 Fisher-Yates 算法，答桉严格绑定选项唯一 ID，渲染层再映射为 A/B/C/D 序号。
  * 完整的单元测试套件（Vitest）覆盖判分与边界条件，确保本地计算与未来服务端计算结果高度一致。

### 3.4 附件存储虚拟化 (Attachment Abstraction)

* **设计规范要求**：
  * “附件存储独立封装，不要求前端理解本机绝对路径。”
* **实现方桉**：
  * 定义 `IAttachmentStorage` 接口。
  * 本地实现：附件存入应用专用目录（`%APPDATA%/custom-exam/attachments/`），文件以 SHA-256 哈希命名防重。
  * 前端引用格式均为虚拟路径或资源 ID（如 `attachment://<hash>` 或 `GET /api/attachments/:id`），由本地后端流式返回，前端无法也不需要获取系统盘符路径。

### 3.5 导入导出与备份机制 (Transactional Integrity)

* **设计规范要求**：
  * 支持 Markdown、JSON、自有格式，校验有错误时整份拒绝，不静默跳过。
  * 完整备份包含分类、标籤、题目、附件、学习记录与错题本；恢复时明确提示并保留恢复点。
* **实现方桉**：
  * 使用 `Zod` 定义严格的导入 Schema，解码失败或格式错误立即中断并输出具体错误行/字段。
  * 备份採用 `.zip` 结构归档（包含 `manifest.json`、`data.json` 与 `attachments/` 目录）。
  * 数据恢复时，在事务中先创建当前数据库快照（Recovery Point），校验新数据完整性后再全量替换，若失败则自动回滚。

* * *

## 4. 前端关键交互与技术映射

| 功能需求             | 技术选型                                   | 具体实现手段                                                   |
| ---------------- | -------------------------------------- | -------------------------------------------------------- |
| **文件管理器佈局**      | `shadcn/ui` + `react-resizable-panels` | 实现可拖动调整宽度、侧边栏固定与抽屉浮层切换，支持快捷键（Esc 收起、全局导航）。               |
| **主题与字号**        | `next-themes` + Tailwind CSS           | CSS 变量控制浅色、深色、跟随系统；通过根元素动态调整 Rem/Em 实现答题字号无级缩放。          |
| **Markdown 与公式** | `markdown-it` + `katex` + `prismjs`    | 自定义插件集成，将 `$$...$$` 转为 KaTeX HTML，代码块自动高亮，图片路径自动转发至附件接口。 |
| **套题分区与分组编排**    | `@dnd-kit/core` + `@dnd-kit/sortable`  | 自定义拖拽策略，限制固定组组内不可拆分、共用材料题小题顺序固定、支持题型分区间或分区内拖拽。           |
| **考试模式整卷长列表**    | `@tanstack/react-virtual`              | 动态高度虚拟列表滚动，即使整卷包含上百道题目、公式和图片，内存佔用依然平稳流畅。                 |
| **学习看板与热力图**     | 自研 SVG 热力图组件 + `recharts`              | 轻量彷 GitHub 贡献热力图网格，支持答题量/用时切换着色；Recharts 绘制趋势走势图。        |

* * *

## 5. 技术选型边界与非目标 (Out of Scope for v1)

1. **不使用 Rust / C++ 混合开发**：首版保证快速迭代与稳定交付，全链路 TypeScript 可大幅降低心智负担与多语言胶水调试成本。
2. **不使用沉重的重量级 ORM (如 TypeORM / Prisma)**：避免原生二进制跨平台打包陷阱，採用纯 TS 构建的 Kysely。
3. **前端不绑定任何 Electron 特有模块**：保证前端代码无缝兼容标准浏览器环境。
4. **不引入在线云端同步或 WebSocket 实时协议**：严格遵循离线优先原则，首版仅提供标准 HTTP 请求。
