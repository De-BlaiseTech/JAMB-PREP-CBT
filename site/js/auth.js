const $=id=>document.getElementById(id);
const msgEl=$('msg');
function msg(text='',type=''){msgEl.textContent=text;msgEl.className=`status-msg${type?` ${type}`:''}`}
const friendlyError=e=>{
  const c=e?.code||'';
  const map={
    'auth/invalid-email':'Please enter a valid email address.',
    'auth/user-not-found':'No account was found with that email address.',
    'auth/wrong-password':'The email or password is incorrect.',
    'auth/invalid-credential':'The email or password is incorrect.',
    'auth/too-many-requests':'Too many attempts. Please wait a little and try again.',
    'auth/email-already-in-use':'An account already exists with this email address.',
    'auth/weak-password':'Choose a stronger password with at least 6 characters.',
    'auth/network-request-failed':'Please check your internet connection and try again.',
    'auth/operation-not-allowed':'Online sign-in is currently unavailable.',
    'auth/user-disabled':'This account is currently unavailable.'
  };
  return map[c]||'Something went wrong. Please try again.';
};
function setBusy(button,busy,label){
  if(busy){
    button.disabled=true;
    button.dataset.originalText=button.textContent.trim();
    button.innerHTML=`<span class="spinner" aria-hidden="true"></span><span>${label}</span>`;
    button.setAttribute('aria-busy','true');
  }else{
    button.disabled=false;
    button.innerHTML=button.dataset.originalText||'Sign In';
    button.removeAttribute('aria-busy');
  }
}
async function firebaseAuth(){try{return await import('./firebase-bridge.js')}catch(e){return null}}

$('login').onclick=async()=>{
  const button=$('login');
  const email=$('email').value.trim(),password=$('password').value;
  msg('');
  if(!email||!password)return msg('Enter your email and password.','error');
  setBusy(button,true,'Signing in…');
  const fb=await firebaseAuth();
  if(!fb){setBusy(button,false);return msg('Online sign-in is unavailable here. Please check your connection.','error')}
  try{
    const user=await fb.signIn(email,password);
        localStorage.setItem('jambUser',JSON.stringify({email:user.email,name:user.displayName||email.split('@')[0],uid:user.uid}));
    location.href='dashboard.html';
  }catch(e){setBusy(button,false);msg(friendlyError(e),'error')}
};

$('register').onclick=()=>location.href='register.html';
$('forgot').onclick=async()=>{
  const button=$('forgot');
  const email=$('email').value.trim();
  msg('');
  if(!email)return msg('Enter your registered email address first.','error');
  setBusy(button,true,'Sending link…');
  const fb=await firebaseAuth();
  if(!fb){setBusy(button,false);return msg('Password reset is unavailable here. Please check your connection.','error')}
  try{
    await fb.sendReset(email);
    setBusy(button,false);
    msg('If an account exists for that email, a password reset link has been sent. Check your inbox.','info');
  }catch(e){setBusy(button,false);msg(friendlyError(e),'error')}
};
