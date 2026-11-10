import {tagColor} from './store.js';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={eye:'M2 13s4-8 11-8 11 8 11 8-4 8-11 8S2 13 2 13zM17 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',play:'m9 6 11 7-11 7z',pause:'M9 6v14M17 6v14',pencil:'m5 17 12-12 4 4-12 12-5 1zM15 7l4 4',forward:'M5 13h15m-6-6 6 6-6 6',back:'M20 13H5m6-6-6 6 6 6',grid:'M4 4h7v7H4zm11 0h7v7h-7zM4 15h7v7H4zm11 0h7v7h-7z',list:'M5 6h2m4 0h11M5 13h2m4 0h11M5 20h2m4 0h11',export:'M13 17V3m-5 5 5-5 5 5M4 15v7h18v-7',close:'m7 7 12 12M19 7 7 19',chevron:'m7 10 6 6 6-6',check:'m6 13 4 4L20 7',home:'M3 10 12 3l9 7v10H5V10m4 10v-7h6v7',library:'M4 4h5v16H4zm7 0h4v16h-4zm6 1 4-1 3 15-4 1z',mistakes:'M5 3h14v18H5zm4 5h6m-6 4h6m-6 4h3',records:'M4 6v5h5M4 11a8 8 0 1 1 2 7m6-11v6l4 2',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',folder:'M3 6h7l2 3h10v11H3z',paper:'M5 3h10l5 5v13H5zm10 0v6h5M9 13h7m-7 4h7',panel:'M3 4h18v16H3zM9 4v16m7-12-4 4 4 4',search:'M17 17l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'};
export const icon=name=>`<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.paper}"/></svg>`;
export const btn=(label,action='',cls='',attrs='')=>`<button type="button" class="button ${cls}" ${action?`data-action="${esc(action)}"`:''} ${attrs}>${label}</button>`;
export const link=(text,route,cls='')=>`<a href="#/${route}" class="${cls}">${text}</a>`;
export function tagStyle(text,namespace='question'){
 const color=tagColor(text,namespace),rgb=color.slice(1).match(/../g).map(v=>parseInt(v,16)),linear=rgb.map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}),luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 const ink=luminance>.179?'#253128':'#FFFFFF',outline='#'+rgb.map(v=>Math.round(v*.65).toString(16).padStart(2,'0')).join('');
 return `--tag-bg:${color};--tag-ink:${ink};--tag-outline:${outline}`;
}
export const pill=(text,namespace='question')=>namespace==='status'?`<span class="pill">${esc(text)}</span>`:`<span class="pill tag-color" style="${tagStyle(text,namespace==='file'?'file':'question')}">${esc(text)}</span>`;
export function multiFilter(label,key,options,selected){return `<select multiple data-all-mode="inclusive" data-filter="${key}" aria-label="${esc(label)}">${options.map(([value,text])=>`<option value="${esc(value)}" ${['fileTags','questionTags'].includes(key)?`data-tag-namespace="${key==='fileTags'?'file':'question'}"`: ""} ${selected==null||selected.includes(value)?'selected':''}>${esc(text)}</option>`).join('')}</select>`;}
export function dateFilter(start='',end='',label='日期'){
 const value=start||end?(start===end?start:(start||'不限')+' 至 '+(end||'不限')):label;
 return `<details class="date-filter-card ${start||end?'is-filtered':''}"><summary class="select-trigger" aria-label="${esc(label)}" title="${esc(label+'：'+value)}"><span class="filter-value"><span data-select-value>${esc(value)}</span></span>${icon('chevron')}</summary><div class="date-filter-popover"><label class="field"><span>开始日期</span><input type="date" data-date-start value="${esc(start)}"></label><label class="field"><span>结束日期</span><input type="date" data-date-end value="${esc(end)}"></label><p class="date-filter-error" role="alert"></p><div class="actions">${btn('清除','clear-date-filter','quiet')}${btn('应用','apply-date-filter','primary')}</div></div></details>`;
}

