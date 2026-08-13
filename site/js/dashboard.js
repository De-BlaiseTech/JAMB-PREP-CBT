const $=id=>document.getElementById(id);
const user=JSON.parse(localStorage.getItem('jambUser')||'{}');
$('userName').textContent=user.name||user.email?.split('@')[0]||'Student';
$('mode').textContent='Student Practice';
function localResults(){try{return JSON.parse(localStorage.getItem('resultHistory')||'[]')}catch{return[]}}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function render(data){
 data=Array.isArray(data)?data:[];
 $('tests').textContent=data.length;
 const scores=data.map(x=>+x.percentage||0);
 $('best').textContent=(scores.length?Math.max(...scores):0)+'%';
 $('avg').textContent=(scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0)+'%';
 $('recent').textContent=data.filter(x=>{const t=Date.parse(x.submittedAt);return Number.isFinite(t)&&Date.now()-t<604800000}).length;
 const h=$('history');
 if(!data.length){h.className='empty';h.textContent='No completed tests yet.'}else{
  h.className='history-list';h.innerHTML=data.slice(0,8).map(r=>{const p=+r.percentage||0;const cls=p>=70?'good':p>=50?'mid':'low';return `<div class="history-item"><div class="history-main"><div class="history-title">${esc(r.examName||'Practice Test')}</div><div class="tiny muted">${Number.isFinite(Date.parse(r.submittedAt))?new Date(r.submittedAt).toLocaleString():'Recent attempt'}</div></div><div class="history-score ${cls}">${p}%</div></div>`}).join('')}
 const map={};data.forEach(r=>(r.sections||[]).forEach(s=>{const subject=s.subject||'Other';map[subject]??=[];map[subject].push(+s.percentage||0)}));
 const subjectBox=$('subjects');
 subjectBox.innerHTML=Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).map(([s,a])=>{const p=Math.round(a.reduce((x,y)=>x+y,0)/a.length);return `<div class="breakdown-row"><div class="breakdown-head"><span>${esc(s)}</span><strong>${p}%</strong></div><div class="progress-bar"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div></div>`}).join('')||'<div class="empty">Complete a test to see your performance.</div>';
}
render(localResults());
(async()=>{
  try{
    const fb=await import('./firebase-bridge.js');
    const u=await fb.currentUser();
    if(!u){location.replace('index.html');return}
    const online=await fb.loadResults();
    const local=localResults();
    const merged=[...online,...local];
    const seen=new Set();
    const unique=merged.filter(x=>{const k=x.id||x.submittedAt;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>Date.parse(b.submittedAt||0)-Date.parse(a.submittedAt||0));
    localStorage.setItem('resultHistory',JSON.stringify(unique.slice(0,30)));
    render(unique);
  }catch(e){ location.replace('index.html'); }
})();
$('logout').onclick=async()=>{
 const button=$('logout');button.disabled=true;button.textContent='Signing Out…';
 try{const fb=await import('./firebase-bridge.js');await fb.logout()}catch(e){}
 localStorage.removeItem('jambUser');localStorage.removeItem('jambMode');localStorage.removeItem('mockSubjects');localStorage.removeItem('examSession');localStorage.removeItem('lastResult');
 location.replace('index.html');
};
