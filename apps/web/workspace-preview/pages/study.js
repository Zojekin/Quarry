import {db,commit,getSession,grade,captureMistake} from '../store.js';
import {typeNames,modeNames} from '../data.js';
import {esc,btn,link,heading,empty,pill,duration,questionBody,modal,closeModal,toast,icon} from '../ui.js';
export const currentRecord=(s,q)=>s.redo?.[q.id]?null:s.attempts[q.id]?.at(-1);
export const answered=a=>Array.isArray(a)&&a.some(v=>String(v).trim());
// Keep short parenthetical notes together without changing the stored question text.
const stemContent=value=>String(value??'').split(/([（(][^（）()\n]{1,16}[）)])/g).map((part,index)=>index%2?`<span class="short-aside">${esc(part)}</span>`:esc(part)).join('');

function answerFields(s,q,exam=false){
 const record=s.status==='completed'?s.attempts[q.id]?.at(-1):currentRecord(s,q),locked=exam?s.status==='completed':!!record;
 const answer=locked?record?.answer||[]:s.drafts[q.id]||[];
 if(q.options)return `<div class="answer-options">${q.options.map((o,i)=>{
  const chosen=answer.includes(o.id),revealed=locked&&(record?.graded||!record&&s.status==='completed'&&Array.isArray(q.correctIds)),correct=revealed&&q.correctIds.includes(o.id),wrong=revealed&&chosen&&!correct,missed=correct&&!chosen;
  const feedback=correct?'correct':wrong?'incorrect':'',label=correct?(missed?'漏选':'正确'):wrong?'选错':'';
  return `<button type="button" class="answer-option ${chosen?'chosen':''} ${feedback?`answer-${feedback}`:''}" data-action="choose-option" data-id="${s.id}" data-question="${q.id}" data-option="${o.id}" aria-pressed="${chosen}" ${locked?'disabled':''}><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${esc(o.text)}</span>${label?`<span class="option-feedback" role="img" aria-label="${label}">${icon(correct?'check':'close')}</span>`:''}</button>`;
 }).join('')}</div>`;
 if(q.blanks)return `<div class="answer-inputs">${q.blanks.map((_,i)=>`<input aria-label="第${i+1}空" placeholder="填写第${i+1}空" value="${esc(answer[i]||'')}" data-answer-input data-session="${s.id}" data-question="${q.id}" data-blank="${i}" ${locked?'disabled':''}>`).join('')}</div>`;
 return `<div class="answer-inputs"><textarea aria-label="你的答案" rows="5" placeholder="在这里填写你的答案" data-answer-input data-session="${s.id}" data-question="${q.id}" data-blank="0" ${locked?'disabled':''}>${esc(answer[0]||'')}</textarea></div>`;
}
function resultStatus(q,record,withScore=true){return `<span class="result-status ${record.graded&&!record.correct?'incorrect':''}">${record.graded?(record.correct?'回答正确':'本次未获满分'):'已完成'}${withScore&&record.graded?` · ${record.score} / ${q.maxScore} 分`:''}</span>`;}
function solution(q,record,withStatus=true){
 const standard=q.blanks?q.blanks.map(b=>b.join(' / ')).join('；'):q.reference;
 return `${withStatus?resultStatus(q,record):''}<div class="solution-panels">${!q.options?`<section class="analysis solution-panel reference-panel"><h3>参考答案</h3><p>${esc(standard||'暂无参考答案。')}</p></section>`:''}<section class="analysis solution-panel explanation-panel"><h3>解析</h3><p>${esc(q.explanation||'暂无解析。')}</p></section></div>`;
}
export function study(ctx,id){
 const s=getSession(id);if(!s)return empty('答题记录不存在','请从保存的套题开始答题。');
 if(s.status==='completed')return result(ctx,id);
 const exam=s.mode==='exam',q=s.snapshot[Math.min(s.index,s.snapshot.length-1)],record=currentRecord(s,q);
 const navigation=`<div class="study-actions">${!record?btn('查看答案','confirm-answer','',`data-id="${id}" title="保存本次作答并查看答案" aria-description="保存并锁定本次作答，然后显示答案与解析"`):btn('重新作答','redo-question','',`data-id="${id}"`)}<div class="actions study-navigation">${btn('上一题','previous-question','',`data-id="${id}" ${s.index===0?'disabled':''}`)}${btn('下一题','next-question','primary',`data-id="${id}" ${s.index===s.snapshot.length-1?'disabled':''}`)}</div></div>`;
 const questionCard=(question,index)=>`<article class="card question-card study-question-card ${exam?'exam-question-card':''}" id="question-${index}"><div class="study-info"><span>第 ${index+1} / ${s.snapshot.length} 题</span><span class="question-meta"><span>${typeNames[question.type]} · ${!exam&&record?.graded?`${record.score} / ${question.maxScore} 分`:question.maxScore?`${question.maxScore}分`:'不自动判分'}</span>${!exam&&record?resultStatus(question,record,false):''}</span></div><div class="question-stem"><div class="question-text">${stemContent(question.content)}</div></div><div class="question-response">${question.options?'':'<div class="response-label">填写答案</div>'}${answerFields(s,question,exam)}${!exam&&record?`${solution(question,record,false)}${!record.graded?`<div class="actions study-manual-actions">${btn(s.manualAdded?.[q.id]?'已加入错题本':'加入错题本','manual-mistake','quiet',`data-id="${id}" ${s.manualAdded?.[q.id]?'disabled':''}`)}</div>`:''}`:''}${!exam?navigation:''}</div></article>`;
 const content=`<div class="study-content">${exam?`<p class="muted small space-bottom-6">交卷前可以修改答案，提交后查看答案与解析。</p><div class="exam-list">${s.snapshot.map(questionCard).join('')}</div>`:questionCard(q,s.index)}</div>`;
 return content+(s.status==='paused'?`<div class="pause-screen" role="dialog" aria-modal="true" aria-label="答题已暂停"><div><div class="pause-mark">Ⅱ</div><div class="serif">休息一下，再继续。</div><p>计时已暂停，答题内容已遮挡。</p>${btn('继续答题','resume-paused','primary',`data-id="${id}"`)}<div class="space-top-4">${link('返回学习记录','records','button quiet')}</div></div></div>`:'');
}

