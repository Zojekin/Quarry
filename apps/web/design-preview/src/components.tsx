import { Button, Card, Chip, ProgressBar, SearchField, Table } from '@heroui/react';
import { ArrowRight, BookOpen, ChartNoAxesCombined, ChevronDown, ChevronRight, Clock3, Ellipsis, FileText, Folder, House, LayoutGrid, List, Plus, Search, Settings2, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { files, folders } from './data';
import logo from '../../../../memory-bank/logo/题匣-logo.svg';

export function Sidebar({ compact = false }: { compact?: boolean }) {
  const entries = [ { icon: House, label: '首页' }, { icon: BookOpen, label: '错题本' }, { icon: Clock3, label: '学习记录' }, { icon: ChartNoAxesCombined, label: '学习看板' } ];
  return <aside className={`quarry-sidebar ${compact ? 'is-compact' : ''}`}>
    <div className="quarry-brand"><img src={logo} alt="题匣"/>{!compact && <div><strong>题匣</strong><span>QUARRY</span></div>}</div>
    <nav aria-label="主要导航">{entries.map(({icon: Icon, label}, i) => <Button key={label} variant="ghost" className={`nav-button ${i === 0 ? 'is-active' : ''}`}><Icon size={18}/><span>{label}</span></Button>)}</nav>
    {!compact && <div className="file-tree"><div className="small-heading">我的文件 <Plus size={14}/></div><div className="tree-line"><ChevronDown size={14}/><Folder size={17}/>全部文件</div>{folders.map(f => <div className="tree-line tree-child" key={f.name}><ChevronRight size={13}/><Folder size={16}/>{f.name}</div>)}<div className="small-heading tag-heading">文件标签</div><div className="tree-tag"><i/>专业基础</div><div className="tree-tag"><i/>专项练习</div></div>}
    <div className="side-bottom"><Button variant="ghost" className="nav-button"><Trash2 size={18}/><span>回收站</span></Button><Button variant="ghost" className="nav-button"><Settings2 size={18}/><span>设置</span></Button>{!compact && <p className="local-label"><span/>个人工作区</p>}</div>
  </aside>;
}

export function WorkspaceHeader({title = '首页', subtitle = '我的学习工作台'}: {title?: string; subtitle?: string}) {
  return <header className="workspace-header"><div className="header-location"><House size={16}/><span>个人工作区</span><ChevronRight size={14}/><b>{title}</b></div><SearchField aria-label="搜索文件名称" className="workspace-search"><SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="搜索文件名称"/><SearchField.ClearButton/></SearchField.Group></SearchField><Actions/><span className="header-subtitle">{subtitle}</span></header>;
}

export function Actions() {
  return <div className="common-actions"><Button variant="outline" size="sm"><Upload size={15}/>导入文件</Button><Button variant="secondary" size="sm"><Plus size={15}/>新建<ChevronDown size={13}/></Button></div>;
}

export function ResumePanel({vertical = false, compact = false}: {vertical?: boolean; compact?: boolean}) {
  return <Card className={`resume-panel ${vertical ? 'resume-vertical' : ''} ${compact ? 'resume-compact' : ''}`}>
    <Card.Content><div className="resume-icon"><FileText size={25}/></div><div className="resume-description"><div className="eyebrow"><span className="status-dot"/>未完成的练习</div><h2>进程与线程专项练习</h2><p>上次停留第 10 题 <span>·</span> 有效用时 12:36</p></div><div className="resume-meter"><div><span>答题进度</span><strong>9 <small>/ 24</small></strong></div><ProgressBar value={9} maxValue={24} aria-label="已答9题，共24题"><ProgressBar.Track><ProgressBar.Fill/></ProgressBar.Track></ProgressBar></div><Button className="continue-button">继续答题<ArrowRight size={16}/></Button></Card.Content>
  </Card>;
}

export function Folders({vertical = false}: {vertical?: boolean}) {
  return <div className={`folder-list ${vertical ? 'folders-vertical' : ''}`}>{folders.map(f => <Card key={f.name} className="folder-item" variant="transparent"><Card.Content><Folder size={26}/><div><strong>{f.name}</strong><p>{f.detail}</p></div><ChevronRight size={15}/></Card.Content></Card>)}</div>;
}

export function FileTable({compact = false}: {compact?: boolean}) {
  return <div className={`files-table ${compact ? 'table-compact' : ''}`}><Table><Table.ScrollContainer><Table.Content aria-label="个人题库与套题"><Table.Header><Table.Column isRowHeader>名称</Table.Column><Table.Column>类型</Table.Column>{!compact && <Table.Column>文件标签</Table.Column>}<Table.Column>题数</Table.Column>{!compact && <Table.Column>最近打开</Table.Column>}<Table.Column aria-label="操作"> </Table.Column></Table.Header><Table.Body>{files.map(f => <Table.Row key={f.id} id={f.id} className={f.id === 'paper-os' ? 'selected-file' : ''}><Table.Cell><span className="file-name"><span className={`file-glyph ${f.type === '套题' ? 'paper-glyph' : ''}`}>{f.type === '题库' ? <BookOpen size={17}/> : <FileText size={17}/>}</span><span>{f.name}</span></span></Table.Cell><Table.Cell><span className="muted">{f.type}</span></Table.Cell>{!compact && <Table.Cell><Chip size="sm" variant="soft">{f.tag}</Chip></Table.Cell>}<Table.Cell><span className="muted tabular-nums">{f.count}</span></Table.Cell>{!compact && <Table.Cell><span className="muted">{f.date}</span></Table.Cell>}<Table.Cell><Button size="sm" isIconOnly variant="ghost" aria-label={`${f.name}的更多操作`}><Ellipsis size={17}/></Button></Table.Cell></Table.Row>)}</Table.Body></Table.Content></Table.ScrollContainer></Table></div>;
}

export function FileGrid() {
  return <div className="files-grid">{files.map(f => <Card key={f.id} className={`file-object ${f.id === 'paper-os' ? 'selected-object' : ''}`}><Card.Content><div className={`object-cover ${f.type === '套题' ? 'paper-cover' : ''}`}><span>{f.type}</span>{f.type === '题库' ? <BookOpen size={26}/> : <FileText size={26}/>}<small>{f.count} 题</small></div><strong>{f.name}</strong><div className="object-footer"><span>{f.type}</span>{f.id === 'paper-os' && <Chip size="sm" variant="soft">进行中</Chip>}</div></Card.Content></Card>)}</div>;
}

export function PaperDetails() {
  return <section className="paper-details"><div className="paper-head-icon"><FileText size={26}/></div><div className="eyebrow">计算机基础 / 套题</div><h2>进程与线程<br/>专项练习</h2><p className="muted">从操作系统核心概念中整理的专项套题。</p><div className="details-heading"><strong>题型结构</strong><span>共 24 题</span></div><div className="type-bar"><i/><i/><i/></div><div className="type-labels"><span>单选 12</span><span>多选 8</span><span>主观 4</span></div><dl><div><dt>题目顺序</dt><dd>按原顺序</dd></div><div><dt>选项打乱</dt><dd>关闭</dd></div><div><dt>跟随源题库</dt><dd>关闭</dd></div><div><dt>考试时限</dt><dd>不限时</dd></div></dl><div className="detail-tags"><Chip size="sm" variant="soft">专项练习</Chip><Chip size="sm" variant="soft">操作系统</Chip></div><div className="paper-subactions"><Button variant="outline" size="sm">编辑套题</Button><Button variant="ghost" size="sm">预览题目</Button></div></section>;
}

export function ViewToolbar({title = '最近打开'}: {title?: string}) {
  return <div className="view-toolbar"><h2>{title}<span>7 个项目</span></h2><div><Button size="sm" variant="ghost">全部</Button><Button size="sm" variant="ghost">题库</Button><Button size="sm" variant="ghost">套题</Button><span className="view-switch"><Button isIconOnly variant="secondary" size="sm" aria-label="列表视图"><List size={16}/></Button><Button isIconOnly variant="ghost" size="sm" aria-label="图标视图"><LayoutGrid size={16}/></Button></span></div></div>;
}
