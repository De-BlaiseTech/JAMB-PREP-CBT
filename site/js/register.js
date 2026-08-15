const createBtn = document.getElementById('create');
const backBtn = document.getElementById('backToLogin');
const resendBtn = document.getElementById('resendVerification');
const msg = document.getElementById('msg');
const setMessage = text => { msg.style.color = '#c62828'; msg.textContent = text; };

backBtn.onclick = () => { window.location.href = 'index.html'; };

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

createBtn.onclick = async () => {
  msg.textContent = '';
  const name = document.getElementById('name').value.trim();
  const regno = document.getElementById('regno').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!name || !email || !password) return setMessage('Please fill in all required fields.');
  if (password.length < 6) return setMessage('Password must be at least 6 characters.');

  try {
    createBtn.disabled = true;
    createBtn.textContent = 'Sending Verification Link…';
    const data = await postJson('/api/register-pending', { name, regno, email, password });
    setMessage(data.message || 'Verification email sent. Check your email and click the verification link to complete your registration.');
    document.getElementById('email').focus();
  } catch (e) {
    setMessage(e.message || 'Something went wrong. Please try again.');
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Register Account';
  }
};

resendBtn.onclick = async () => {
  msg.textContent = '';
  const email = document.getElementById('email').value.trim();
  if (!email) return setMessage('Enter your email address first.');
  try {
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending…';
    const data = await postJson('/api/resend-registration', { email });
    setMessage(data.message || 'A new verification link has been sent. Check your email.');
  } catch (e) {
    setMessage(e.message || 'Unable to resend the verification email.');
  } finally {
    resendBtn.disabled = false;
    resendBtn.textContent = 'Resend Verification Link';
  }
};
