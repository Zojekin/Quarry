# 题匣 (Quarry) 协作与规范 PR 模式指南 (Contributing Guide)

本文档定义了题匣项目标准、严谨的分支管理与 Pull Request (PR) 协作流程。所有代码贡献、日常功能迭代均需遵循此规范。

---

## 1. 核心工作流：GitHub Flow

本项目采用以 **`main` 为唯一稳定主干** 的 GitHub Flow 模式：
1. **主分支 `main` 受保护**：严禁直接向 `main` 分支执行 `git push`。所有修改必须通过 PR 合并。
2. **所有改动均在特性分支上进行**：按功能或缺陷从最新的 `main` 切出独立分支。
3. **自动化门禁 (CI) 护航**：每次 PR 触发 GitHub Actions 自动进行全量 `lint`、`test` 和 `build`，确保主干不被破坏。

---

## 2. 分支命名规范

分支名称建议使用小写字母、连字符与斜杠，格式为 `<类别>/<简要描述>`：

| 分支类别 | 适用场景 | 示例 |
| :--- | :--- | :--- |
| `feat/*` | 新功能开发 | `feat/exam-countdown`, `feat/tag-color-autosave` |
| `fix/*` | 缺陷或 Bug 修复 | `fix/latex-katex-render`, `fix/db-wal-lock` |
| `refactor/*`| 代码重构（不改动外部功能） | `refactor/backend-client`, `refactor/visual-tokens` |
| `docs/*` | 文档编写或更新 | `docs/api-specs`, `docs/contributing` |
| `perf/*` | 性能优化 | `perf/sqlite-query-index` |
| `chore/*` | 构建配置、依赖升级、辅助工具变动 | `chore/update-pnpm`, `chore/ci-workflow` |

---

## 3. Commit 提交信息规范 (Conventional Commits)

提交信息格式建议统一遵循：
```text
<type>(<scope>): <subject>
```
* **type**：对应上面的分支类别（`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore` 等）。
* **scope**（可选）：影响的具体包名或模块，例如 `web`, `desktop`, `core`, `database`, `server`, `shared`。
* **subject**：简要说明改动内容（中文或英文），保持动宾结构，例如：
  * `feat(web): 添加答题卡折叠展开动画`
  * `fix(database): 修复题库删除时级联软删除失效的问题`
  * `docs: 完善项目 PR 协作规范指南`

---

## 4. 日常开发标准操作步骤

### 第一步：同步主分支并切出新分支
在开始任何改动前，先拉取远程最新的 `main`：
```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### 第二步：本地开发与遵循项目规约
编写代码前请严格遵循项目的架构规范：
1. 阅读 `memory-bank/@architecture.md` 与 `memory-bank/@design-document.md`。
2. 保持模块功能解耦，减少交叉引用，避免循环依赖。
3. 若本轮修改属于重大功能或里程碑，务必同步更新 `memory-bank/@architecture.md` 与 `memory-bank/@progress.md`。

### 第三步：本地质量检查
在提交前，请在本地运行验证脚本：
```bash
# 执行代码质量与类型检查
npx pnpm run lint

# 执行全量单元测试与集成测试
npx pnpm run test

# 执行全项目构建
npx pnpm run build
```

### 第四步：提交代码并推送到 GitHub
```bash
git add .
git commit -m "feat(module): 描述本次改动"
git push -u origin feat/your-feature-name
```

### 第五步：在 GitHub 发起 PR
1. 打开 GitHub 仓库页面，点击 **"Compare & pull request"**。
2. 页面会自动带入项目预设的 PR 模板（`.github/pull_request_template.md`）。
3. 按照模板勾选变更类型、关联 Issue，并逐项确认【质量合规检查清单】。
4. 点击 **"Create pull request"**。

### 第六步：等待 CI 通过与审查合并
1. GitHub Actions 会自动运行 CI，检查代码的测试与构建是否全绿（通过）。
2. 自查无误后，点击 **"Merge pull request"**（推荐选择 **Squash and merge**，保持 `main` 提交历史清爽一条线）。

### 第七步：本地清理并准备下一轮开发
```bash
git checkout main
git pull origin main
git branch -d feat/your-feature-name  # 删除本地已合并的分支
```

---

## 5. 建议配置：GitHub 网页端分支保护 (Branch Protection)

为防止意外直接向 `main` 推送，强烈建议在 GitHub 仓库中开启分支保护规则：

1. 进入 GitHub 仓库 -> 点击顶部 **Settings** 标签页。
2. 在左侧菜单点击 **Branches** -> 点击 **Add branch protection rule**。
3. **Branch name pattern** 填写：`main`。
4. 勾选以下核心规则：
   * **Require a pull request before merging**（合并前必须通过 PR）
   * **Require status checks to pass before merging**（合并前必须通过状态检查）：并在下方搜索框中添加 `verify`（即 GitHub Actions 的 CI 任务）。
   * **Do not allow bypassing the above settings**（包含管理员在内，均不能绕过该规则）。
5. 点击底部 **Save changes** 保存。
