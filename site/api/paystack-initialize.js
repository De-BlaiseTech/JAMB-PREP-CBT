const { requireUser, db, nowMs } = require('./_lib/firebaseAdmin');

function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const token = await requireUser(req);
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw Object.assign(new Error('Payment service is not configured yet.'), { statusCode: 503 });

    const snap = await db().collection('users').doc(token.uid).get();
    const data = snap.exists ? snap.data() : {};
    const expiry = data.subscriptionExpiresAt?.toMillis ? data.subscriptionExpiresAt.toMillis() : Number(data.subscriptionExpiresAt || 0);
    if (data.subscriptionStatus === 'active' && expiry > nowMs()) {
      return send(res, 200, { alreadyActive: true, expiresAt: expiry });
    }

    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: token.email,
        amount: 100000,
        currency: 'NGN',
        callback_url: `${origin}/payment.html`,
        metadata: { uid: token.uid, email: token.email, plan: 'monthly', product: 'JAMB Prep CBT Monthly Access' }
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.status) throw new Error(payload.message || 'Unable to start payment.');
    send(res, 200, { authorizationUrl: payload.data.authorization_url, reference: payload.data.reference });
  } catch (e) {
    send(res, e.statusCode || 500, { error: e.message || 'Unable to start payment.' });
  }
};
