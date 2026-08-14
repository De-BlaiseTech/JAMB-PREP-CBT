const title=document.getElementById('title');
const message=document.getElementById('message');
const actions=document.getElementById('actions');

function button(text,href){
  const a=document.createElement('a');a.className='btn primary';a.href=href;a.textContent=text;return a;
}

(async()=>{
  const reference=new URLSearchParams(location.search).get('reference');
  if(!reference){
    title.textContent='Payment reference not found';
    message.textContent='We could not find the payment reference. If you completed payment, please contact support before paying again.';
    actions.append(button('Back to Dashboard','dashboard.html'));
    return;
  }
  try{
    const access=await import('./access.js');
    const result=await access.verifyPayment(reference);
    title.textContent='Payment successful! 🎉';
    message.textContent=`Your 30-day premium access is active until ${new Date(result.expiresAt).toLocaleDateString()}.`;
    actions.append(button('Start Your Mock','setup.html'));
  }catch(e){
    title.textContent='Payment could not be confirmed';
    message.textContent=e?.message||'Please check your payment status and try again.';
    actions.append(button('Back to Dashboard','dashboard.html'));
  }
})();
