## 📌 PR 描述 (PR Description)

<!-- 简要说明本次 PR 的背景、改动内容及解决的问题 -->

### 变更类型 (Type of Change)
- [ ] 🌟 `feat`: 新增功能
- [ ] 🐛 `fix`: 缺陷修复
- [ ] ♻️ `refactor`: 代码重构（不影响外部行为）
- [ ] ⚡ `perf`: 性能优化
- [ ] 📝 `docs`: 文档变更
- [ ] 🧪 `test`: 单元测试或集成测试新增/补充
- [ ] 🔧 `chore`: 构建系统、依赖更新或辅助工具变动
- [ ] 🤖 `ci`: CI/CD 与发版流水线调整

### 影响范围 (Affected Packages / Apps)
- [ ] `apps/desktop`
- [ ] `apps/web`
- [ ] `packages/core`
- [ ] `packages/database`
- [ ] `packages/server`
- [ ] `packages/shared`
- [ ] `packages/cli`
- [ ] `skills/question-converter`
- [ ] `docs / memory-bank`
- [ ] 根工程配置 / 基础设施

### 关联 Issue (Related Issue)
<!-- 如果有关联的 Issue，请在此处填写，例如 Closes #123 -->
Closes #

---

## 🔍 改动详情与架构说明 (Changes Details)

<!-- 详细描述改动的核心逻辑、解耦考虑或接口变更；若无需同步文档请在此注明 -->

---

## ✅ 质量合规检查清单 (Checklist)

> 请在提交 PR 前逐项确认满足以下条件：

- [ ] **规范文档阅读**：已阅读并遵循 `memory-bank/architecture.md` 与 `memory-bank/design-document.md`（未以 `docs/archive/` 为依据）
- [ ] **文档联动检查**：若涉及新增/变更功能、命令脚本、目录架构或数据契约变动，已同步更新 `README.md`、`memory-bank/architecture.md` 与 `memory-bank/progress.md`（否则请在上方说明无需更新文档）
- [ ] **架构质量**：遵循四道架构解耦防线，无循环依赖
- [ ] **命名与格式**：PR 标题符合 Conventional Commits，代码格式统一
- [ ] **本地验证**：
  - [ ] Lint 检查通过 (`pnpm run lint`)
  - [ ] 单元/集成测试通过 (`pnpm run test`)
  - [ ] 项目构建成功 (`pnpm run build`)
- [ ] **代码自测**：已在本机或目标环境中完成基础自测
