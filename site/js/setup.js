const ids=['s1','s2','s3','s4'];
const $=id=>document.getElementById(id);

const paywall=$('paywall');
const setupCard=$('setupCard');
const payButton=$('payButton');
const accessMsg=$('accessMsg');
const expiryText=$('expiryText');

function showPaywall(message='Your free mock has already been used.'){
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
      if(state.subscriptionActive && state.expiresAt && expiryText){
        expiryText.textContent=`Premium access active until ${new Date(state.expiresAt).toLocaleDateString()}.`;
      }
    }else{
      showPaywall('Your free mock has been used. Pay ₦1,000 for 30 days of unlimited mock exams.');
    }
  }catch(e){
    showPaywall('We could not check your access. Please refresh and try again.');
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
    const permission=await access.reserveMockAccess();
    if(!permission.allowed){showPaywall('Your free mock has already been used. Please pay ₦1,000 to continue.');return}

    msg.textContent='Selecting your questions…';
    const exam=await fb.startExam(subjects);
    localStorage.setItem('mockSubjects',JSON.stringify(subjects));
    localStorage.removeItem('lastResult');
    localStorage.removeItem('examSession');
    localStorage.setItem('activeExamId',exam.examId);
    localStorage.setItem('examSession',JSON.stringify({version:3,examId:exam.examId,expiresAt:exam.expiresAt,questions:exam.questions,answers:{},flags:{},index:0,subjects,updatedAt:Date.now()}));
    location.href='cbt.html?exam='+encodeURIComponent(exam.examId);
  }catch(e){
    button.disabled=false;button.textContent='Start Practice Test';
    if(e?.status===402){showPaywall('Your free mock has already been used. Please pay ₦1,000 to continue.');return}
    msg.textContent=e?.message||'Unable to prepare the test. Please try again.';msg.className='status-msg error';
  }
};

if(payButton){
  payButton.onclick=async()=>{
    payButton.disabled=true;
    payButton.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Opening secure payment…</span>';
    try{
      const access=await import('./access.js');
      const data=await access.initializePayment();
      if(data.alreadyActive){location.reload();return}
      window.location.href=data.authorizationUrl;
    }catch(e){
      payButton.disabled=false;payButton.textContent='Pay ₦1,000 for 30 Days';
      if(accessMsg) accessMsg.textContent=e?.message||'Unable to start payment. Please try again.';
    }
  };
}

checkAccess();
