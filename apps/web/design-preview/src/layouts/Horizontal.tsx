import { FileTable, PaperDetails, ResumePanel, Sidebar, ViewToolbar, WorkspaceHeader } from '../components';
import './Horizontal.css';

export function HorizontalLayout() {
  return <div className="layout-canvas horizontal-layout"><Sidebar/><main className="horizontal-main"><WorkspaceHeader title="全部文件"/><div className="horizontal-upper"><div className="horizontal-title"><h1>内容工作台</h1></div><ViewToolbar title="我的内容"/><FileTable/></div><section className="horizontal-lower"><div className="horizontal-paper"><div className="horizontal-caption">选中套题 / 详细信息</div><PaperDetails/></div><div className="horizontal-session"><div className="horizontal-caption">继续学习</div><ResumePanel vertical compact/></div></section><footer className="horizontal-footer"><span>7 个项目 · 已选中 1 份套题</span><span>个人工作区</span></footer></main></div>;
}
