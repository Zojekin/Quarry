<div align="center">

<img src="memory-bank/logo/题匣-logo-透明版.svg" alt="题匣 Logo" width="128" height="128" />

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

## 📖 项目简介 (Introduction)

**题匣 (Quarry)** 是一款面向个人深度学习与专业备考的**纯本地、离线优先**题库管理与刷题软件。

无论是法学、医学等文科大体量客观题与案例材料题，还是理工科复杂的 LaTeX 数学公式、代码块排版，“题匣”均提供流畅、专注的做题体验。系统严格遵循四道解耦架构防线，业务数据全部由本地 SQLite 数据库与虚拟化附件仓储管理，保证断电不丢数据、离线秒级启动。

---

## ✨ 核心功能特性 (Features)

### 1. 全面题型与专业排版
* **六大核心题型**：单选、多选（支持少选比例得分）、不定项选择、严格填空（逐字符精准比对、支持多空多备选答案）、非严格填空及主观题。
* **富文本与公式支持**：内置离线 KaTeX 引擎，完美渲染行内公式 `$E=mc^2$` 与块级公式，支持 Markdown 代码高亮、表格与共用材料嵌套小题。
* **独立双标签体系**：文件标签（文件夹/题库/套题）与题目标签物理隔离，互不穿插。

### 2. 科学套题编排与防作弊打乱
* **灵活分区与固定组**：按题型自动分区，支持固定题目组“整组原子移动”，共用材料小题严格保序。
* **带种子确定性打乱**：采用带种子 Fisher-Yates 算法，选项打乱与题目选项唯一 ID 绑定（非字母绑定），重新打开会话能 100% 还原当时的题目与选项顺序。
* **源题库单向跟随**：套题可关联题库，源题修改后提供详细差异对比预览并支持一键同步更新；源题删除自动留存快照并标记失效。

### 3. 双模式答题与严谨计时
* **练习模式**：宽白卡 45/55 分栏排版，点击“查看答案”后即时判分并锁定本次作答；重新作答追加新尝试并保留历史轨迹；切题实时自动保存草稿，断点随时恢复。
* **考试模式**：整卷作答流程，交卷前绝不泄露答案与对错；支持考试倒计时与到期强制自动交卷。
* **防虚高计时**：手动暂停弹出全屏黑屏遮罩并停止计时；窗口失焦不暂停，关机休眠离线时长不计入练习量；跨午夜时段按本地自然日比例拆分。

### 4. 智能错题本与学习看板
* **自动/手动错题收录**：未拿满分的题目提交时自动归集，主观题可一键收录；同源同版本错题自动合并做错历史。
* **掌握状态流转**：支持标记“待复习 / 已掌握”；已掌握题目后续重做再次判错，自动回退到待复习。
* **多维筛选与一键组卷**：按来源套题、文件夹层级、题型、标签、收录日期多维联动筛选，一键生成专属复习套题。
* **学习数据看板**：累计用时、做题量、去重题数统计，配有按答题量/用时切换着色的 365 天每日学习热力图。

### 5. 坚固的数据安全防线
* **一票否决严格导入**：导入 Markdown / JSON 文件时若有一处语法错误整份拒绝并指明行号，绝不污染现有题库。
* **带后悔药的备份回滚**：全量导出为包含完整数据库与附件的 `.quarry` 容器；恢复备份前自动在本地保存还原点快照，发生异常一秒回滚。
* **两阶段安全回收站**：资料删除先进入回收站软删除，可随时完整还原，清空回收站才物理清除。

---

## 🏗️ 架构拓扑 (Architecture)

采用 TypeScript 端到端同构的 **pnpm Monorepo** 架构：

```
quarry/
├── apps/
│   ├── desktop/          # Electron 宿主 (随机端口 Node.js 后端守护进程与窗口管理)
│   └── web/              # React 19 + Vite Web 应用 (统一 BackendClient 访问)
└── packages/
    ├── core/             # 领域核心 (判分算法、种子打乱、跨天切分，纯函数零 IO，100% 测试覆盖)
    ├── database/         # 数据访问层 (Kysely + SQLite better-sqlite3 WAL 模式，仓储模式解耦)
    ├── server/           # 后端服务层 (Hono Node.js RESTful API、附件流式服务、备份引擎)
    └── shared/           # 共享契约层 (Zod Schema、DTO 模型校验、枚举与统一错误语义)
```

---

## 🚀 快速上手 (Quick Start)

### 环境要求
* **Node.js**: `>= 22.13.0`
* **pnpm**: `>= 10.0.0`

### 1. 安装依赖
```bash
pnpm install
```

### 2. 运行全套自动化测试
```bash
pnpm test
```
*(包含全仓 155 项纯函数领域、数据库事务与端到端集成测试)*

### 3. 启动开发环境
* **启动 Web 前端独立开发调试**：
  ```bash
  pnpm --filter @quarry/web dev
  ```
* **启动 Electron 桌面应用**：
  ```bash
  pnpm --filter @quarry/desktop dev
  ```

### 4. 构建生产产物与打包
```bash
# 全包编译
pnpm build

# 构建 Windows x64 桌面安装程序 (.exe / portable)
pnpm --filter @quarry/desktop dist
```

---

## 📄 开源许可证 (License)

本项目采用 [MIT License](LICENSE) 开源协议。
