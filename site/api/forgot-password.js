const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { emailId } = require('./_lib/registrationCrypto');
const { sendPasswordResetEmail } = require('./_lib/sendPasswordResetEmail');

const APP_URL = 'https://jambcbt.de-blaisetechnologies.com.ng';
const COOLDOWN_MS = 60 * 1000;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function genericSuccess(res) {
  return send(res, 200, {
    ok: true,
    message: 'If an account exists for that email, a password reset link has been sent. Check your inbox.'
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) return send(res, 400, { error: 'Please enter a valid email address.' });

  try {
    const admin = getAdmin();
    let user;

    try {
      user = await admin.auth().getUserByEmail(email);
    } catch (e) {
      if (e?.code === 'auth/user-not-found') return genericSuccess(res);
      throw e;
    }

    // Avoid repeatedly sending reset emails for the same address within a short window.
    const ref = db().collection('passwordResetRequests').doc(emailId(email));
    const snap = await ref.get();
    const previous = snap.exists ? Number(snap.data()?.sentAt || 0) : 0;
    if (previous && nowMs() - previous < COOLDOWN_MS) return genericSuccess(res);

    const resetUrl = await admin.auth().generatePasswordResetLink(email, {
      url: `${APP_URL}/index.html`,
      handleCodeInApp: false
    });

    await sendPasswordResetEmail({
      to: email,
      name: user.displayName || email.split('@')[0],
      resetUrl
    });

    await ref.set({
      email,
      sentAt: nowMs(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return genericSuccess(res);
  } catch (e) {
    console.error('forgot-password error', e);
    // Do not expose account existence or internal configuration details to the client.
    return send(res, 500, { error: 'We could not send the password reset email right now. Please try again later.' });
  }
};
