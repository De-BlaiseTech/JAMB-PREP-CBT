const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { decrypt, emailId, tokenHash } = require('./_lib/registrationCrypto');

function html(res, status, title, message, buttonText = 'Continue to Login') {
  const safe = s => String(s).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(title)}</title><style>body{font-family:Arial,sans-serif;background:#f4f7f4;margin:0;min-height:100vh;display:grid;place-items:center}.card{background:#fff;max-width:520px;margin:20px;padding:28px;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center}.msg{color:#c62828;font-weight:700;line-height:1.6}a{display:inline-block;margin-top:18px;padding:12px 20px;background:#2e682b;color:#fff;text-decoration:none;border-radius:7px}</style></head><body><main class="card"><h1>${safe(title)}</h1><p class="msg">${safe(message)}</p><a href="/index.html">${safe(buttonText)}</a></main></body></html>`);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return html(res, 405, 'Invalid request', 'This verification link is not valid.');
  const token = String(req.query?.token || '').trim();
  const email = String(req.query?.email || '').trim().toLowerCase();
  if (!token || !email) return html(res, 400, 'Invalid verification link', 'The verification link is incomplete or invalid.');

  try {
    const ref = db().collection('pendingRegistrations').doc(emailId(email));
    const snap = await ref.get();
    if (!snap.exists) return html(res, 404, 'Verification unavailable', 'This registration was not found. It may already have been completed or cancelled.');

    const data = snap.data() || {};
    if (Number(data.expiresAt || 0) <= nowMs()) {
      await ref.delete();
      return html(res, 410, 'Link expired', 'Your verification link has expired. Please register again to receive a new link.');
    }
    if (data.tokenHash !== tokenHash(token)) return html(res, 400, 'Invalid verification link', 'This verification link is no longer valid. Please request a new one.');

    const admin = getAdmin();
    let existing;
    try { existing = await admin.auth().getUserByEmail(email); } catch (e) { if (e?.code !== 'auth/user-not-found') throw e; }
    if (existing) {
      await ref.delete();
      return html(res, 409, 'Account already exists', 'An account already exists with this email address. Please continue to login.');
    }

    const password = decrypt(data.passwordCiphertext);
    const user = await admin.auth().createUser({ email, password, displayName: data.name, emailVerified: true });
    await db().collection('users').doc(user.uid).set({
      name: data.name,
      regNo: data.regNo || '',
      email,
      role: 'student',
      createdAt: new Date().toISOString(),
      emailVerified: true
    }, { merge: false });
    await ref.delete();

    return html(res, 200, 'Account verified successfully', 'Your email has been verified and your account has now been created. You can continue to login.', 'Continue to Login');
  } catch (e) {
    console.error('verify-registration error', e);
    return html(res, 500, 'Verification could not be completed', 'We could not complete your registration right now. Please try again with a new verification link.');
  }
};
