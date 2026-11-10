import { FileGrid, Folders, ResumePanel, Sidebar, WorkspaceHeader } from '../components';
import './Desktop.css';

export function DesktopLayout() {
  return (
    <div className="layout-canvas desktop-layout">
      <Sidebar compact />
      <aside className="desktop-tree" aria-label="文件夹导航">
        <div className="desktop-tree-title">我的文件</div>
        <div className="desktop-tree-root">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M3 7h7l2 3h9v10H3V7Z" /><path d="M3 7V4h7l2 3h7v3" />
          </svg>
          全部文件
          <span>10</span>
        </div>
        <Folders vertical />
        <div className="desktop-tree-tags">
          <div className="desktop-tree-title">文件标签</div>
          <div className="desktop-tree-tag"><span />专业课</div>
          <div className="desktop-tree-tag"><span />考前复习</div>
        </div>
        <div className="desktop-tree-caption">个人资料库</div>
      </aside>
      <main className="desktop-main">
        <WorkspaceHeader title="全部文件" subtitle="把题目归入题库，把练习留在套题。" />
        <div className="desktop-content">
          <section className="desktop-files" aria-label="文件图标视图">
            <div className="desktop-section-heading"><h2>题库与套题</h2><span>7 个文件 · 图标视图</span></div>
            <FileGrid />
            <p className="desktop-hint">打开题库整理题目；选题并保存为套题后，即可开始答题。</p>
          </section>
          <div className="desktop-resume"><ResumePanel /></div>
          <footer className="desktop-footer"><span>3 个文件夹 · 4 个题库 · 3 份套题</span><span>个人工作区</span></footer>
        </div>
      </main>
    </div>
  );
}
