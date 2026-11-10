import {initialData} from './data.js';
const key='quarry-unified-preview-v1';
let state;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');state=saved?.version===1?saved:initialData();}catch{state=initialData();}
export const db=()=>state;
export const uid=prefix=>`${prefix}-${crypto.randomUUID()}`;
export function commit(change){const next=structuredClone(state);change(next);localStorage.setItem(key,JSON.stringify(next));state=next;return state;}
export const findFile=id=>state.files.find(f=>f.id===id);
export const getSourceQuestion=id=>state.questions.find(q=>q.id===id&&state.files.some(f=>f.kind==='bank'&&f.questionIds.includes(id)));
export const getQuestions=file=>{
 const questions=(file?.snapshots||file?.questionIds?.map(id=>state.questions.find(q=>q.id===id))||[]).filter(Boolean);
 if(file?.kind!=='paper'||!file.followSource)return questions;
 return questions.map(q=>{const source=getSourceQuestion(q.id);return source&&source.type===q.type?{...structuredClone(source),...('maxScore' in q?{maxScore:q.maxScore}:{})}:q;});
};
export function followChanges(file){
 const fields={type:'题型',content:'题干',options:'选项',correctIds:'标准答案',reference:'参考答案',blanks:'填空答案',explanation:'解析',tags:'题目标签'};
 return (file.snapshots||[]).flatMap(q=>{const source=getSourceQuestion(q.id);if(!source)return [];const changed=Object.entries(fields).filter(([key])=>JSON.stringify(q[key])!==JSON.stringify(source[key])).map(([,label])=>label);return changed.length?[{title:q.content,fields:changed,nextContent:source.content}]:[];});
}
export const getSession=id=>state.sessions.find(s=>s.id===id);
export function startSession(paperId,mode='practice'){
 const paper=findFile(paperId);if(!paper||paper.kind!=='paper')throw Error('请先保存套题。');
 const id=uid('session'),snapshot=structuredClone(getQuestions(paper));if(!snapshot.length)throw Error('套题还没有题目，请先选题。');
 if(paper.shuffle)for(let i=snapshot.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[snapshot[i],snapshot[j]]=[snapshot[j],snapshot[i]];}
 commit(s=>s.sessions.unshift({id,paperId,name:paper.name,mode,status:'in_progress',index:0,elapsed:0,created:new Date().toISOString().slice(0,10),snapshot,attempts:{},drafts:{},deadlineAt:mode==='exam'&&paper.timeLimit?Date.now()+paper.timeLimit*1000:null}));return id;
}
export function savePaper(name,questions,folder='f-review',settings={}){
 const id=uid('paper');if(!name.trim()||!questions.length)throw Error('请填写名称并选择题目。');
 commit(s=>s.files.unshift({id,kind:'paper',name:name.trim(),description:'',folder,tags:['复习套题'],updated:new Date().toISOString(),questionIds:questions.map(q=>q.id),snapshots:structuredClone(questions),shuffle:!!settings.shuffle,followSource:false,timeLimit:null}));return id;
}
export function grade(question,answer){
 if(['free_fill_in_blank','subjective'].includes(question.type))return{correct:null,score:null,graded:false};
 const correct=question.type==='strict_fill_in_blank'?question.blanks.every((b,i)=>b.includes(answer[i]??'')):answer.length===question.correctIds.length&&answer.every(id=>question.correctIds.includes(id));
 return{correct,score:correct?question.maxScore:0,graded:true};
}
export function captureMistake(s,question,answer,session){
 let mistake=s.mistakes.find(m=>m.question.id===question.id&&m.question.version===question.version);
 const source=session||s.sessions.find(v=>v.snapshot.some(q=>q.id===question.id));
 const history={sourceFolderId:s.files.find(f=>f.id===source?.paperId)?.folder,sourcePaperId:source?.paperId,sourceName:source?.name||'套题练习',date:new Date().toLocaleString('zh-CN',{hour12:false}),answer:structuredClone(answer),attempt:1};
 if(mistake){mistake.mastery='reviewing';mistake.history.push(history);}else{s.mistakes.unshift({id:uid('mistake'),question:structuredClone(question),sourcePaperId:source?.paperId,source:source?.name||'套题练习',mastery:'reviewing',history:[history],added:new Date().toISOString().slice(0,10)});}
}

