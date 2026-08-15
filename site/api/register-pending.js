const crypto = require('crypto');
const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { encrypt, emailId, tokenHash } = require('./_lib/registrationCrypto');
const { sendVerificationEmail } = require('./_lib/sendVerificationEmail');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  try {
    const name = String(req.body?.name || '').trim();
    const regNo = String(req.body?.regno || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password) return send(res, 400, { error: 'Please fill in all required fields.' });
    if (name.length > 120) return send(res, 400, { error: 'Please enter a shorter name.' });
    if (!validEmail(email)) return send(res, 400, { error: 'Please enter a valid email address.' });
    if (password.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' });
    if (password.length > 128) return send(res, 400, { error: 'Please choose a shorter password.' });

    const admin = getAdmin();
    try {
      await admin.auth().getUserByEmail(email);
      return send(res, 409, { error: 'An account already exists with this email address. Please sign in.' });
    } catch (e) {
      if (e?.code !== 'auth/user-not-found') throw e;
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const id = emailId(email);
    const expiresAt = nowMs() + 24 * 60 * 60 * 1000;
    const ref = db().collection('pendingRegistrations').doc(id);

    await ref.set({
      email,
      emailLower: email,
      name,
      regNo,
      passwordCiphertext: encrypt(password),
      tokenHash: tokenHash(token),
      expiresAt,
      createdAt: new Date().toISOString()
    });

    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const verificationUrl = `${origin}/api/verify-registration?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    await sendVerificationEmail({ to: email, name, verificationUrl });

    return send(res, 200, { ok: true, message: 'Verification email sent. Check your email and click the verification link to complete your registration.' });
  } catch (e) {
    console.error('register-pending error', e);
    return send(res, e.statusCode || 500, { error: e.message || 'Unable to start registration. Please try again.' });
  }
};
