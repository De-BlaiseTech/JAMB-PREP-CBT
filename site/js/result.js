const $=id=>document.getElementById(id);
let result=null,wrongOnly=false;
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function render(){
 if(!result)return;$('score').textContent=result.percentage+'%';$('scoreline').textContent=`${result.score} / ${result.total} correct`;$('correct').textContent=result.correct;$('wrong').textContent=result.wrong;$('unanswered').textContent=result.unanswered;$('insight').textContent=result.recommendation||'';
 $('breakdown').innerHTML=(result.sections||[]).map(s=>`<div class="breakdown-row"><div class="breakdown-head"><span>${esc(s.subject)}</span><span>${s.score}/${s.total} (${s.percentage}%)</span></div><div class="progress-bar"><i style="width:${Math.max(0,Math.min(100,Number(s.percentage)||0))}%"></i></div></div>`).join('');
 const list=wrongOnly?(result.review||[]).filter(x=>!x.correct):(result.review||[]);
 $('review').innerHTML=list.map(x=>{const status=x.selected===null?'unanswered':x.correct?'correct':'wrong';return `<article class="review-item ${status}"><div style="display:flex;justify-content:space-between;gap:10px"><b>Question ${x.number}</b><span class="pill">${esc(x.subject)}</span></div><h3 style="margin:10px 0">${esc(x.question)}</h3>${(x.options||[]).map((o,i)=>{const isCorrect=i===x.correctAnswer,isSelected=i===x.selected;let cls='answer-row';if(isCorrect)cls+=' correct-answer';else if(isSelected)cls+=' wrong-answer';return `<div class="${cls}"><b>${String.fromCharCode(65+i)}.</b> ${esc(o)}${isCorrect?' — Correct answer':''}${isSelected&&!isCorrect?' — Your answer':''}</div>`}).join('')}<div class="explanation"><b>Why?</b><br>${esc(x.explanation||'Review the question carefully.')}</div></article>`}).join('')||'<div class="empty">No questions match this filter.</div>';
}
$('wrongOnly').onclick=()=>{wrongOnly=!wrongOnly;$('wrongOnly').textContent=wrongOnly?'Show All Questions':'Show Wrong Only';render()};
(async()=>{
 const id=new URLSearchParams(location.search).get('attempt')||localStorage.getItem('activeExamId')||JSON.parse(localStorage.getItem('lastResult')||'null')?.id;
 if(!id){location.replace('dashboard.html');return}
 try{
  const fb=await import('./firebase-bridge.js');result=await fb.getAttempt(id);localStorage.setItem('lastResult',JSON.stringify(result));
  $('sync').textContent='Verified result';$('sync').classList.remove('offline-badge');render();
 }catch(e){$('sync').textContent='Unable to verify';$('sync').classList.add('offline-badge');document.querySelector('main').innerHTML='<section class="card"><h2>Result unavailable</h2><p class="muted">We could not securely verify this result. Please reconnect to the internet and try again.</p><a class="btn primary" href="dashboard.html">Back to Dashboard</a></section>'}
})();
