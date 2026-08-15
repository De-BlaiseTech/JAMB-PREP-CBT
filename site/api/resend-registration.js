const crypto = require('crypto');
const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { emailId, tokenHash } = require('./_lib/registrationCrypto');
const { sendVerificationEmail } = require('./_lib/sendVerificationEmail');

function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return send(res, 400, { error: 'Enter your email address.' });

    const admin = getAdmin();
    try {
      await admin.auth().getUserByEmail(email);
      return send(res, 409, { error: 'An account already exists with this email address. Please use the sign-in or password-reset option.' });
    } catch (e) {
      if (e?.code !== 'auth/user-not-found') throw e;
    }

    const ref = db().collection('pendingRegistrations').doc(emailId(email));
    const snap = await ref.get();
    if (!snap.exists) return send(res, 404, { error: 'No pending registration was found for this email address.' });

    const data = snap.data() || {};
    if (Number(data.expiresAt || 0) <= nowMs()) {
      await ref.delete();
      return send(res, 410, { error: 'Your verification link has expired. Please register again.' });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    await ref.set({ tokenHash: tokenHash(token), resentAt: new Date().toISOString() }, { merge: true });
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const verificationUrl = `${origin}/api/verify-registration?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    await sendVerificationEmail({ to: email, name: data.name, verificationUrl });
    return send(res, 200, { ok: true, message: 'A new verification link has been sent. Check your email.' });
  } catch (e) {
    console.error('resend-registration error', e);
    return send(res, e.statusCode || 500, { error: e.message || 'Unable to resend the verification email.' });
  }
};
