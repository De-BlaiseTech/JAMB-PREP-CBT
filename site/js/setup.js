const ids=['s1','s2','s3','s4'];
const $=id=>document.getElementById(id);

const paywall=$('paywall');
const setupCard=$('setupCard');
const payButton=$('payButton');
const accessMsg=$('accessMsg');
const expiryText=$('expiryText');
let selectedPlan='basic';

function showPaywall(message='Your practice credits are exhausted.'){
  if(setupCard) setupCard.hidden=true;
  if(paywall) paywall.hidden=false;
  if(accessMsg) accessMsg.textContent=message;
}

function hidePaywall(){
  if(setupCard) setupCard.hidden=false;
  if(paywall) paywall.hidden=true;
}

async function checkAccess(){
  try{
    const fb=await import('./firebase-bridge.js');
    const user=await fb.currentUser();
    if(!user){location.replace('index.html');return}
    const access=await import('./access.js');
    const state=await access.getMockAccess();
    if(state.allowed){
      hidePaywall();
      if(expiryText) expiryText.textContent=state.freePracticeAvailable ? 'Your one-time free mock is available. After that, each new mock costs 100 credits at the moment you start it.' : `Available balance: ${state.credits.toLocaleString()} credits. 100 credits are deducted when you start each mock.`;
      const note=$('practiceAccessNote'); if(note) note.textContent=state.freePracticeAvailable ? 'Your first mock is FREE — no credits will be deducted.' : 'Each mock costs 100 credits, deducted immediately when you start.';
    }else{
      showPaywall(`Your one-time free practice has been used and your balance is ${state.credits || 0} credits. You need 100 credits to start another mock. Choose a package to continue.`);
    }
  }catch(e){
    showPaywall('We could not check your credit balance. Please refresh and try again.');
  }
}

$('start').onclick=async()=>{
  const button=$('start');
  const subjects=ids.map(id=>$(id).value);
  const msg=$('msg');
  if(new Set(subjects).size!==4){msg.textContent='Please choose four different subjects.';msg.className='status-msg error';return}
  button.disabled=true;
  button.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Preparing secure test…</span>';
  msg.textContent='Checking your practice access…';msg.className='status-msg info';
  try{
    const fb=await import('./firebase-bridge.js');
    const user=await fb.currentUser();
    if(!user){location.replace('index.html');return}

    const access=await import('./access.js');
    const permission=await access.getMockAccess();
    if(!permission.allowed){showPaywall(`Your free practice has been used. You need 100 credits to start another mock. Your balance is ${permission.credits || 0} credits. Choose a package to continue.`);return}

    msg.textContent='Selecting your questions…';
    const exam=await fb.startExam(subjects);
    // Charge/consume the practice entitlement only after all questions are ready,
    // immediately before the student enters the mock. The API is idempotent.
    const started=await access.startMock(exam.examId);
    localStorage.setItem('mockSubjects',JSON.stringify(subjects));
    localStorage.removeItem('lastResult');
    localStorage.removeItem('examSession');
    localStorage.setItem('activeExamId',exam.examId);
    localStorage.setItem('activeMockAccess',JSON.stringify({practiceType:started.practiceType,creditsDeducted:started.creditsDeducted,credits:started.credits}));
    localStorage.setItem('examSession',JSON.stringify({version:3,examId:exam.examId,expiresAt:exam.expiresAt,questions:exam.questions,answers:{},flags:{},index:0,subjects,updatedAt:Date.now()}));
    location.href='cbt.html?exam='+encodeURIComponent(exam.examId);
  }catch(e){
    button.disabled=false;button.textContent='Start Practice Test';
    if(e?.status===402){showPaywall(e.message);return}
    msg.textContent=e?.message||'Unable to prepare the test. Please try again.';msg.className='status-msg error';
  }
};

document.querySelectorAll('input[name=plan]').forEach(r=>r.addEventListener('change',()=>{selectedPlan=r.value;}));
if(payButton){
  payButton.onclick=async()=>{
    payButton.disabled=true;
    payButton.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Opening secure payment…</span>';
    try{
      const access=await import('./access.js');
      const data=await access.initializePayment(selectedPlan);
      if(data.alreadyActive){location.reload();return}
      window.location.href=data.authorizationUrl;
    }catch(e){
      payButton.disabled=false;payButton.textContent='Subscribe for Credits';
      if(accessMsg) accessMsg.textContent=e?.message||'Unable to start payment. Please try again.';
    }
  };
}

checkAccess();