export const empty=(title,detail)=>`<div class="empty"><span class="empty-mark">${icon('library')}</span><h2>${esc(title)}</h2><p>${esc(detail)}</p></div>`;
export const heading=(title,sub='',actions='',cls='')=>`<div class="page-heading ${esc(cls)}"><div><h1>${esc(title)}</h1>${sub?`<p>${sub}</p>`:''}</div><div class="actions">${actions}</div></div>`;
export const search=(value='',placeholder='搜索名称')=>`<label class="search">${icon('search')}<input id="search" type="search" value="${esc(value)}" placeholder="${placeholder}" aria-label="${placeholder}"></label>`;
export const duration=seconds=>`${Math.floor(seconds/60)}分${String(seconds%60).padStart(2,'0')}秒`;
export function toast(message){const node=document.getElementById('toast');node.textContent=message;node.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('show'),3500);}
export function closeModal(){document.querySelector('dialog[open]')?.close();document.getElementById('overlay-root').innerHTML='';}
export function modal(title,body,actions='',onSubmit){
 closeModal();document.getElementById('overlay-root').innerHTML=`<dialog class="modal"><form id="modal-form"><div class="modal-heading"><h2>${esc(title)}</h2><button type="button" class="icon-button" data-close aria-label="关闭">×</button></div><div class="modal-body">${body}</div><p class="form-error" role="alert"></p><div class="modal-actions">${actions||'<button class="button primary" type="submit">保存</button>'}</div></form></dialog>`;
 const dialog=document.querySelector('dialog');enhanceSelects(dialog);dialog.showModal();dialog.querySelector('[data-close]').onclick=closeModal;
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeModal();});dialog.addEventListener('cancel',()=>{setTimeout(closeModal,0);});
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{onSubmit?.(new FormData(e.target));}catch(error){dialog.querySelector('.form-error').textContent=error.message||'保存失败，请重试。';}};
}
export const field=(label,name,value='',attrs='')=>`<label class="field"><span>${esc(label)}</span><input name="${name}" value="${esc(value)}" ${attrs}></label>`;
export function questionBody(q,showAnswer=false){return `<div class="question-text">${esc(q.content)}</div>${q.options?`<div class="preview-options">${q.options.map((o,i)=>`<div><span>${String.fromCharCode(65+i)}</span>${esc(o.text)}</div>`).join('')}</div>`:''}${showAnswer?`<div class="analysis"><b>参考答案</b><p>${esc(q.options?q.options.filter(o=>q.correctIds.includes(o.id)).map(o=>o.text).join('；'):q.blanks?q.blanks.map(b=>b.join(' / ')).join('；'):q.reference)}</p><b>解析</b><p>${esc(q.explanation||'暂无解析。')}</p></div>`:''}`;}