export function result(ctx,id){
 const s=getSession(id);if(!s)return empty('没有找到这次学习记录','请返回学习记录查看。');
 const attempts=Object.values(s.attempts).flat(),latest=s.snapshot.map(q=>({q,record:s.attempts[q.id]?.at(-1)}));
 const score=latest.reduce((sum,v)=>sum+(v.record?.score||0),0),max=s.snapshot.reduce((sum,q)=>sum+(q.maxScore||0),0),correct=latest.filter(v=>v.record?.correct).length,completed=latest.filter(v=>v.record).length;
 const filter=ctx.state.resultFilter||'all',rows=latest.filter(v=>filter==='all'||filter==='incorrect'&&!v.record?.correct||filter==='unanswered'&&!v.record);
 return `${heading('学习结果',`${link('学习记录','records')} / ${esc(s.name)}`,link('返回学习记录','records','button'))}<div class="result-hero"><div><span class="muted">${modeNames[s.mode]}已结束</span><h1 class="space-y-2">${esc(s.name)}</h1><div class="actions muted small"><span>已完成 ${completed} / ${s.snapshot.length} 题</span><span>正确 ${correct} 题</span><span>用时 ${duration(s.elapsed)}</span><span>累计 ${attempts.length} 次作答</span></div></div><div class="score">${score}<span class="unit">/ ${max} 分</span></div></div><div class="toolbar"><div class="tabs result-tabs">${[['all','全部题目'],['incorrect','未满分与未作答'],['unanswered','未作答']].map(([v,n])=>btn(n,'result-filter',`tab ${filter===v?'active':''}`,`data-value="${v}"`)).join('')}</div>${link('打开错题本 →','mistakes','button quiet')}</div>${rows.map(({q,record},i)=>`<article class="result-row"><div class="study-info"><span>第 ${s.snapshot.findIndex(v=>v.id===q.id)+1} 题 · ${typeNames[q.type]}</span><span>${record?record.graded?`${record.score} / ${q.maxScore} 分`:'参考答案题':'未作答'}</span></div><div class="question-text">${esc(q.content)}</div><p class="muted space-top-4">你的答案：${esc(record?(q.options?q.options.filter(o=>record.answer.includes(o.id)).map(o=>o.text).join('；'):record.answer.join('；')):'未作答')}</p><details class="space-top-3"><summary>答案与解析</summary>${q.options?answerFields(s,q,true):''}${solution(q,record||{graded:!!q.maxScore,score:0,correct:false})}</details></article>`).join('')||empty('没有符合条件的题目','切换筛选查看其他题目。')}`;
}

