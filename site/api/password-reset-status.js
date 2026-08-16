const { db, nowMs } = require('./_lib/firebaseAdmin');
const { tokenHash } = require('./_lib/registrationCrypto');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  const token = String(req.query?.token || '').trim();
  if (!token) return send(res, 400, { valid: false, error: 'This password reset link is incomplete.' });

  try {
    const snap = await db().collection('passwordResetTokens').doc(tokenHash(token)).get();
    if (!snap.exists) return send(res, 404, { valid: false, error: 'This password reset link is invalid or has already been used.' });
    const data = snap.data() || {};
    if (data.used) return send(res, 410, { valid: false, error: 'This password reset link has already been used.' });
    if (Number(data.expiresAt || 0) <= nowMs()) return send(res, 410, { valid: false, error: 'This password reset link has expired. Please request a new one.' });
    return send(res, 200, { valid: true });
  } catch (e) {
    console.error('password-reset-status error', e);
    return send(res, 500, { valid: false, error: 'We could not verify this reset link right now.' });
  }
};
