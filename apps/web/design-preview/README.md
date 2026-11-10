# 题匣 · HeroUI 五布局预览

React 19 + HeroUI 3.2.7 + Tailwind CSS 4 + Vite。使用真实的 `@heroui/react` Button、Card、Chip、SearchField、Table、ProgressBar；没有用静态 HTML 仿制这些组件。

在此目录执行：

```powershell
npm ci
npm run dev
```

打开 `http://127.0.0.1:5174/comparison.html` 并排或单张查看五版。单页入口为 `/?layout=1` 到 `/?layout=5`：目录优先、三栏检查器、图标桌面、上下分栏、学习案头。

五版共用 `src/data.ts` 的模拟内容和 `src/components.tsx` 的 HeroUI 组件，只改变布局。`src/layouts` 各文件独立，`src/styles.css` 管理共同视觉。比较入口由 oil-ui 官方生成器根据任务 manifest 生成，预览需本机服务运行。

这是视觉布局探索，目标视口 1440×900；业务按钮、数据存储、后端 API、练习判分未接入。搜索框为组件自带输入行为，尚未筛选文件。对比入口支持方向选择，产品内控件不代表已实现完整流程。未制作响应式、专门动效和移动端布局。

该目录使用独立 package-lock 和 node_modules，是为了避开现有主工程指向另一镜像路径的 pnpm 虚拟存储链接；没有改写主工作区依赖链接。不要从正式应用引用过程目录 `.oil-ui`。后续选定布局后可将这里的可复用组件整合进正式前端。

验证：`npm run lint`；主 Agent 通过独立临时浏览器查看五版截图，检查运行错误、图片与横向溢出。过程证据位于项目根的 `.oil-ui/quarry-heroui-five/shots`。未运行生产构建或全量测试。