// Shared preview Select: native form value plus a styled, keyboard-operated listbox.
let selectSequence=0;
export function enhanceSelects(root=document){
 for(const native of root.querySelectorAll('select:not([data-enhanced])')){
  native.dataset.enhanced='true';
  const label=native.getAttribute('aria-label')||native.closest('label')?.querySelector('span')?.textContent||'选择',multiple=native.multiple,isFilter=native.hasAttribute('data-filter')||native.hasAttribute('data-record-mode')||native.hasAttribute('data-filter-demo');
  const id=`quarry-select-${++selectSequence}`,wrapper=document.createElement('div');wrapper.className='quarry-select'+(isFilter?' filter-card':'');native.before(wrapper);wrapper.append(native);
  native.classList.add('select-native');native.setAttribute('aria-hidden','true');native.tabIndex=-1;
  const allSelected=()=>[...native.options].every(o=>o.selected),filtered=()=>isFilter&&(multiple?!allSelected():native.value!=='all');
  const summary=()=>isFilter&&!filtered()?label:!multiple?native.selectedOptions[0]?.textContent||'':native.selectedOptions.length?[...native.selectedOptions].map(o=>o.textContent).join('、'):'未选择';
  wrapper.classList.toggle('is-filtered',filtered());
  wrapper.insertAdjacentHTML('beforeend',`<button type="button" class="select-trigger" aria-label="${esc(label)}" title="${esc(label+'：'+summary())}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}" ${native.disabled?'disabled':''}><span class="filter-value"><span data-select-value>${esc(summary())}</span></span>${icon('chevron')}</button><div class="select-popover" id="${id}" popover="auto" role="listbox" ${multiple?'aria-multiselectable="true"':''} aria-label="${esc(label)}">${multiple?`<button type="button" role="option" tabindex="-1" aria-selected="${allSelected()}" data-select-all><span>全部</span>${icon('check')}</button>`:''}${[...native.options].map(o=>`<button type="button" role="option" tabindex="-1" aria-selected="${o.selected}" class="${o.dataset.tagNamespace?'tag-option':''}" data-value="${esc(o.value)}" ${o.disabled?'disabled':''}><span>${o.dataset.tagNamespace?pill(o.textContent,o.dataset.tagNamespace):esc(o.textContent)}</span>${icon('check')}</button>`).join('')}</div>`);
  const trigger=wrapper.querySelector('.select-trigger'),popover=wrapper.querySelector('.select-popover'),options=()=>[...popover.querySelectorAll('[role="option"]:not(:disabled)')];
  const close=()=>{popover.hidePopover();trigger.focus();};
  const open=(last=false)=>{
   if(popover.matches(':popover-open'))return;popover.showPopover();
   const rect=trigger.getBoundingClientRect(),width=Math.max(rect.width,210),height=Math.min(popover.scrollHeight,320);popover.style.width=`${width}px`;popover.style.left=`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`;popover.style.top=`${rect.bottom+height+12>innerHeight?Math.max(12,rect.top-height-8):rect.bottom+8}px`;
   (last?options().at(-1):popover.querySelector('[aria-selected="true"]')||options()[0])?.focus();
  };
  trigger.addEventListener('click',e=>{e.preventDefault();popover.matches(':popover-open')?close():open();});
  popover.addEventListener('toggle',e=>trigger.setAttribute('aria-expanded',String(e.newState==='open')));
  popover.addEventListener('click',e=>{
   const option=e.target.closest('[role="option"]');if(!option||option.disabled)return;e.preventDefault();
   if(multiple){if(option.hasAttribute('data-select-all')){const selected=!allSelected();[...native.options].forEach(o=>o.selected=selected);}else{const target=[...native.options].find(o=>o.value===option.dataset.value);target.selected=!target.selected;}}
   else native.value=option.dataset.value;
   native.dataset.focusValue=option.hasAttribute('data-select-all')?'__all__':option.dataset.value;
   trigger.querySelector('[data-select-value]').textContent=summary();trigger.title=label+'：'+summary();wrapper.classList.toggle('is-filtered',filtered());popover.querySelectorAll('[role="option"]').forEach(o=>o.setAttribute('aria-selected',String(o.hasAttribute('data-select-all')?allSelected():[...native.selectedOptions].some(v=>v.value===o.dataset.value))));
   if(!multiple)close();native.dispatchEvent(new Event('change',{bubbles:true}));
   if(!multiple)[...document.querySelectorAll('.select-trigger')].find(t=>t.getAttribute('aria-label')===label)?.focus();
  });
  let typed='',typeTimer;
  wrapper.addEventListener('keydown',e=>{
   if(e.target===native)return;
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!popover.matches(':popover-open')){open(e.key==='ArrowUp'||e.key==='End');return;}const items=options(),index=items.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}
   else if(e.key==='Escape'&&popover.matches(':popover-open')){e.preventDefault();close();}
   else if(e.key==='Tab'&&popover.matches(':popover-open')){popover.hidePopover();trigger.focus();}
   else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&e.key!==' '){e.preventDefault();open();typed+=e.key.toLowerCase();clearTimeout(typeTimer);typeTimer=setTimeout(()=>typed='',650);options().find(o=>o.textContent.trim().toLowerCase().startsWith(typed))?.focus();}
  });
 }
}

