import {db,commit,uid,findFile,getQuestions,getSourceQuestion,followChanges} from './store.js';
import {typeNames} from './data.js';
import {esc,field,btn,icon,modal,closeModal,toast} from './ui.js';

const tagsFrom=value=>[...new Set(String(value).split(/[,，\n]+/).map(t=>t.trim()).filter(Boolean))];
const textArea=(label,name,value='',attrs='')=>`<label class="field"><span>${label}</span><textarea name="${name}" aria-label="${esc(label)}" ${attrs}>${esc(value)}</textarea></label>`;
const switchField=(label,name,checked)=>`<label class="editor-switch-line"><span>${label}</span><input type="checkbox" role="switch" class="switch-control" name="${name}" ${checked?'checked':''}></label>`;

export function editFileProperties(id,ctx){
 const file=findFile(id);if(!file)throw Error('资料不存在。');
 const paper=file.kind==='paper',changes=paper?followChanges(file):[],frozen=getQuestions(file);
 modal(paper?'编辑套题属性':'编辑题库属性',`${field('名称','name',file.name,'required maxlength="80"')}${textArea('简介','description',file.description)}${field('文件标签（用英文逗号分隔）','tags',(file.tags||[]).join(', '),'maxlength="300"')}${paper?`${field('考试时限（分钟，留空为不限时）','minutes',file.timeLimit?file.timeLimit/60:'','type="number" min="1" max="360"')}${switchField('跟随来源题库','followSource',file.followSource)}<div class="follow-preview" ${file.followSource?'':'hidden'}><h3>来源更新预览</h3>${changes.length?changes.map(c=>`<div class="follow-change"><b>${esc(c.title)}</b><p>${esc(c.fields.join('、'))}</p><p class="muted">更新后：${esc(c.nextContent)}</p></div>`).join(''):'<p class="muted">当前来源内容一致，无需更新。</p>'}<p class="small muted">只更新题目内容与题目标签；顺序、分值及已有作答保持不变。</p></div>`:''}`,'',form=>{
  const name=String(form.get('name')).trim();if(!name)throw Error('请输入名称。');
  const minutes=String(form.get('minutes')||''),follow=form.has('followSource');
  if(minutes&&(!Number.isFinite(Number(minutes))||Number(minutes)<1||Number(minutes)>360))throw Error('考试时限应为1至360分钟。');
  if(paper&&follow&&changes.some(c=>c.fields.includes('题型')))throw Error('来源题型已变更，请重新编排对应题目后开启跟随。');
  commit(state=>{const target=state.files.find(f=>f.id===id);target.name=name;target.description=String(form.get('description'));target.tags=tagsFrom(form.get('tags'));target.updated=new Date().toISOString();if(paper){target.timeLimit=minutes?Number(minutes)*60:null;target.snapshots=structuredClone(frozen);target.followSource=follow;}});
  closeModal();ctx.render();toast('属性已保存');
 });
 document.querySelector('[name="followSource"]')?.addEventListener('change',event=>{const preview=document.querySelector('.follow-preview');preview.hidden=!event.target.checked;if(event.target.checked)preview.scrollIntoView({block:'nearest',behavior:'instant'});});
}