// Appearance metadata remains separate for the two tag namespaces.
const tagPalette=['#E4EADE','#EEE7DA','#EBE6EE'];
export function tagColor(name,namespace='question'){
 const scope=namespace==='file'?'file':'question',saved=state.settings.tagColors?.[scope]?.[name];
 return /^#[0-9a-f]{6}$/i.test(saved||'')?saved:tagPalette[[...String(name)].reduce((sum,c)=>sum+c.codePointAt(0),0)%tagPalette.length];
}
export function tagNames(namespace='question'){
 const values=namespace==='file'?[...state.folders,...state.files]:[...state.questions,...state.files.flatMap(f=>f.snapshots||[]),...state.mistakes.map(m=>m.question)];
 return [...new Set(values.flatMap(v=>v.tags||[]))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
}
export function folderSubtree(id){
 const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const f of state.folders)if(ids.has(f.parent)&&!ids.has(f.id)){ids.add(f.id);changed=true;}}
 return {folders:state.folders.filter(f=>ids.has(f.id)),files:state.files.filter(f=>ids.has(f.folder))};
}
export function trashContent(id){
 const folder=state.folders.find(f=>f.id===id),file=findFile(id);if(!folder&&!file)throw Error('资料已经不存在。');
 const subtree=folder?folderSubtree(id):null;
 const frozen=state.files.filter(f=>f.kind==='paper'&&f.followSource).map(f=>({id:f.id,snapshots:structuredClone(getQuestions(f))}));
 commit(next=>{
  frozen.forEach(p=>{next.files.find(f=>f.id===p.id).snapshots=p.snapshots;});
  const deleted=new Date().toISOString();
  if(folder){const ids=new Set(subtree.folders.map(f=>f.id));next.trash.push({...structuredClone(folder),kind:'folder',deleted,children:{folders:structuredClone(subtree.folders),files:next.files.filter(f=>ids.has(f.folder))}});next.folders=next.folders.filter(f=>!ids.has(f.id));next.files=next.files.filter(f=>!ids.has(f.folder));}
  else{const index=next.files.findIndex(f=>f.id===id);next.trash.push({...next.files[index],deleted});next.files.splice(index,1);}
 });
}
export function restoreContent(id){
 const entry=state.trash.find(f=>f.id===id);if(!entry)throw Error('回收站项目已不存在。');
 const parent=entry.kind==='folder'?entry.parent:entry.folder;if(parent&&!state.folders.some(f=>f.id===parent))throw Error('请先恢复上级文件夹。');
 commit(next=>{
  const restored=structuredClone(entry);delete restored.deleted;
  if(entry.kind==='folder'){
   const {folders,files}=restored.children;if(folders.some(f=>next.folders.some(v=>v.id===f.id))||files.some(f=>next.files.some(v=>v.id===f.id)))throw Error('恢复目标已经存在，请先检查资料库。');
   next.folders.push(...folders);next.files.push(...files);
  }else{if(next.files.some(f=>f.id===id))throw Error('恢复目标已经存在。');next.files.unshift(restored);}
  next.trash=next.trash.filter(f=>f.id!==id);
 });
}
export function exportFolder(id){
 const root=state.folders.find(f=>f.id===id);if(!root)throw Error('文件夹不存在。');
 const subtree=folderSubtree(id),questions=[...new Map(subtree.files.filter(f=>f.kind==='bank').flatMap(f=>getQuestions(f)).map(q=>[q.id,q])).values()];
 return {format:'quarry-preview-folder',version:1,rootId:id,folders:structuredClone(subtree.folders),files:subtree.files.map(f=>({...structuredClone(f),...(f.kind==='paper'?{snapshots:structuredClone(getQuestions(f))}:{})})),questions:structuredClone(questions)};
}
export function importFolder(value,parent=null){
 if(value.version!==1||!Array.isArray(value.folders)||!Array.isArray(value.files)||!Array.isArray(value.questions)||!value.folders.length)throw Error('文件夹归档格式不匹配。');
 const folders=value.folders,folderIds=new Set(folders.map(f=>f.id)),root=folders.find(f=>f.id===value.rootId);
 if(!root||folderIds.size!==folders.length||folders.some(f=>!f.id||!f.name)||value.files.some(f=>!f.id||!f.name||!['bank','paper'].includes(f.kind)||!folderIds.has(f.folder)))throw Error('归档包含无效的文件夹或资料。');
 for(const folder of folders){let node=folder;const seen=new Set();while(node.id!==root.id){if(seen.has(node.id)||!folderIds.has(node.parent))throw Error('归档文件夹层级无效。');seen.add(node.id);node=folders.find(f=>f.id===node.parent);}}
 const allQuestions=[...value.questions,...value.files.flatMap(f=>f.snapshots||[])],types=new Set(['single_choice','multiple_choice','indefinite_choice','strict_fill_in_blank','free_fill_in_blank','subjective']);
 if(allQuestions.some(q=>!q.id||!q.content||!types.has(q.type)||q.options&&(!Array.isArray(q.options)||!q.options.length||!Array.isArray(q.correctIds)||q.correctIds.some(id=>!q.options.some(o=>o.id===id)))))throw Error('归档题目结构不完整。');
 const questionIds=new Set(allQuestions.map(q=>q.id));if(value.files.some(f=>!Array.isArray(f.questionIds)||f.questionIds.some(id=>!questionIds.has(id))))throw Error('归档题目引用不存在。');
 const folderMap=new Map(folders.map(f=>[f.id,uid('folder')])),qMap=new Map([...questionIds].map(id=>[id,uid('q')])),optionMap=new Map(allQuestions.flatMap(q=>(q.options||[]).map(o=>o.id)).map(id=>[id,uid('option')]));
 const copyQuestion=q=>({...structuredClone(q),id:qMap.get(q.id),...(q.options?{options:q.options.map(o=>({...o,id:optionMap.get(o.id)})),correctIds:q.correctIds.map(id=>optionMap.get(id))}:{})});
 commit(next=>{
  if(parent&&!next.folders.some(f=>f.id===parent))throw Error('目标文件夹已不存在。');
  next.folders.push(...folders.map(f=>({...structuredClone(f),id:folderMap.get(f.id),parent:f.id===root.id?parent:folderMap.get(f.parent),...(f.id===root.id?{name:f.name+'（导入）'}:{})})));
  next.questions.push(...value.questions.map(copyQuestion));
  next.files.push(...value.files.map(f=>({...structuredClone(f),id:uid(f.kind),folder:folderMap.get(f.folder),questionIds:f.questionIds.map(id=>qMap.get(id)),...(f.snapshots?{snapshots:f.snapshots.map(copyQuestion)}:{}),updated:new Date().toISOString()})));
 });return folderMap.get(root.id);
}
