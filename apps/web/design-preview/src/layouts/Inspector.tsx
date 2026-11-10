import {
  FileTable,
  PaperDetails,
  ResumePanel,
  Sidebar,
  WorkspaceHeader,
} from '../components';
import './Inspector.css';

export function InspectorLayout() {
  return (
    <div className="layout-canvas inspector-layout">
      <div className="inspector-navigation">
        <Sidebar />
      </div>

      <main className="inspector-workspace" aria-label="内容工作区">
        <div className="inspector-header">
          <WorkspaceHeader title="所有内容" subtitle="浏览题库与套题，选中内容查看详细信息" />
        </div>
        <section className="inspector-files" aria-label="文件列表">
          <FileTable compact />
        </section>
        <footer className="inspector-selection">
          <span>已选择 1 个套题</span>
          <span>进程与线程专项练习 · 24 题</span>
        </footer>
      </main>

      <aside className="inspector-details" aria-label="选中套题检查器">
        <div className="inspector-details-heading">
          <span>套题检查器</span>
          <span className="inspector-details-caption">已选内容</span>
        </div>
        <div className="inspector-paper">
          <PaperDetails />
        </div>
        <div className="inspector-resume">
          <ResumePanel vertical compact />
        </div>
      </aside>
    </div>
  );
}
