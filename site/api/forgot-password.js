const crypto = require('crypto');
const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { tokenHash } = require('./_lib/registrationCrypto');
const { sendPasswordResetEmail } = require('./_lib/sendPasswordResetEmail');

const APP_URL = 'https://jambcbt.de-blaisetechnologies.com.ng';
const COOLDOWN_MS = 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function genericSuccess(res) {
  return send(res, 200, { ok: true, message: 'If an account exists for that email, a password reset link has been sent. Check your inbox.' });
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

    // Invalidate any previous reset request for this email before issuing a new one.
    const emailRef = db().collection('passwordResetRequests').doc(crypto.createHash('sha256').update(email).digest('hex'));
    const existing = await emailRef.get();
    const previousSentAt = existing.exists ? Number(existing.data()?.sentAt || 0) : 0;
    if (previousSentAt && nowMs() - previousSentAt < COOLDOWN_MS) return genericSuccess(res);
    if (existing.exists && existing.data()?.tokenHash) {
      await db().collection('passwordResetTokens').doc(String(existing.data().tokenHash)).delete().catch(() => {});
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHashValue = tokenHash(token);
    const expiresAt = nowMs() + RESET_TTL_MS;

    await emailRef.set({
      email,
      uid: user.uid,
      tokenHash: tokenHashValue,
      expiresAt,
      sentAt: nowMs(),
      createdAt: new Date().toISOString(),
      used: false
    });

    const tokenRef = db().collection('passwordResetTokens').doc(tokenHashValue);
    await tokenRef.set({
      email,
      uid: user.uid,
      expiresAt,
      createdAt: new Date().toISOString(),
      used: false
    });

    const resetUrl = `${APP_URL}/reset-password.html?token=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail({
        to: email,
        name: user.displayName || email.split('@')[0],
        resetUrl
      });
    } catch (mailError) {
      // Do not leave a live token behind when the email could not be sent.
      await emailRef.delete().catch(() => {});
      await tokenRef.delete().catch(() => {});
      throw mailError;
    }

    return genericSuccess(res);
  } catch (e) {
    console.error('forgot-password error', e);
    return send(res, 500, { error: 'We could not send the password reset email right now. Please try again later.' });
  }
};
