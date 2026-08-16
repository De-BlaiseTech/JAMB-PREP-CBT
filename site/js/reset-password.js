const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.search).get('token')||'';
function msg(text,type='info'){
  const el=$('msg');
  el.textContent=text;
  el.className=`reset-msg ${type}`;
}
function busy(on){
  const b=$('resetBtn');
  b.disabled=on;
  b.textContent=on?'Resetting…':'Reset Password';
}
$('loginBtn').onclick=()=>location.href='index.html';

(async()=>{
  if(!token){
    msg('This password reset link is incomplete or invalid.','error');
    $('loginBtn').classList.remove('hidden');
    return;
  }
  try{
    const r=await fetch(`/api/password-reset-status?token=${encodeURIComponent(token)}`);
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.valid){
      msg(d.error||'This password reset link is no longer valid.','error');
      $('loginBtn').classList.remove('hidden');
      return;
    }
    $('formWrap').classList.remove('hidden');
    msg('Enter a new password for your account.','info');
  }catch(e){
    msg('We could not verify this link. Please try again.','error');
    $('loginBtn').classList.remove('hidden');
  }
})();

$('resetBtn').onclick=async()=>{
  const password=$('password').value;
  const confirm=$('confirm').value;
  if(password.length<6)return msg('Password must be at least 6 characters.','error');
  if(password!==confirm)return msg('The passwords do not match.','error');
  busy(true);
  msg('Updating your password…','info');
  try{
    const r=await fetch('/api/reset-password',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,password})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok){
      busy(false);
      return msg(d.error||'We could not reset your password. Please try again.','error');
    }
    $('formWrap').classList.add('hidden');
    busy(false);
    msg('Your password has been reset successfully. You can now continue to login.','success');
    $('loginBtn').classList.remove('hidden');
  }catch(e){
    busy(false);
    msg('We could not reset your password right now. Please try again.','error');
  }
};
