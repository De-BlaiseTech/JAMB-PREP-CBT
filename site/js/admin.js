import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
const $=id=>document.getElementById(id);
let questions=[],students=[],user=null;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function note(t,type='info'){ $('notice').textContent=t; $('notice').className=`status-msg ${type}`; }
async function api(action,{method='GET',body=null,id=''}={}){
 const token=await user.getIdToken();
 const url=new URL('/api/admin',location.origin);url.searchParams.set('action',action);if(id)url.searchParams.set('id',id);
 const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||'Admin request failed.');return d;
}
function renderQuestions(){
 const term=$('questionSearch').value.toLowerCase();
 const list=questions.filter(q=>[q.subject,q.topic,q.question].join(' ').toLowerCase().includes(term));
 $('questionCount').textContent=questions.length;
 $('questionList').innerHTML=list.length?list.map(q=>`<article class="history-item" style="align-items:flex-start"><div class="history-main"><b>${esc(q.subject)}${q.topic?' · '+esc(q.topic):''}</b><div style="margin:6px 0">${esc(q.question)}</div><small class="muted">${(q.options||[]).map((o,i)=>`${'ABCD'[i]}. ${esc(o)}`).join(' · ')}</small><div class="tiny muted">Correct: ${'ABCD'[Number(q.answer)]||'?'} · ${q.active===false?'Inactive':'Active'} · ID: ${esc(q.id)}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn ghost" data-edit="${esc(q.id)}">Edit</button><button class="btn ghost" data-delete="${esc(q.id)}">Delete</button></div></article>`).join(''):'<div class="empty">No questions found.</div>';
}
function renderStudents(){
 const term=$('studentSearch').value.toLowerCase();
 const list=students.filter(s=>[s.name,s.email,s.regNo].join(' ').toLowerCase().includes(term));
 $('studentCount').textContent=students.length;
 $('attemptCount').textContent=students.reduce((n,s)=>n+s.testsCompleted,0);
 $('studentRows').innerHTML=list.map(s=>`<tr><td style="padding:12px 6px"><b>${esc(s.name||'Student')}</b><br><small>${esc(s.email)}</small></td><td>${esc(s.regNo||'—')}</td><td>${s.createdAt&&Date.parse(s.createdAt)?new Date(s.createdAt).toLocaleDateString():'—'}</td><td align="right">${s.subscriptionCredits.toLocaleString()}</td><td align="right">${s.testsCompleted}</td><td>${esc(s.subscriptionStatus)}</td></tr>`).join('')||'<tr><td colspan="6">No students found.</td></tr>';
}
async function loadQuestions(){const d=await api('questions');questions=d.questions||[];renderQuestions();}
async function loadStudents(){const d=await api('students');students=d.students||[];renderStudents();}
function reset(){ $('questionForm').reset();$('questionId').value='';$('active').checked=true;$('formTitle').textContent='Add a Question';$('saveQuestion').textContent='Save Question';}
function edit(id){const q=questions.find(x=>x.id===id);if(!q)return;$('questionId').value=q.id;$('subject').value=q.subject;$('topic').value=q.topic||'';$('question').value=q.question;(q.options||[]).forEach((v,i)=>$(`opt${i}`).value=v);$('answer').value=String(q.answer);$('explanation').value=q.explanation||'';$('active').checked=q.active!==false;$('formTitle').textContent='Edit Question';$('saveQuestion').textContent='Update Question';window.scrollTo({top:0,behavior:'smooth'});}
$('questionForm').addEventListener('submit',async e=>{e.preventDefault();const b=$('saveQuestion');b.disabled=true;try{const body={id:$('questionId').value||undefined,subject:$('subject').value,topic:$('topic').value,question:$('question').value,options:[0,1,2,3].map(i=>$(`opt${i}`).value),answer:Number($('answer').value),explanation:$('explanation').value,active:$('active').checked};await api('save-question',{method:'POST',body});note('Question saved successfully.','success');reset();await loadQuestions();}catch(e){note(e.message,'error')}finally{b.disabled=false;}});
$('questionList').addEventListener('click',async e=>{const editId=e.target.dataset.edit,deleteId=e.target.dataset.delete;if(editId)edit(editId);if(deleteId&&confirm('Permanently delete this question? This cannot be undone.')){try{await api('delete-question',{method:'DELETE',id:deleteId});note('Question deleted.','success');await loadQuestions();}catch(err){note(err.message,'error')}}});
$('resetForm').onclick=reset;$('refreshQuestions').onclick=()=>loadQuestions().catch(e=>note(e.message,'error'));$('refreshStudents').onclick=()=>loadStudents().catch(e=>note(e.message,'error'));$('questionSearch').oninput=renderQuestions;$('studentSearch').oninput=renderStudents;
$('logout').onclick=async()=>{await signOut(auth);location.replace('index.html')};
onAuthStateChanged(auth,async u=>{if(!u){location.replace('index.html');return}user=u;try{await Promise.all([loadQuestions(),loadStudents()]);note(`Signed in as ${u.email||'administrator'}.`,'success');}catch(e){note(e.message,'error');if(/administrator access/i.test(e.message)){$('questionForm').hidden=true;}}});
