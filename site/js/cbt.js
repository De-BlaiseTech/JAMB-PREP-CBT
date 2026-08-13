const $=id=>document.getElementById(id);
const subjects=JSON.parse(localStorage.getItem('mockSubjects')||'[]');
const user=JSON.parse(localStorage.getItem('jambUser')||'{}');
$('student').textContent=user.name||'Practice Student';
let questions=[],answers={},flags={},index=0,expiresAt=0,examId='',submitting=false;
function setLoading(text){$('question').textContent=text;$('options').innerHTML='<div class="empty">Please wait while we prepare your secure test.</div>';$('counter').textContent='Preparing your test…';$('progress').style.width='0%';$('prev').disabled=true;$('next').disabled=true;$('flag').disabled=true;$('submit').disabled=true;$('submitTop').disabled=true}
function clearLoading(){$('next').disabled=false;$('flag').disabled=false;$('submit').disabled=false;$('submitTop').disabled=false}
function save(){localStorage.setItem('examSession',JSON.stringify({examId,questions,answers,flags,index,expiresAt,subjects,updatedAt:Date.now()}))}
function loadSession(){try{const s=JSON.parse(localStorage.getItem('examSession')||'null');if(s&&s.examId&&s.questions?.length&&JSON.stringify(s.subjects)===JSON.stringify(subjects)){examId=s.examId;questions=s.questions;answers=s.answers||{};flags=s.flags||{};index=Math.min(Number(s.index)||0,questions.length-1);expiresAt=Number(s.expiresAt)||0;return true}}catch{}return false}
function render(){
 if(!questions.length)return;const q=questions[index];
 $('subject').textContent=q.subject+(q.topic?' • '+q.topic:'');$('counter').textContent=`Question ${index+1} of ${questions.length}`;$('question').textContent=q.question;$('progress').style.width=((index+1)/questions.length*100)+'%';
 $('options').replaceChildren(...(q.options||[]).map((o,i)=>{const b=document.createElement('button');b.className='option-btn '+(answers[q.id]===i?'selected':'');b.dataset.i=i;const letter=document.createElement('span');letter.className='letter';letter.textContent=String.fromCharCode(65+i);const text=document.createElement('span');text.textContent=o;b.append(letter,text);b.onclick=()=>{answers[q.id]=+b.dataset.i;save();render()};return b}));
 $('prev').disabled=index===0;$('next').textContent=index===questions.length-1?'Finish →':'Next →';$('flag').textContent=flags[q.id]?'⚑ Unflag':'⚑ Flag';$('navsummary').textContent=`${Object.keys(answers).length}/${questions.length}`;
 $('subjects').replaceChildren(...subjects.map(s=>{const b=document.createElement('button');b.className=q.subject===s?'active':'';b.textContent=s;b.onclick=()=>{const i=questions.findIndex(x=>x.subject===s);if(i>=0){index=i;save();render()}};return b}));
 $('numbers').replaceChildren(...questions.map((x,i)=>{const b=document.createElement('button');b.className=`num-btn ${i===index?'current':''} ${answers[x.id]!==undefined?'answered':''} ${flags[x.id]?'flagged':''}`;b.textContent=i+1;b.onclick=()=>{index=i;save();render()};return b}));
}
function openSubmit(){const unanswered=questions.length-Object.keys(answers).length;$('confirmText').textContent=unanswered?`You have ${unanswered} unanswered question${unanswered===1?'':'s'}. You can still submit.`:'All questions have been answered. Submit and see your result now?';$('confirm').showModal()}
function updateClock(){const left=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));const m=Math.floor(left/60),s=left%60;$('timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;$('timer').classList.toggle('warn',left<=120);if(left<=0){clearInterval(window.examClock);submitExam(true)}}
function startClock(){clearInterval(window.examClock);updateClock();window.examClock=setInterval(updateClock,1000)}
async function submitExam(auto=false){
 if(submitting||!examId||!questions.length)return;submitting=true;clearInterval(window.examClock);$('confirmSubmit').disabled=true;$('submit').disabled=true;$('submitTop').disabled=true;
 try{
   const fb=await import('./firebase-bridge.js');
   const cleanAnswers={};Object.entries(answers).forEach(([id,v])=>{const n=Number(v);if(Number.isInteger(n)&&n>=0&&n<=3)cleanAnswers[id]=n});
   const response=await fb.submitExam(examId,cleanAnswers);const result=response.result;
   localStorage.setItem('lastResult',JSON.stringify(result));localStorage.removeItem('examSession');localStorage.removeItem('activeExamId');
   location.href='result.html?attempt='+encodeURIComponent(result.id);
 }catch(e){
   submitting=false;$('confirmSubmit').disabled=false;$('submit').disabled=false;$('submitTop').disabled=false;
   if(e?.code==='functions/deadline-exceeded'){localStorage.removeItem('examSession');localStorage.removeItem('activeExamId');alert('This test has expired and could not be submitted.');location.replace('dashboard.html');return}
   alert(e?.message||'The secure submission failed. Please check your connection and try again.');
   if(auto)startClock();
 }
}
$('prev').onclick=()=>{if(index){index--;save();render()}};
$('next').onclick=()=>{if(index<questions.length-1){index++;save();render()}else openSubmit()};
$('flag').onclick=()=>{const id=questions[index].id;flags[id]=!flags[id];save();render()};
$('submit').onclick=$('submitTop').onclick=openSubmit;$('cancel').onclick=()=>$('confirm').close();$('confirmSubmit').onclick=()=>{$('confirm').close();submitExam()};

(async()=>{
 setLoading('Loading your secure exam…');
 if(!subjects.length){location.replace('setup.html');return}
 if(!loadSession()){location.replace('setup.html');return}
 if(expiresAt && Date.now()>expiresAt){localStorage.removeItem('examSession');localStorage.removeItem('activeExamId');location.replace('setup.html');return}
 try{const fb=await import('./firebase-bridge.js');const u=await fb.currentUser();if(!u){location.replace('index.html');return}}catch{location.replace('index.html');return}
 clearLoading();save();render();startClock();
})();