export function editQuestion(fileId,questionId,ctx){
 let file=findFile(fileId),original=questionId?getQuestions(file).find(q=>q.id===questionId):null;
 if(!file)throw Error('资料不存在。');
 let sourceNotice='';
 if(original&&file.kind==='paper'&&file.followSource){
  const source=getSourceQuestion(original.id),bank=source&&db().files.find(f=>f.kind==='bank'&&f.questionIds.includes(source.id));
  if(bank){file=bank;fileId=bank.id;original=source;sourceNotice='正在编辑来源题库；跟随此题的套题会同步内容，历史作答保持原快照。';}
 }
 const draft=structuredClone(original||{id:uid('q'),version:1,type:'single_choice',content:'',options:[{id:uid('option'),text:''},{id:uid('option'),text:''}],correctIds:[],explanation:'',tags:[],maxScore:2});
 draft._options=draft.options||[{id:uid('option'),text:''},{id:uid('option'),text:''}];draft._correct=draft.correctIds||[];
 let type=draft.type;
 const optionsMarkup=()=>`<div class="choice-editor-heading"><span class="small muted">勾选正确答案</span><span class="small muted">至少保留两个选项</span></div><div class="choice-editor-rows">${draft._options.map((o,i)=>`<div class="choice-editor-row" data-option-id="${o.id}"><input type="checkbox" aria-label="${String.fromCharCode(65+i)}为正确答案" data-correct-option ${draft._correct.includes(o.id)?'checked':''}><span class="serif">${String.fromCharCode(65+i)}</span><input aria-label="选项${String.fromCharCode(65+i)}" data-option-text value="${esc(o.text)}" required><button type="button" class="button icon-only quiet" data-remove-option="${o.id}" aria-label="删除选项${String.fromCharCode(65+i)}" ${draft._options.length<=2?'disabled':''}>${icon('close')}</button></div>`).join('')}</div><button type="button" class="button" data-add-option>＋ 添加选项</button>`;
 const bodyForType=()=>type.includes('choice')?optionsMarkup():type==='strict_fill_in_blank'?`${textArea('标准答案（每行一空，用 | 分隔备选答案）','blanks',(draft.blanks||[['']]).map(v=>v.join('|')).join('\n'),'required')}<p class="small muted">答案按原文逐字符保存，空格、大小写不自动转换。</p>`:textArea('参考答案','reference',draft.reference||'','required');
 modal(original?'编辑题目':'新增题目',`<p class="small muted editor-owner">${esc(file.name)}${sourceNotice?` · ${sourceNotice}`:''}</p><label class="field"><span>题型</span><select name="type">${Object.entries(typeNames).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v}</option>`).join('')}</select></label>${textArea('题干','content',draft.content,'required')}<div id="question-type-fields">${bodyForType()}</div><section data-editor-details>${textArea('解析','explanation',draft.explanation)}<div class="editor-score" ${['subjective','free_fill_in_blank'].includes(type)?'hidden':''}>${field('分值','maxScore',draft.maxScore??2,'type="number" min="0.01" max="1000" step="0.01" required')}</div>${field('题目标签（用英文逗号分隔）','tags',(draft.tags||[]).join(', '),'maxlength="300"')}</section>`,'',form=>{
  syncOptions();
  const content=String(form.get('content')).trim();if(!content)throw Error('请填写题干。');
  const question={id:draft.id,updated:new Date().toISOString(),version:original?(original.version||1)+1:1,type,content,explanation:String(form.get('explanation')),tags:tagsFrom(form.get('tags'))};
  if(!['subjective','free_fill_in_blank'].includes(type)){question.maxScore=Number(form.get('maxScore'));if(!Number.isFinite(question.maxScore)||question.maxScore<=0||question.maxScore>1000)throw Error('分值应大于0且不超过1000。');}
  if(type.includes('choice')){
   question.options=draft._options.map(o=>({...o,text:o.text.trim()}));question.correctIds=[...new Set(draft._correct)].filter(id=>question.options.some(o=>o.id===id));
   if(question.options.length<2||question.options.some(o=>!o.text))throw Error('请填写至少两个非空选项。');
   if(!question.correctIds.length||type==='single_choice'&&question.correctIds.length!==1)throw Error(type==='single_choice'?'单选题必须选择一个正确答案。':'请至少选择一个正确答案。');
  }else if(type==='strict_fill_in_blank'){
   question.blanks=String(form.get('blanks')).split('\n').map(line=>line.split('|'));if(question.blanks.some(b=>!b.length||b.some(a=>a==='')))throw Error('每一空必须有非空的标准答案。');
  }else{question.reference=String(form.get('reference'));if(!question.reference.trim())throw Error('请填写参考答案。');}
  commit(state=>{
   const owner=state.files.find(f=>f.id===fileId);if(!owner)throw Error('资料已被删除。');
   if(owner.kind==='bank'){const index=state.questions.findIndex(q=>q.id===question.id);if(original&&index>=0)state.questions[index]=question;else{state.questions.push(question);owner.questionIds.push(question.id);}}
   else{owner.snapshots??=[];const index=owner.snapshots.findIndex(q=>q.id===question.id);if(original&&index>=0)owner.snapshots[index]=question;else{owner.snapshots.push(question);owner.questionIds.push(question.id);}}
   owner.updated=new Date().toISOString();
  });closeModal();ctx.render();toast(original?'题目已保存':'题目已添加');
 });
 const dialog=document.querySelector('dialog');dialog.classList.add('question-editor-modal');
 function syncOptions(){
  const rows=[...dialog.querySelectorAll('[data-option-id]')];if(!rows.length)return;
  draft._options=rows.map(row=>({id:row.dataset.optionId,text:row.querySelector('[data-option-text]').value}));
  draft._correct=rows.filter(row=>row.querySelector('[data-correct-option]').checked).map(row=>row.dataset.optionId);
 }
 function renderOptions(){dialog.querySelector('#question-type-fields').innerHTML=bodyForType();}
 dialog.addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-option]');
  if(remove){syncOptions();draft._options=draft._options.filter(o=>o.id!==remove.dataset.removeOption);draft._correct=draft._correct.filter(id=>id!==remove.dataset.removeOption);renderOptions();}
  if(event.target.closest('[data-add-option]')){syncOptions();draft._options.push({id:uid('option'),text:''});renderOptions();}
 });
 dialog.addEventListener('change',event=>{
  if(event.target.matches('[data-correct-option]')&&type==='single_choice'&&event.target.checked)dialog.querySelectorAll('[data-correct-option]').forEach(input=>{if(input!==event.target)input.checked=false;});
  if(event.target.matches('[name="type"]')){
   syncOptions();const blank=dialog.querySelector('[name="blanks"]'),reference=dialog.querySelector('[name="reference"]');if(blank)draft.blanks=blank.value.split('\n').map(v=>v.split('|'));if(reference)draft.reference=reference.value;
   type=event.target.value;renderOptions();const manual=['subjective','free_fill_in_blank'].includes(type);dialog.querySelector('.editor-score').hidden=manual;dialog.querySelector('[name="maxScore"]').disabled=manual;
  }
 });
 if(['subjective','free_fill_in_blank'].includes(type))dialog.querySelector('[name="maxScore"]').disabled=true;
}
