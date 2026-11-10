import {db,commit,getSession,findFile,tagNames,tagColor,restoreContent} from './store.js';
import {esc,icon,btn,link,empty,heading,toast,closeModal,modal,enhanceSelects,stopwatch,pill,tagStyle,componentSpec} from './ui.js';
import {home} from './pages/home.js';
import {aboutProduct} from './pages/about.js';
import {library,bankPage,paperPage,manageAction,filteredBankQuestions} from './pages/manage.js';
import {mistakes,records,learningAction,mistakeSource,filteredMistakes} from './pages/learning.js';
import {study,result,studyAction,currentRecord,submitExam} from './pages/study.js';

const app=document.getElementById('app');
const defaultView=()=>({search:'',kind:'all',grid:false,bankSelected:new Set(),mistakeSelected:new Set(),mastery:'reviewing'});
const ctx={state:defaultView(),query:new URLSearchParams(),route:'home',id:'',go:route=>{location.hash='/'+route;},render:()=>render(),flushTime:()=>flushTime()};
let clockId=null,clockStarted=0,previousPageKey='';
const workspaceTitles={components:'组件规范',home:'学习概览',library:'资料库',mistakes:'错题本',records:'学习记录',settings:'设置',trash:'回收站'};
const tabStorageKey='quarry-workspace-tabs-v2';
const currentPath=()=>location.hash.slice(1).replace(/^\//,'')||'home';
const newTab=route=>({id:crypto.randomUUID(),route,views:{},lastLibrary:'library',history:[route],historyIndex:0});
let workspaceTabs=[newTab(currentPath())],activeTabId=workspaceTabs[0].id,viewKey=currentPath(),switchingTab=false,lastLibrary='library';
function activeTab(){return workspaceTabs.find(tab=>tab.id===activeTabId);}
function packView(){return {...ctx.state,bankSelected:[...ctx.state.bankSelected],mistakeSelected:[...ctx.state.mistakeSelected]};}
function snapshotTab(saveScroll=true){const tab=activeTab();if(tab)tab.views[viewKey]={state:packView(),scroll:saveScroll?scrollY:tab.views[viewKey]?.scroll||0};}
function persistTabs(){try{sessionStorage.setItem(tabStorageKey,JSON.stringify({tabs:workspaceTabs,active:activeTabId}));}catch{}}
function restoreView(){
 const tab=activeTab(),saved=tab.views[tab.route]?.state;
 ctx.state={...defaultView(),...saved,bankSelected:new Set(saved?.bankSelected||[]),mistakeSelected:new Set(saved?.mistakeSelected||[])};
 viewKey=tab.route;lastLibrary=tab.lastLibrary||'library';
}
try{
 const saved=JSON.parse(sessionStorage.getItem(tabStorageKey)||'null');
 if(Array.isArray(saved?.tabs)&&saved.tabs.length&&saved.tabs.every(t=>typeof t.id==='string'&&typeof t.route==='string'&&t.views&&typeof t.views==='object')){
  workspaceTabs=saved.tabs;workspaceTabs.forEach(t=>{t.history??=[t.route];t.historyIndex??=t.history.length-1;});activeTabId=workspaceTabs.some(t=>t.id===saved.active)?saved.active:workspaceTabs[0].id;
  activeTab().route=currentPath();restoreView();
 }
}catch{}
function activateTab(id){
 if(id===activeTabId)return;
 flushTime();snapshotTab();activeTabId=id;restoreView();persistTabs();switchingTab=true;
 const route=activeTab().route;
 if(route===currentPath()){switchingTab=false;render();window.scrollTo(0,activeTab().views[route]?.scroll||0);}else ctx.go(route);
}
ctx.navigationState=()=>({canBack:activeTab().historyIndex>0,canForward:activeTab().historyIndex<activeTab().history.length-1});
function navigateHistory(direction){
 const tab=activeTab(),index=tab.historyIndex+direction;if(index<0||index>=tab.history.length)return;
 flushTime();snapshotTab();tab.historyIndex=index;tab.route=tab.history[index];restoreView();switchingTab=true;persistTabs();
 if(tab.route===currentPath()){switchingTab=false;render();window.scrollTo(0,tab.views[tab.route]?.scroll||0);}else ctx.go(tab.route);
}
function tabTitle(key){const [route,id]=key.split('?')[0].split('/');return workspaceTitles[route]||({practice:'练习答题',exam:'考试答题',result:'学习结果'})[route]||findFile(id)?.name||'资料';}
function workspaceBar(){
 const tab=activeTab();tab.route=currentPath();if(ctx.route==='library')tab.lastLibrary=lastLibrary=currentPath();
 snapshotTab(false);persistTabs();
 return `<nav class="workspace-tabs" aria-label="工作区标签页"><div class="workspace-tab-list" role="tablist" aria-label="打开的页面">${workspaceTabs.map(t=>`<div class="workspace-tab ${t.id===activeTabId?'active':''}"><button type="button" role="tab" id="tab-${t.id}" aria-controls="workspace-page" aria-selected="${t.id===activeTabId}" tabindex="${t.id===activeTabId?'0':'-1'}" data-action="switch-workspace-tab" data-tab-id="${t.id}" class="workspace-tab-button" title="${esc(tabTitle(t.route))}">${icon(t.route.startsWith('bank/')?'library':t.route.split(/[/?]/)[0])}<span>${esc(tabTitle(t.route))}</span></button>${workspaceTabs.length>1?btn(icon('close'),'close-workspace-tab','tab-close',`data-tab-id="${t.id}" aria-label="关闭${esc(tabTitle(t.route))}"`):''}</div>`).join('')}</div>${btn('+','new-workspace-tab','new-tab-button','aria-label="新建标签页" title="新建标签页"')}</nav>`;
}
function flushTime(){if(!clockId)return;const seconds=Math.floor((performance.now()-clockStarted)/1000);if(seconds>0){const id=clockId;commit(s=>{const session=s.sessions.find(v=>v.id===id);if(session&&session.status==='in_progress')session.elapsed+=seconds;});clockStarted+=seconds*1000;}}
function setClock(session){const id=session?.status==='in_progress'?session.id:null;if(clockId!==id){flushTime();clockId=id;clockStarted=performance.now();}}
function pageRoute(){const [path,query='']=(location.hash.slice(1).replace(/^\//,'')||'home').split('?');const [route,id='']=path.split('/');ctx.route=route;ctx.id=decodeURIComponent(id);ctx.query=new URLSearchParams(query);return{route,id:ctx.id};}
function sidebar(session){
 const compact=db().settings.collapsed;
 const active=['paper','bank'].includes(ctx.route)?'library':ctx.route;
 const toggle=btn(icon('panel'),'collapse-sidebar','icon-button',`aria-label="${compact?'展开':'收起'}侧边栏" aria-expanded="${!compact}"`);
 const nav=[['home','首页'],['library','资料库'],['mistakes','错题本'],['records','学习记录']].map(([route,name])=>`<a class="nav-link ${active===route?'selected':''}" href="#/${route}" title="${name}" aria-label="${name}">${icon(route)}<span>${name}</span>${route==='mistakes'?`<small>${db().mistakes.filter(m=>m.mastery==='reviewing').length}</small>`:''}</a>`).join('');
 const questions=session?`<div class="study-side"><button class="button quiet small" data-action="exit-study" data-id="${session.id}">← 退出答题</button><div class="study-name">${esc(session.name)}</div><div class="study-mode">${session.mode==='exam'?'考试模式':'练习模式'}</div><div class="study-session-controls"><span class="small muted">已用时</span><span class="study-timer" id="session-clock">${stopwatch(session.elapsed)}</span><div class="actions">${btn('暂停','pause-session','compact',`data-id="${session.id}"`)}${btn(session.mode==='exam'?'交卷':'结束练习','finish-session',session.mode==='exam'?'compact primary':'compact',`data-id="${session.id}"`)}</div></div><p class="small muted nav-status-label">题目导航</p><div class="nav-state-legend"><span><i class="current"></i>当前</span><span><i class="filled"></i>${session.mode==='exam'?'已填':'已答'}</span><span><i></i>${session.mode==='exam'?'未填':'未答'}</span></div><div class="question-nav">${session.snapshot.map((q,i)=>{const filled=session.mode==='exam'?(session.drafts[q.id]||[]).some(v=>String(v).trim()):!!currentRecord(session,q);return `<button data-action="jump-question" data-id="${session.id}" data-index="${i}" class="${filled?'filled':''} ${session.index===i?'current':''}" aria-label="第${i+1}题${filled?' 已答':' 未答'}${session.index===i?' 当前题':''}">${String(i+1).padStart(2,'0')}</button>`;}).join('')}</div></div>`:'';
 return `<aside class="app-sidebar ${compact?'compact':''} ${session?'study-sidebar':''}"><div class="brand-row"><a class="brand" href="#/home"><img src="/assets/logo.svg" alt="题匣"><b>题匣</b></a>${toggle}</div>${session?questions:`<nav class="main-nav" aria-label="主导航">${nav}</nav><div class="sidebar-bottom">${link(`${icon('trash')}<span>回收站</span>`,'trash','nav-link')}${link(`${icon('settings')}<span>设置</span>`,'settings','nav-link')}</div>`}</aside>`;
}
function tagColorSettings(){
 const namespace=ctx.state.tagNamespace||'file';
 return `<section class="settings-section tag-color-settings" aria-labelledby="settings-tags-heading"><div class="section-head"><div class="settings-section-heading"><h2 id="settings-tags-heading">标签颜色</h2><p class="muted small">文件标签与题目标签分别设置，颜色应用于对应标签。</p></div><select class="filter" aria-label="标签类型" data-tag-namespace><option value="file" ${namespace==='file'?'selected':''}>文件标签</option><option value="question" ${namespace==='question'?'selected':''}>题目标签</option></select></div>${tagNames(namespace).map(name=>`<div class="tag-color-row" data-tag-name="${esc(name)}" data-namespace="${namespace}">${pill(name,namespace)}<span class="color-save-status small" role="status" aria-live="polite" aria-atomic="true"></span><label class="tag-color-picker"><span class="small muted">颜色</span><input type="color" data-auto-save-color aria-label="${esc(name)}的颜色" value="${tagColor(name,namespace)}"></label></div>`).join('')||empty('暂无标签','在资料或题目属性中添加标签后，可在此设置颜色。')}</section>`;
}
function modalLayoutNotice(){modal('首页布局', '<p class="muted">此入口将用于自定义首页组件和排列。当前布局保持原样。</p>', '<button type="button" class="button" data-close>关闭</button>');}
function otherPage(){
 if(ctx.route==='components')return componentSpec();
 if(ctx.route==='trash')return `${heading('回收站','已删除资料可以恢复，学习记录与错题快照独立保留。')}${db().trash.length?`<table class="data-table"><thead><tr><th>名称</th><th>类型</th><th>删除日期</th><th></th></tr></thead><tbody>${db().trash.map(f=>`<tr><td>${esc(f.name)}</td><td>${f.kind==='folder'?'文件夹':f.kind==='bank'?'题库':'套题'}</td><td>${f.deleted.slice(0,10)}</td><td>${btn('恢复','restore-file','quiet',`data-id="${f.id}"`)}</td></tr>`).join('')}</tbody></table>`:empty('回收站是空的','删除的题库与套题会出现在这里。')}`;
 if(ctx.route==='settings')return `${heading('设置','让题匣更适合你的学习习惯。')}<div class="settings-page">${tagColorSettings()}${aboutProduct()}</div>`;
 return empty('没有找到这个页面',link('返回首页','home'));
}
function render(){
 const {route,id}=pageRoute();if(route==='result'){const pending=getSession(id);if(pending&&pending.status!=='completed'){ctx.go(`${pending.mode}/${id}`);return;}}const s=['practice','exam'].includes(route)?getSession(id):null;
 if(s?.mode==='exam'&&s.deadlineAt&&s.status!=='completed'&&Date.now()>=s.deadlineAt){flushTime();submitExam(id);ctx.go(`result/${id}`);return;}
 const active=s&&s.status!=='completed'?s:null;
 setClock(active);document.documentElement.style.setProperty('--question-size',`${db().settings.fontSize}px`);
 const titles={components:'组件规范',home:'学习概览',library:'资料库',bank:'资料库',paper:'资料库',mistakes:'错题本',records:'学习记录',practice:'练习答题',exam:'考试答题',result:'学习结果',settings:'设置',trash:'回收站'};
 let content;
 try{content=route==='home'?home(ctx):route==='library'?library(ctx):route==='bank'?bankPage(ctx,id):route==='paper'?paperPage(ctx,id):route==='mistakes'?mistakes(ctx):route==='records'?records(ctx):['practice','exam'].includes(route)?study(ctx,id):route==='result'?result(ctx,id):otherPage();}catch(error){content=empty('页面暂时无法显示',error.message);}
 document.title=`${titles[route]||'题匣'} · Quarry`;
 const pageKey=route+'/'+id,entering=pageKey!==previousPageKey;previousPageKey=pageKey;
 app.innerHTML=`${sidebar(active)}<main class="app-main"><header class="app-top workspace-header">${workspaceBar()}</header><div id="workspace-page" role="tabpanel" aria-labelledby="tab-${activeTabId}" class="page-content ${entering?'page-enter':''}">${route==='home'?`<div class="home-title-row"><h1 class="home-heading">学习概览</h1>${btn(icon('pencil'),'edit-home-layout','icon-only hover-only','aria-label="编辑首页布局" title="编辑首页布局"')}</div>`:''}${content}</div></main>`;
 app.querySelectorAll('input[data-indeterminate]').forEach(input=>input.indeterminate=true);enhanceSelects(app);if(entering&&!active)app.querySelector('.workspace-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
 const pause=app.querySelector('.pause-screen');if(pause){app.appendChild(pause);app.querySelector('.app-main').inert=true;app.querySelector('.app-sidebar').inert=true;pause.querySelector('button')?.focus();}
}

function refreshFilteredResults(){
 const template=document.createElement('template');template.innerHTML=ctx.route==='library'?library(ctx):ctx.route==='bank'?bankPage(ctx,ctx.id):mistakes(ctx);
 const current=app.querySelector('[data-filter-results]'),next=template.content.querySelector('[data-filter-results]');if(!current||!next){render();return;}current.replaceWith(next);
 if(ctx.route==='mistakes')app.querySelector('.mistake-page-heading > .actions')?.replaceWith(template.content.querySelector('.mistake-page-heading > .actions'));
 next.querySelectorAll('input[data-indeterminate]').forEach(input=>input.indeterminate=true);snapshotTab(false);persistTabs();
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-close]')){closeModal();return;}
 const el=event.target.closest('[data-action]');if(!el||el.disabled)return;const action=el.dataset.action;ctx.event=event;
 if(event.target.matches('[data-select-mistake]'))return;
 try{
  if(action==='navigate-back'){navigateHistory(-1);return;}
  if(action==='navigate-forward'){navigateHistory(1);return;}
  if(action==='navigate-home'){ctx.go('home');return;}
  if(action==='back-library'){ctx.go(lastLibrary);return;}
  if(action==='switch-workspace-tab'){activateTab(el.dataset.tabId);document.getElementById(`tab-${activeTabId}`)?.focus();return;}
  if(action==='new-workspace-tab'){const tab=newTab('home');workspaceTabs.push(tab);activateTab(tab.id);document.getElementById(`tab-${activeTabId}`)?.focus();return;}
  if(action==='close-workspace-tab'){
   if(workspaceTabs.length===1)return;
   const id=el.dataset.tabId,index=workspaceTabs.findIndex(t=>t.id===id),isActive=id===activeTabId;
   if(isActive)activateTab(workspaceTabs[index>0?index-1:1].id);
   workspaceTabs=workspaceTabs.filter(t=>t.id!==id);persistTabs();if(!switchingTab)render();document.getElementById(`tab-${activeTabId}`)?.focus();return;
  }
  if(action==='collapse-sidebar'){commit(s=>{s.settings.collapsed=!s.settings.collapsed;});render();document.querySelector('[data-action="collapse-sidebar"]')?.focus();return;}
  if(action==='restore-file'){restoreContent(el.dataset.id);render();toast('已恢复到资料库');return;}
  if(action==='edit-home-layout'){modalLayoutNotice();return;}
  manageAction(action,el,ctx)||learningAction(action,el,ctx)||studyAction(action,el,ctx);
 }catch(error){toast(`未能保存：${error.message||'请重试'}`);}
});
function saveTagColor(input){
 const row=input.closest('.tag-color-row'),name=row.dataset.tagName,namespace=row.dataset.namespace,status=row.querySelector('.color-save-status'),color=input.value;
 if(color.toLowerCase()===tagColor(name,namespace).toLowerCase())return;
 try{
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('请选择有效颜色');
  commit(s=>{s.settings.tagColors={...s.settings.tagColors,[namespace]:{...s.settings.tagColors?.[namespace],[name]:color}};});
  row.querySelector(':scope > .pill').outerHTML=pill(name,namespace);
  status.dataset.state='saved';status.textContent='已保存';
 }catch{status.dataset.state='error';status.textContent='保存失败，请重新选色重试';}
}
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.matches('[data-auto-save-color]')){saveTagColor(el);return;}
 if(el.id==='search'){
  const position=el.selectionStart;ctx.state.search=el.value;render();const next=document.getElementById('search');next?.focus();try{next?.setSelectionRange(position,position);}catch{}return;
 }
 if(el.matches('[data-answer-input]'))try{commit(state=>{const s=state.sessions.find(s=>s.id===el.dataset.session),q=s.snapshot.find(q=>q.id===el.dataset.question);if(s.status==='completed'||s.mode==='practice'&&currentRecord(s,q))return;const values=s.drafts[q.id]||[];values[Number(el.dataset.blank)]=el.value;s.drafts[q.id]=values;});}catch(error){toast('答案保存失败，请重试。');}
});
document.addEventListener('change',event=>{
 const el=event.target;
 try{
  if(el.matches('[data-auto-save-color]')){saveTagColor(el);return;}
  if(el.matches('[data-filter]')){
   const key=el.dataset.filter,value=el.selectedOptions.length===el.options.length?null:[...el.selectedOptions].map(o=>o.value);
   if(ctx.route==='bank')ctx.state.bankFilters={...ctx.state.bankFilters,[key]:value};else if(key==='fileKinds'||key==='fileTags')ctx.state[key]=value;else ctx.state.mistakeFilters={...ctx.state.mistakeFilters,[key]:value};
   refreshFilteredResults();return;
  }
  if(el.matches('[data-tag-namespace]')){ctx.state.tagNamespace=el.value;render();return;}
  if(el.matches('[data-select-bank]')){el.checked?ctx.state.bankSelected.add(el.dataset.selectBank):ctx.state.bankSelected.delete(el.dataset.selectBank);render();}
  if(el.matches('[data-select-bank-all]')){filteredBankQuestions(ctx,ctx.id).forEach(q=>el.checked?ctx.state.bankSelected.add(q.id):ctx.state.bankSelected.delete(q.id));render();}
  if(el.matches('[data-select-mistake]')){el.checked?ctx.state.mistakeSelected.add(el.dataset.selectMistake):ctx.state.mistakeSelected.delete(el.dataset.selectMistake);render();}
  if(el.matches('[data-select-mistakes-all]')){filteredMistakes(ctx).forEach(m=>el.checked?ctx.state.mistakeSelected.add(m.id):ctx.state.mistakeSelected.delete(m.id));render();}
  if(el.matches('[data-mistake-type]')){ctx.state.mistakeType=el.value;render();}
  if(el.matches('[data-record-mode]')){ctx.state.recordMode=el.value;render();}
  if(el.matches('[data-paper-setting]')){commit(s=>{s.files.find(f=>f.id===el.dataset.id)[el.dataset.paperSetting]=el.checked;});toast('套题属性已保存');}
  if(el.matches('[data-font-size]')){commit(s=>{s.settings.fontSize=Number(el.value);});render();}
  if(el.matches('[data-compact-setting]')){commit(s=>{s.settings.collapsed=el.checked;});render();}
 }catch(error){toast(`保存失败：${error.message}`);}
});
window.addEventListener('hashchange',()=>{try{
 flushTime();closeModal();
 if(!switchingTab){snapshotTab();const tab=activeTab(),path=currentPath();if(tab.route!==path){tab.history=tab.history.slice(0,tab.historyIndex+1);tab.history.push(path);tab.historyIndex=tab.history.length-1;}tab.route=path;restoreView();}
 const focusTab=switchingTab;switchingTab=false;render();window.scrollTo(0,activeTab().views[currentPath()]?.scroll||0);if(focusTab)document.getElementById(`tab-${activeTabId}`)?.focus();persistTabs();
}catch(error){toast(`进度保存失败：${error.message}`);}});
document.addEventListener('keydown',event=>{
 const tab=event.target.closest('[role="tab"][data-tab-id]');if(!tab)return;
 const index=workspaceTabs.findIndex(t=>t.id===tab.dataset.tabId);
 if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?workspaceTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+workspaceTabs.length)%workspaceTabs.length;
  activateTab(workspaceTabs[next].id);document.getElementById(`tab-${activeTabId}`)?.focus();
 }
});
window.addEventListener('beforeunload',()=>{try{flushTime();snapshotTab();persistTabs();}catch{}});
setInterval(()=>{const active=['practice','exam'].includes(ctx.route)?getSession(ctx.id):null;if(active?.mode==='exam'&&active.deadlineAt&&active.status!=='completed'&&Date.now()>=active.deadlineAt){try{flushTime();submitExam(active.id);ctx.go(`result/${active.id}`);return;}catch(error){toast(error.message);}}if(!clockId)return;const s=getSession(clockId);if(!s||s.status!=='in_progress')return;const node=document.getElementById('session-clock');if(node)node.textContent=`${stopwatch(s.elapsed+Math.floor((performance.now()-clockStarted)/1000))}${s.deadlineAt?` · 剩余 ${stopwatch(Math.max(0,Math.ceil((s.deadlineAt-Date.now())/1000)))}`:''}`;},1000);

render();
