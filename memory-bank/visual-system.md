# 题匣视觉系统

本文件记录题匣正式前端（`apps/web`）采用 `shadcn/ui` + Tailwind CSS v4 重构后的现行视觉与交互规则。基础主题令牌、衬线体声明、`@theme inline` 映射与热力图/标题栏样式统一位于 `apps/web/src/index.css`；Markdown、KaTeX 与文件输入按钮适配位于 `apps/web/src/production.css`；`apps/web/src/components/ui/` 存放 shadcn/Radix 基础原语，`apps/web/src/components/ui.tsx` 导出业务高阶封装（`Modal`、`Facet`、`SearchField`、`Segmented`、`StatusPill`、`NavigationControls` 等）。

## 字体与层级

- **字体族**：标题、题干与大号指标使用 `QuarrySerif`（`--font-serif`）；操作控件与管理表格使用无衬线体（`--font-sans`）；计时器、题号、统计计数启用 `tabular-nums` / `--font-mono`。
- **题干与选项克制字重**：无论练习模式、考试模式还是预览卡片，题干统一使用常规字重（`font-normal`，练习分栏 `19px`、考试整卷 `18px`）；选项序号 `A/B/C/D` 直接使用粗体纯字母（`font-bold`），**不套内嵌按键方框**。
- **分隔克制原则**：尽量避免多余的硬性水平分割线（如侧栏、答题导航区、套题详情页头均不额外铺设 `<hr>` 或重底边线），通过自然留白与卡片表面层级区隔内容。

## 颜色与三层表面系统

- **三层表面**：侧栏与统一标题栏 `#f3f3ee`（`--sidebar`）→ 主工作画布纸白 `#fafaf7`（`--background`）→ 内容卡片 `#ffffff`（`--card`）。
- **核心强调色**：松绿 `--primary: #2d5c48` / `--primary-hover: #224737`；辅助 `#666e68`（`--muted-foreground`）；边框使用 `1px` 微透明墨色（`rgba(23, 27, 25, 0.09)`）。
- **待判分选中态**：`--selection-bg: #f6efd9`、边框 `--selection-border: #d7c797`、前景色 `--selection-ink: #5a4b28`。
- **正误与状态**：`--success-*`（`#e7f4ec` / `#1f663e`）、`--error-*`（`#fbeceb` / `#b23a31`）、`--info-*`、`--warning-*` 仅用于语义状态与锁定判分，不与标签分类混用。
- **标签配色**：`tagColorStyle` 基于 Persist 色或默认回退色自动计算 WCAG 高对比前景色。

## 触感工艺、外壳与关键布局

- **统一无框窗口标题栏（`42px`）**：`apps/desktop` 移除原生菜单栏并开启 Windows `titleBarOverlay`（高 `42px`），前端 `.quarry-titlebar` 将应用标识、多标签页与 `Ctrl+K` 快速命令触发器融合于同一拖拽条。
- **可折叠侧边栏**：展开 `224px` / 收起 `58px`（纯图标 + Radix `Tooltip`）；进入 `Study` 后原位切换为作答控制台（状态卡、5 列题号导航、`暂停`/`交卷`/`结束练习`/`退出答题`）。
- **首页（`Home`）**：未完成会话以焦点横幅置顶于首屏；3 项 KPI 指标与 53×7 年度学习热力图收敛于同一复合卡片内，避免卡片嵌套；待续会话与待复习错题列于下方双栏。
- **题库与套题（`Library`）**：Master-Detail 双栏布局（左侧列表/网格 + 右侧粘性概览 Inspector 卡），支持悬停显现行内图标操作与底部深色多选批量浮栏（导出/删除/取消）。
- **套题详情（`Detail`）**：简洁两层页头（标题 + 右侧操作组 + 标题下方可点击 Popover 规则药丸），**不设右侧属性边栏**，确保 960×760 窄屏首屏直达首道题目。
- **练习答题（`Study`）**：桌面端（`lg:` 以上）采用左右分栏（左栏元信息/共用材料/题干，右栏选项卡 + 参考答案反馈 + 3 枚无底座卡片包裹的裸操作按钮 `上一题`/`查看答案|重新作答`/`下一题`），`< 1024px` 自动转为上下堆叠；支持数字键 `1–9` 选答案、`Enter` 查答案；考试暂停使用 Radix `Dialog` 全屏遮罩，点击「继续答题」或按 `Esc` 恢复后焦点显式归位至「暂停」按钮。
- **按钮与弹窗动画**：主/描边按钮顶部自带 `1px` 内高光与 `active:scale-[0.98]` 按压反馈；弹窗与浮层使用 `quarry-panel-in` 轻量缓动（尊重 `prefers-reduced-motion`）。
