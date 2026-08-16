const { db, getAdmin, nowMs } = require('./_lib/firebaseAdmin');
const { tokenHash } = require('./_lib/registrationCrypto');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  if (!token) return send(res, 400, { error: 'This password reset link is invalid.' });
  if (password.length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' });
  if (password.length > 128) return send(res, 400, { error: 'Please choose a shorter password.' });

  const ref = db().collection('passwordResetTokens').doc(tokenHash(token));
  try {
    const snap = await ref.get();
    if (!snap.exists) return send(res, 400, { error: 'This password reset link is invalid or has already been used.' });
    const data = snap.data() || {};
    if (data.used) return send(res, 400, { error: 'This password reset link has already been used.' });
    if (Number(data.expiresAt || 0) <= nowMs()) {
      await ref.delete().catch(() => {});
      return send(res, 410, { error: 'This password reset link has expired. Please request a new one.' });
    }

    const admin = getAdmin();
    await admin.auth().updateUser(String(data.uid), { password });
    await ref.delete();

    const emailRef = db().collection('passwordResetRequests').doc(require('crypto').createHash('sha256').update(String(data.email)).digest('hex'));
    await emailRef.delete().catch(() => {});

    return send(res, 200, { ok: true, message: 'Your password has been reset successfully. You can now continue to login.' });
  } catch (e) {
    console.error('reset-password error', e);
    return send(res, 500, { error: 'We could not reset your password right now. Please try again later.' });
  }
};
