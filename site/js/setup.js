const ids=['s1','s2','s3','s4'];
const $=id=>document.getElementById(id);

$('start').onclick=async()=>{
  const button=$('start');
  const subjects=ids.map(id=>$(id).value);
  const msg=$('msg');
  if(new Set(subjects).size!==4){msg.textContent='Please choose four different subjects.';msg.className='status-msg error';return}
  button.disabled=true;
  button.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Preparing secure test…</span>';
  msg.textContent='Connecting securely and selecting your questions…';msg.className='status-msg info';
  try{
    const fb=await import('./firebase-bridge.js');
    const user=await fb.currentUser();
    if(!user){location.replace('index.html');return}
    const exam=await fb.startExam(subjects);
    localStorage.setItem('mockSubjects',JSON.stringify(subjects));
    localStorage.removeItem('lastResult');
    localStorage.removeItem('examSession');
    localStorage.setItem('activeExamId',exam.examId);
    localStorage.setItem('examSession',JSON.stringify({examId:exam.examId,expiresAt:exam.expiresAt,questions:exam.questions,answers:{},flags:{},index:0,subjects,updatedAt:Date.now()}));
    location.href='cbt.html?exam='+encodeURIComponent(exam.examId);
  }catch(e){
    button.disabled=false;button.textContent='Start Practice Test';
    msg.textContent=e?.message||'Unable to prepare the secure test. Please try again.';msg.className='status-msg error';
  }
};
