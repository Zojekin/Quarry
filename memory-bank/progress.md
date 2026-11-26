# 题匣 (Quarry) 研发进度与里程碑看板

> **基准依据**：`AGENTS.md`、`memory-bank/architecture.md`、`memory-bank/design-document.md`  
> **版本日志说明**：日常细粒度变更记录与正式发版 `CHANGELOG.md` 由 `release-please` 基于 Conventional Commits 自动维护；本看板记录工程级里程碑与重大架构决策。

---

## 1. 里程碑概览 (Milestones Overview)

| 阶段 / 事项 | 描述 | 状态 | 核心交付成果 |
| :--- | :--- | :---: | :--- |
| **Phase 0** | **工程骨架与基础设施** | 🟢 已完成 | pnpm Monorepo + Turborepo 初始化；`packages/shared` Zod 契约；`packages/core` 纯函数领域核心（100% 覆盖率）；`packages/database` Kysely/SQLite WAL 仓储；`packages/server` Hono 骨架 |
| **Phase 1 & 1.5** | **后端核心业务 API 与契约补齐** | 🟢 已完成 | 文件夹/题库/套题/6 题型 CRUD、双标签隔离、附件 SHA-256 虚拟存储、来源跟随预览/应用、练习草稿与显式结束、考试交卷、错题本多维筛选、文件夹 `.quarry` 导出、一票否决导入与带恢复点回滚备份 |
| **Phase 2 & 6** | **Electron 桌面宿主与 Windows 打包** | 🟢 已完成 | 随机端口本地 Hono 守护进程、沙箱化 `preload`、Windows x64 NSIS/ZIP 分发配置、`better-sqlite3` v13 N-API 预编译绑定 |
| **Issue #19** | **Windows 安装器快捷方式选项** | 🟢 已实现 | 简体中文安装向导可独立勾选桌面与开始菜单快捷方式，默认创建两项，卸载保留本地题库 |
| **Issue #20** | **闭合六棱柱应用图标** | 🟢 已实现 | Web SVG、桌面 PNG 与 Windows ICO 的竹纹和柱面接缝填充暖米白，轮廓外部透明 |
| **Issue #18** | **Windows 桌面应用更新** | 🟢 已实现 | 自动检查与后台下载、重启或退出时安装、设置状态与待重启提示、网页版发布查询 |
| **Phase 3–5** | **正式 React 19 前端交付** | 🟢 已完成 | React 19 + Vite 生产应用、多标签工作区、KaTeX 公式分块加载、资料库/编排/练习（45/55 分栏）/考试（防提前泄露）/错题复习组卷/学习看板热力图/设置/回收站，与真实 Hono/SQLite 联调通过 |
| **Issue #5** | **Quarry CLI 与题目转换 Skill** | 🟢 已完成 | `packages/shared` Portable Schema、`packages/cli`（`spec`/`validate`/`convert`）、`skills/question-converter/SKILL.md` |
| **工程治理** | **仓库清理、文档收敛与自动化流水线** | 🟢 已完成 | 清理历史原型与重复大文件、归档过时文档、收敛 `AGENTS.md`/`memory-bank`、建立双平台 CI、PR 标题门禁、`release-please` 动态发版与 Windows Release 自动打包 |
| **Phase A** | **桌面开发与回归验证** | 🟢 已实现 | Web / Desktop Dev 实时启动、离线资源与附件修复、应用内确认与输入弹窗、文件夹归档校验与事务导入、Electron 冒烟与业务流程、三种布局视觉基线 |
| **Phase B** | **桌面视觉恢复** | 已实现，待截图审阅 | React 工作区与页面恢复已确认的视觉系统，标签文字按背景亮度计算，使用真实数据生成三种布局的 33 张审阅截图 |
| **Issue #15** | **前端 `shadcn/ui` 全面重构与一体化桌面标题栏** | 🟢 已完成 | 移除旧 `visual.css` 与桌面原生菜单栏，建立 Tailwind v4 + Radix + `cmdk` 组件层、`42px` 一体化工作区标签栏、`Ctrl+K` 快速跳转、Master-Detail 题库工作台、练习左右分栏与暂停焦点恢复、更新 36 张 Windows 视觉基线 |
| **Issue #16** | **标签体验与系统设置** | 🟢 已实现 | 回车添加标签、标签用量与删除、可搜索筛选菜单、题目字号与答题及工作区偏好、本地健康探测、CLI 与题目转换 Skill 指南 |
| **Issue #17** | **预设主题与日夜切换** | 🟢 已实现 | 四套双色板、跟随系统和本地持久化、启动预应用、自定义四项配色与 WCAG 对比度调整、设置页和标题栏切换、Windows 原生按钮区同步 |
| **Issue #31** | **桌面界面缩放与小窗口布局** | 🟢 已实现 | 七档缩放、快捷键与设置同步、重启恢复、按工作区限制窗口尺寸、原生按钮区对齐、小视口滚动及打包应用回归测试 |

---

## 2. 关键架构决策记录 (Architecture Decisions)

| 决策 ID | 事项说明 | 决策结果 | 状态 |
| :--- | :--- | :--- | :---: |
| **DEC-001** | 前后端解耦 | 业务通信通过 `BackendClient` 面向标准 HTTP REST。渲染器通过可选的桌面宿主接口同步 Windows 按钮颜色，并使用共享类型管理应用更新 | ✅ 已敲定 |
| **DEC-002** | 数据库抽象 | 排除 Prisma，采用 Kysely + `better-sqlite3`（WAL + 外键）；业务层仅依赖 Repository 接口 | ✅ 已敲定 |
| **DEC-003** | 附件虚拟化 | 本地按 SHA-256 哈希防重存储，对外仅暴露 `/api/attachments/:id` 虚拟 URL | ✅ 已敲定 |
| **DEC-004** | 选项身份绑定 | 选项使用稳定 UUID 标识，答案绑定选项 ID；打乱仅改变展示顺序与 A/B/C/D 映射 | ✅ 已敲定 |
| **DEC-005** | 自动化发版与产物规范 | 采用 `release-please` Manifest 模式同步 Monorepo 全包版本号。Tag 与 Release 标题均不带 `v` 前缀，Release 正文自动移除开头重复的版本标题。Windows 发布上传 NSIS `.exe`、绿色 `.zip` 及 `latest.yml`，更新清单记录安装包的 SHA-512，GitHub Releases 为各附件提供 SHA-256 摘要 | ✅ 已敲定 |
