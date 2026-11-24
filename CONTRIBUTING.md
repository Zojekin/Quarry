# 题匣 (Quarry) 协作、PR 与发版规范

本文档定义题匣项目的 Git 分支模型、Conventional Commits 规范、T3 Code Worktree 协作流程、CI 门禁与自动发版机制。所有功能开发、缺陷修复与文档更新均需遵循此规范。

---

## 1. 核心工作流：GitHub Flow + Worktree 隔离

本项目以 **`main` 为唯一受保护主干**：
1. **禁止直推 `main`**：仓库已开启分支保护 Ruleset，所有改动必须通过特性分支发起 Pull Request 并以 **Squash Merge** 合入 `main`（合并后远端分支自动清理）。
2. **独立任务用独立 Worktree**：在 T3 Code 中为每个独立任务创建 Worktree 线程（或分支），避免多个并行任务互相覆盖。新建 Worktree 会自动执行 `t3.json` 中的初始化脚本（`pnpm install --frozen-lockfile`）。

---

## 2. 分支命名与 Conventional Commits 规范

### 分支命名
格式为 `<type>/<short-desc>`，使用小写字母与连字符：
- `feat/*`：新功能（如 `feat/exam-countdown`）
- `fix/*`：缺陷修复（如 `fix/sqlite-abi-guard`）
- `refactor/*`：内部重构（不改变对外行为）
- `docs/*`：文档更新
- `perf/*`：性能优化
- `test/*`：测试补充
- `ci/*`：CI/CD 与发版流程配置
- `chore/*`：构建配置、依赖升级或工程清理

### Commit 与 PR 标题规范
CI 的 `PR Title (Conventional Commits)` 检查会强制校验 PR 标题格式：
```text
<type>(<scope>): <subject>
```
* **type**：`feat`、`fix`、`docs`、`refactor`、`perf`、`test`、`ci`、`chore` 等。
* **scope**（可选）：`web`、`desktop`、`core`、`database`、`server`、`shared`、`cli` 等。
* **破坏性变更**：在冒号前加 `!`（如 `feat(shared)!: ...`）或正文含 `BREAKING CHANGE:`，发版时将触发主版本号升级。

> **关键提醒**：仓库采用 **Squash Merge 且以 PR 标题作为 `main` 上的提交标题**。PR 标题决定 `release-please` 如何计算版本号与生成 `CHANGELOG.md`。

---

## 3. 标准开发与 PR 闭环流程

1. **读规范与拉分支**：
   - 开始编码前阅读 `AGENTS.md`、`memory-bank/architecture.md` 与 `memory-bank/design-document.md`（**严禁**以 `docs/archive/` 作为现行依据）。
   - 从最新 `origin/main` 切出独立 Worktree / 分支。
2. **编码与 PR 内文档联动**：
   - 若改动涉及**新增/变更功能、命令或脚本变化、目录/架构调整、数据契约变动**，必须在**同一个 PR** 内同步更新：
     - `README.md`
     - `memory-bank/architecture.md`
     - `memory-bank/progress.md`
3. **本地全量校验**：
   ```bash
   pnpm run lint   # 或本地使用 npx pnpm run lint
   pnpm run test
   pnpm run build
   ```
4. **提交、提 PR 与 T3 Code 值守**：
   - 推送分支并提交 PR（自动带入 `.github/pull_request_template.md` 核对清单）。
   - 在 T3 Code 中使用 `link_pull_request` 关联 PR，按需生成 `PR Guide` 或启动独立 Review 子 Agent 预审，并开启 `watch_pull_request` 值守。
   - 等待 GitHub Actions 双平台门禁（`pr-title` + `ubuntu-latest` + `windows-latest` 全量 `lint / test / build`）全绿。
5. **合并与自动 Settle**：
   - 人工确认无误后点击 **Squash and merge**。
   - T3 Code 自动将线程标记为 Settled 并触发 `stopOnSettle` 停止后台预览服务。

---

## 4. 动态攒改动与一键自动发版 (`release-please`)

本项目使用 **`release-please` Manifest 模式**管理发版：
1. **日常累积变更（不立即发版）**：
   - 每次有新的 `feat:` / `fix:` PR 合入 `main` 时，`.github/workflows/release-please.yml` 自动计算下一个版本号，创建或滚动更新一个动态 **Release PR**（同步更新根 `package.json`、全部 7 个子包 `package.json`、`.release-please-manifest.json` 及 `CHANGELOG.md`）。
   - **版本命名约定**：Git Tag 与 GitHub Release 标题均使用**不带 `v` 前缀**的版本号（例如 `0.2.1`）。Tag 格式由 `release-please-config.json` 中的 `"include-v-in-tag": false` 控制。
   - 如需手动指定目标版本号，可在提交信息正文附加 `Release-As: X.Y.Z`。
2. **手动定格正式 Release**：
   - 当积累的功能与修复达到发版时机时，审查并点击合并该 **Release PR**。
   - 合并瞬间自动完成：
     1. 打出 `X.Y.Z` Git Tag 并创建 GitHub Release；
     2. 自动触发 `build-windows` 任务在 `windows-latest` 上执行 `pnpm run package`；
     3. 上传 Windows x64 安装包 `Quarry-Setup-<version>-x64.exe` 与绿色压缩包 `Quarry-<version>-win-x64.zip`。GitHub Releases 为每个附件提供原生 SHA-256 摘要。
     4. 将 Release 标题设为版本号，并自动移除 Release 正文开头重复的版本标题。`CHANGELOG.md` 保留完整版本标题。
