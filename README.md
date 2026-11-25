<div align="center">

<img src="apps/web/src/assets/logo.svg" alt="题匣 Logo，暖米白竹纹的绿色六棱柱" width="128" height="128" />

# 题匣 (Quarry)

**收纳自守 · 采石成金**  
个人离线题库与套题管理、练习考试及错题复习工具

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-Node-orange.svg)](https://hono.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57.svg)](https://sqlite.org/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F.svg)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 项目简介

**题匣 (Quarry)** 是一款面向个人深度学习与专业备考的**纯本地、离线优先**题库管理与刷题软件。

无论是法学、医学等文科大体量客观题与案例材料题，还是理工科复杂的 LaTeX 数学公式、代码块排版，“题匣”均提供流畅、专注的做题体验。系统严格遵循四道解耦架构防线，业务数据全部由本地 SQLite 数据库与虚拟化附件仓储管理，保证断电不丢数据、离线秒级启动。

---

## ✨ 核心功能特性

### 1. 全面题型与专业排版
* **六大核心题型**：单选、多选（支持少选比例得分）、不定项选择、严格填空（逐字符精准比对、支持多空多备选答案）、非严格填空及主观题。
* **富文本与公式支持**：内置离线 KaTeX 引擎，支持行内公式 `$E=mc^2$` 与块级公式，支持 Markdown 代码高亮、表格与共用材料嵌套小题（禁用原始 HTML）。
* **独立双标签体系**支持文件夹、题库和套题的文件标签，以及单独的题目标签。编辑时可搜索已有标签，按 Enter 添加输入的文字。新标签随编辑保存，使用统一的系统默认色。

### 2. 科学套题编排与防作弊打乱
* **灵活分区与固定组**：按题型自动分区，支持固定题目组“整组原子移动”，共用材料小题严格保序。
* **带种子确定性打乱**：采用带种子 Fisher-Yates 算法，选项打乱与题目选项唯一 ID 绑定（非字母绑定），重新打开会话能 100% 还原当时的题目与选项顺序。
* **源题库单向跟随**：套题可关联题库，源题修改后提供详细差异对比预览并支持一键同步更新；源题删除自动留存快照并标记失效。

### 3. 双模式答题与严谨计时
* **练习模式**：宽白卡 45/55 分栏排版，点击“查看答案”后即时判分并锁定本次作答；重新作答追加新尝试并保留历史轨迹；切题自动保存草稿，断点随时恢复。
* **考试模式**：整卷作答流程，交卷前绝不泄露答案与对错；支持考试倒计时与到期自动交卷。
* **防虚高计时**：手动暂停弹出全屏遮罩并停止计时；窗口失焦不暂停，关机休眠离线时长不计入练习量；跨午夜时段按自然日比例拆分。

### 4. 智能错题本与学习看板
* **自动/手动错题收录**：未拿满分的题目提交时自动归集，主观题可一键收录；同源同版本错题自动合并做错历史。
* **掌握状态流转**：支持标记“待复习 / 已掌握”；已掌握题目后续重做再次判错，自动回退到待复习。
* **多维筛选与一键组卷**：按来源套题、文件夹层级、题型、标签、收录日期多维联动筛选（同维 OR / 跨维 AND），一键生成专属复习套题。
* **学习数据看板**：累计用时、做题量、去重题数统计，配有按答题量/用时切换着色的 365 天每日学习热力图。

### 5. 坚固的数据安全与 CLI 生态
* **一票否决严格导入**：导入 Markdown / JSON / `.quarry` 文件时若有一处语法错误整份拒绝并指明行号，绝不污染现有题库。
* **文件夹归档往返**：资料库可导出和导入文件夹 `.quarry` 归档。导入前校验归档校验和并预览数量，提交后在根目录创建新子树。
* **带后悔药的备份回滚**：全量导出为包含完整数据库与附件的 `.quarry-backup` 容器；恢复备份前自动在本地保存还原点快照，发生异常自动回滚。
* **两阶段安全回收站**：资料删除先进入回收站软删除，可随时完整还原，清空回收站才物理清除；学习与错题历史独立保留。
* **Quarry CLI 与题目转换 Skill**支持用轻量 Markdown 题目 DSL 编写草稿，通过 `pnpm quarry validate` 和 `pnpm quarry convert` 生成合规导入文件。系统设置提供命令速查、可复制模板及 AI Skill 使用说明。

### 6. 系统设置

* **标签管理**支持新增、改名、自定义颜色、恢复系统默认色，以及查看用量并确认删除。资料库和错题本等页面的筛选菜单支持搜索、全选和清空。
* **显示与操作**支持调整题目字号、手动交卷确认、答题快捷键提示、启动时是否收起侧边栏，以及资料库默认视图。
* **运行诊断与存储**可检查本地服务和数据库状态。系统设置也提供完整备份与恢复入口。

---

## 🏗️ 架构拓扑

采用 TypeScript 端到端同构的 **pnpm Monorepo** 架构：

```text
quarry/
├── apps/
│   ├── desktop/          # Electron 宿主 (随机端口 Node.js 后端守护进程、沙箱预加载与 Windows 打包)
│   └── web/              # React 19 + Vite Web 应用 (多工作区标签、BackendClient、离线 KaTeX)
├── packages/
│   ├── core/             # 领域核心 (判分算法、种子打乱、跨天切分，纯函数零 IO，100% 覆盖率)
│   ├── database/         # 数据访问层 (Kysely + SQLite better-sqlite3 WAL 模式，仓储模式解耦)
│   ├── server/           # 后端服务层 (Hono RESTful API、附件流式服务、导入导出/备份回滚引擎)
│   ├── shared/           # 共享契约层 (Zod Schema、DTO、Enums、AppError、Portable 契约)
│   └── cli/              # Quarry CLI (轻量 Markdown 题目 DSL 校验与 JSON/Markdown 导入文件转换)
└── skills/
    └── question-converter/  # AI Agent 题目格式转换 Skill
```

---

## 🚀 快速上手

### 环境要求
* **Node.js**: 22.14.0 及以上的 22.x，或 23.6.0 及以上（支持 Node-API 10）
* **pnpm**: `>= 10.0.0`

### 1. 安装依赖
```bash
pnpm install
```

### 2. 类型检查、测试与构建
```bash
# 全仓 TypeScript 类型检查
pnpm lint

# 全仓单元测试与集成测试（覆盖全部 7 个包及应用，含 core 100% 覆盖率）
pnpm test

# 全仓编译构建
pnpm build
```

### 3. 启动开发环境
* **Web Dev** 为 Vite 启动真实的本地 Hono + SQLite 后端，数据保存在 `.quarry-dev-data/`，API 从端口 48123 起尝试。
  ```bash
  pnpm run dev:web
  ```
* **Desktop Dev** 启动 Vite 并打开 Electron，支持热更新。可设置 `QUARRY_USER_DATA_DIR` 指定数据目录。
  ```bash
  pnpm run dev:desktop
  ```
* 两个入口的 Vite 均绑定 `127.0.0.1`，从端口 5173 起尝试。终端会显示实际地址。

### 4. Quarry CLI 题目转换
```bash
# 查看轻量 Markdown 题目 DSL 规范与示例
pnpm quarry spec

# 校验题目草稿（.md 或 .json）
pnpm quarry validate draft.md

# 转换为题匣导入文件（支持 json / md 格式）
pnpm quarry convert draft.md -o questions.json
```

### 5. 构建 Windows 桌面分发产物
```bash
# 仅生成解包目录用于本地快速验证 (apps/desktop/release/win-unpacked)
pnpm package:dir

# 构建 Windows x64 分发包 (NSIS 安装包 / 绿色 zip)
pnpm package
```
Windows x64 打包使用 `better-sqlite3` v13 随包提供的 N-API 预编译二进制。Node.js 与 Electron 共用同一份原生绑定，无需切换 ABI 或运行 `node-gyp`。

Windows 安装向导在选择安装目录后提供桌面和开始菜单两项快捷方式设置，均默认勾选，可独立取消。首次使用 `/S` 静默安装时默认创建两种快捷方式。卸载会清理已创建的快捷方式，并保留本地题库数据。

### 6. Electron 端到端与视觉回归

桌面工作区采用 `shadcn/ui` + Tailwind CSS v4 视觉系统与统一 `42px` 无菜单栏整合标题栏（Windows `titleBarOverlay` + 全局 `Ctrl+K` 快速命令），覆盖展开侧栏、收起侧栏和窄屏布局。题库与套题支持 Master-Detail 列表/网格双视图与批量浮栏，设置中的文件标签与题目标签通过标签页分开选色并自动保存。

* `pnpm run test:e2e` 构建本地运行时并执行冒烟与完整工作流测试。
* `pnpm run package:dir` 后运行 `pnpm run test:e2e:packaged`，用同一组用例测试已解包的应用（含桌面无菜单栏、Pause Esc 焦点恢复等交互）。
* `pnpm exec playwright test --project=visual` 在 Windows 比对 36 张截图基线（12 视图 × 3 种布局），日期和计时字段统一遮罩。其他平台仍执行页面交互与健康检查。
* 在 Windows 用 `pnpm run test:e2e:update-snapshots` 重新生成全部基线。PowerShell 中设置 `$env:QUARRY_CAPTURE_REVIEW="1"` 后运行视觉项目，可在 `e2e/review-screenshots/` 获取保留真实日期的审阅图。
* GitHub Actions 的 `e2e-windows` 作业检查解包 `Quarry.exe` 的冒烟、完整工作流和重启持久化，并比对 Windows 视觉基线。Playwright 使用 Electron 自带的 Chromium。

---

## 🤝 开发与贡献

* 分支管理、Conventional Commits、CI 门禁与自动发版规范请见 [CONTRIBUTING.md](CONTRIBUTING.md)。
* AI 辅助开发规范、架构红线与文档同步要求请见 [AGENTS.md](AGENTS.md)。
* 工作区入口、运行时契约和测试定位见 [代码库地图](memory-bank/codebase-map.md)。

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 开源协议。
