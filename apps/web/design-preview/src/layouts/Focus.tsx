import { FileTable, PaperDetails, ResumePanel, Sidebar, WorkspaceHeader } from '../components';
import './Focus.css';

export function FocusLayout() {
  return (
    <div className="layout-canvas focus-layout">
      <Sidebar />
      <main className="focus-main">
        <WorkspaceHeader title="学习案头" subtitle="当前套题与最近文件，都在手边。" />
        <div className="focus-content">
          <section className="focus-current" aria-label="当前套题与学习进度">
            <div className="focus-section-heading"><h2>当前套题</h2><span>计算机基础 / 套题</span></div>
            <div className="focus-paper"><PaperDetails /></div>
            <div className="focus-session"><ResumePanel vertical /></div>
          </section>
          <section className="focus-recent" aria-label="最近内容">
            <div className="focus-section-heading"><h2>最近内容</h2><span>7 个文件</span></div>
            <div className="focus-table"><FileTable compact /></div>
            <p className="focus-hint">题库用于管理题目，套题用于练习与考试。</p>
            <div className="focus-location">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 7h7l2 3h9v10H3V7Z" /><path d="M3 7V4h7l2 3h7v3" /></svg>
              <div><span>当前文件位置</span><p>全部文件 / 计算机基础</p></div>
            </div>
          </section>
        </div>
        <footer className="focus-footer"><span>所有练习均从已保存的套题开始</span><span>个人工作区</span></footer>
      </main>
    </div>
  );
}
