import { Sidebar, WorkspaceHeader, ResumePanel, Folders, FileTable } from '../components';
import './Directory.css';

/** Layout 01: a continuous, directory-first desktop workspace. */
export function DirectoryLayout() {
  return (
    <div className="layout-canvas directory-canvas">
      <Sidebar />
      <main className="directory-main">
        <div className="directory-header">
          <WorkspaceHeader title="首页" subtitle="我的学习工作台" />
        </div>
        <div className="workspace-body directory-body">
          <section className="directory-resume" aria-label="继续上次练习">
            <ResumePanel />
          </section>
          <section className="directory-folders" aria-label="个人文件夹">
            <Folders />
          </section>
          <section className="directory-files" aria-label="最近打开的文件">
            <FileTable />
          </section>
          <footer className="directory-footer">
            <span>7 个项目 · 3 个文件夹</span>
            <span>个人工作区</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