export function submitExam(id){
 commit(state=>{const s=state.sessions.find(s=>s.id===id);if(s.status==='completed')return;s.snapshot.forEach(q=>{const answer=s.drafts[q.id]||[];if(!answered(answer))return;const grading=grade(q,answer);s.attempts[q.id]=[{answer:structuredClone(answer),...grading,attempt:1}];if(grading.graded&&!grading.correct)captureMistake(state,q,answer,s);});s.status='completed';s.completed=new Date().toISOString();});
}

export function studyAction(action,el,ctx){
 const id=el.dataset.id,s=getSession(id);
 if(action==='choose-option'){
  const q=s.snapshot.find(q=>q.id===el.dataset.question);if(s.mode==='practice'&&currentRecord(s,q)||s.status==='completed')return true;
  commit(state=>{const session=state.sessions.find(v=>v.id===id),current=session.drafts[q.id]||[],option=el.dataset.option;session.drafts[q.id]=q.type==='single_choice'?[option]:current.includes(option)?current.filter(v=>v!==option):[...current,option];});ctx.render();
 }
 else if(action==='confirm-answer'){
  const q=s.snapshot[s.index],answer=s.drafts[q.id]||[];if(currentRecord(s,q))return true;if(!answered(answer)){toast('请先填写答案。');return true;}
  ctx.flushTime();commit(state=>{const session=state.sessions.find(v=>v.id===id),grading=grade(q,answer);const list=session.attempts[q.id]||[];list.push({answer:structuredClone(answer),...grading,attempt:list.length+1});session.attempts[q.id]=list;if(session.redo)delete session.redo[q.id];if(grading.graded&&!grading.correct)captureMistake(state,q,answer,session);});ctx.render();document.querySelector('.study-actions')?.scrollIntoView({block:'nearest',behavior:'instant'});
 }
 else if(action==='redo-question'){commit(state=>{const session=state.sessions.find(v=>v.id===id),q=session.snapshot[session.index];session.redo??={};session.redo[q.id]=true;delete session.drafts[q.id];});ctx.render();}
 else if(action==='manual-mistake'){commit(state=>{const session=state.sessions.find(v=>v.id===id),q=session.snapshot[session.index];if(session.manualAdded?.[q.id])return;captureMistake(state,q,currentRecord(session,q).answer,session);session.manualAdded??={};session.manualAdded[q.id]=true;});ctx.render();toast('已加入错题本');}
 else if(action==='previous-question'||action==='next-question'||action==='jump-question'){
  if(action==='next-question'&&s.index===s.snapshot.length-1)return true;
  commit(state=>{const session=state.sessions.find(v=>v.id===id);session.index=action==='jump-question'?Number(el.dataset.index):Math.max(0,Math.min(session.snapshot.length-1,session.index+(action==='next-question'?1:-1)));});ctx.render();if(s.mode==='exam')document.getElementById(`question-${el.dataset.index}`)?.scrollIntoView({block:'start'});
 }
 else if(action==='pause-session'){ctx.flushTime();commit(state=>{state.sessions.find(v=>v.id===id).status='paused';});ctx.render();setTimeout(()=>document.querySelector('[data-action="resume-paused"]')?.focus(),0);}
 else if(action==='resume-paused'){commit(state=>{state.sessions.find(v=>v.id===id).status='in_progress';});ctx.render();}
 else if(action==='finish-session'){
  const count=s.mode==='exam'?Object.values(s.drafts).filter(answered).length:Object.values(s.attempts).filter(a=>a.length).length;
  modal(s.mode==='exam'?'确认交卷':'结束本次练习',`<h3>已完成 ${count} / ${s.snapshot.length} 题</h3><p class="muted space-top-4">${s.mode==='exam'?'交卷后答案将锁定，未作答题目计零分，但不计入作答量。':'已确认的作答会保留在学习记录中，未作答题目不计入作答量。'}</p>`,`<button type="button" class="button" data-close>继续答题</button><button class="button primary" type="submit">${s.mode==='exam'?'确认交卷':'保存并结束'}</button>`,()=>{ctx.flushTime();if(s.mode==='exam')submitExam(id);else commit(state=>{const session=state.sessions.find(v=>v.id===id);session.status='completed';session.completed=new Date().toISOString();});closeModal();ctx.go(`result/${id}`);});
 }
 else if(action==='exit-study'){ctx.flushTime();if(s&&s.status!=='completed')commit(state=>{state.sessions.find(v=>v.id===id).status='paused';});ctx.go('records');}
 else if(action==='result-filter'){ctx.state.resultFilter=el.dataset.value;ctx.render();}
 else return false;return true;
}