export function navigationControls(ctx){const {canBack=false,canForward=false}=ctx.navigationState?.()||{};return `<div class="page-navigation-controls" aria-label="页面导航">${btn(icon('back'),'navigate-back','icon-only',`aria-label="返回上一页" title="返回上一页" ${canBack?'':'disabled'}`)}${btn(icon('forward'),'navigate-forward','icon-only',`aria-label="前进下一页" title="前进下一页" ${canForward?'':'disabled'}`)}${btn(icon('home'),'navigate-home','icon-only','aria-label="返回首页" title="返回首页"')}</div>`;}
export function timestamp(value){if(!value)return '—';const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00':value);return Number.isNaN(date.getTime())?esc(value):date.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).replaceAll('/','-');}

export function stopwatch(seconds){const total=Math.max(0,Math.floor(Number(seconds)||0)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),parts=[String(minutes).padStart(2,'0'),String(total%60).padStart(2,'0')];return hours?[String(hours).padStart(2,'0'),...parts].join(':'):parts.join(':');}

export const breadcrumb=items=>`<nav class="breadcrumb" aria-label="资料路径">${items.map((item,i)=>`${i?'<span class="breadcrumb-separator" aria-hidden="true">/</span>':''}${item.route?link(esc(item.name),item.route):`<span aria-current="page">${esc(item.name)}</span>`}`).join('')}</nav>`;
export function statusPill(text,state){const mark={completed:'check',paused:'pause',in_progress:'play'}[state];return `<span class="pill status-pill status-${esc(state)}">${mark?`<span class="status-mark" aria-hidden="true">${icon(mark)}</span>`:'<span class="status-dot" aria-hidden="true"></span>'}${esc(text)}</span>`;}

// Internal visual specification preview; reuses the same option/control primitives.
export function componentSpec(){
 const states=[['','未选','白色表面'],['chosen','已选，未判分','暖米黄 · #EDE5D0'],['answer-correct','判分正确','绿色 + 勾选图标'],['chosen answer-incorrect','判分错误','红色 + 错误图标']];
 const type=[['small','15','辅助信息、标签、状态'],['body','17','正文、按钮、输入框'],['section','20','分区标题、默认题干'],['title','28','页面标题、中型统计'],['display','48','首页大数字']];
 const weights=[['regular','400','常规','正文、题干、选项、辅助说明、展示数字'],['medium','500','中等','按钮、导航、文件名称、标签与状态药丸'],['semibold','600','半粗','页面／分区／弹窗标题、表头、表单字段名、判分结果'],['bold','700','加粗','参考答案与解析标题、斩／复操作']];
 return `<div class="component-spec"><h1>组件规范</h1><p class="spec-intro">米白、松绿与暖米黄 · 字号与状态预览</p><section class="spec-section"><h2>选项状态</h2><div class="spec-state-grid">${states.map(([state,label,caption],i)=>`<div><button type="button" class="answer-option ${state}" disabled aria-label="${label}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${label}</span>${i>1?`<span class="option-feedback">${icon(i===2?'check':'close')}</span>`:''}</button><p class="spec-caption">${caption}</p></div>`).join('')}</div></section><section class="spec-section"><h2>五档字号</h2>${type.map(([role,size,label])=>`<div class="spec-type-row"><span>${size}px</span><p class="type-${role} ${role==='display'?'spec-display':''}">${role==='display'?'1,284':label}</p></div>`).join('')}</section><section class="spec-section"><h2>四档字重与用途</h2>${weights.map(([role,weight,label,uses])=>`<div class="spec-weight-row spec-weight-${role}"><span>${weight}</span><p>${label} · 题匣 Quarry</p><small>${uses}</small></div>`).join('')}<p class="spec-caption">字体用途固定；选中、悬停和正误状态不改变字重，避免文字跳动。</p></section><section class="spec-section"><h2>输入与筛选</h2><div class="spec-field-grid">${field('资料名称','spec-name','高等数学')}<label class="field"><span>禁用输入</span><input value="暂不可编辑" disabled></label><label class="field"><span>筛选</span><select aria-label="规范筛选" data-filter-demo><option value="all">全部</option><option value="bank">题库</option><option value="paper">套题</option></select></label><label class="search">${icon('search')}<input type="search" placeholder="搜索名称" aria-label="规范搜索"></label></div><div class="spec-control-row space-top-6"><label><input type="checkbox">复选框</label><label><input type="checkbox" checked>已勾选</label><label><input type="checkbox" disabled>禁用</label><label class="editor-switch-line"><span>跟随来源</span><input type="checkbox" role="switch" class="switch-control" aria-label="规范开关"></label></div></section><section class="spec-section"><h2>标签、状态与表格</h2><div class="spec-control-row">${pill('章节练习','file')}${pill('基础巩固')}${statusPill('进行中','in_progress')}${statusPill('已暂停','paused')}${statusPill('已完成','completed')}</div><table class="data-table space-top-6"><thead><tr><th>名称</th><th>类型</th><th>状态</th></tr></thead><tbody><tr><td>高数 · 极限与连续</td><td><span class="pill mode-pill">练习</span></td><td>${statusPill('进行中','in_progress')}</td></tr></tbody></table></section><section class="spec-section"><h2>按钮层级</h2><div class="spec-controls">${btn('下一题','','primary')}${btn('查看答案')}${btn('编辑布局','','quiet')}${btn('暂不可用','','','disabled')}</div></section></div>`;
}
