export async function idToken() {
  const { auth } = await import('./firebase.js');
  const user = auth.currentUser || await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged ? auth.onAuthStateChanged(u => { unsub(); resolve(u); }) : null;
    if (!unsub) resolve(null);
  });
  if (!user) throw new Error('Please sign in to continue.');
  return user.getIdToken();
}

async function callApi(path, options = {}) {
  const token = await idToken();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Unable to complete the request.'), { status: res.status, data });
  return data;
}

export const getMockAccess = () => callApi('/api/mock-access');
export const initializePayment = planId => callApi('/api/paystack-initialize', { method: 'POST', body: JSON.stringify({ planId }) });
export const verifyPayment = reference => callApi('/api/paystack-verify', { method: 'POST', body: JSON.stringify({ reference }) });
export const startMock = examId => callApi('/api/start-mock', {
  method: 'POST', body: JSON.stringify({ examId })
});
export const submitMock = (examId, result) => callApi('/api/submit-mock', {
  method: 'POST', body: JSON.stringify({ examId, result })
});
