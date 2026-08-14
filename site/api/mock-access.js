const { requireUser, db, nowMs } = require('./_lib/firebaseAdmin');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST' && req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const token = await requireUser(req);
    const ref = db().collection('users').doc(token.uid);

    if (req.method === 'GET') {
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      const expiry = data.subscriptionExpiresAt?.toMillis ? data.subscriptionExpiresAt.toMillis() : Number(data.subscriptionExpiresAt || 0);
      const active = data.subscriptionStatus === 'active' && expiry > nowMs();
      send(res, 200, { allowed: !data.freeMockUsed || active, freeMockAvailable: !data.freeMockUsed, subscriptionActive: active, expiresAt: active ? expiry : null });
      return;
    }

    const result = await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      const expiry = data.subscriptionExpiresAt?.toMillis ? data.subscriptionExpiresAt.toMillis() : Number(data.subscriptionExpiresAt || 0);
      const active = data.subscriptionStatus === 'active' && expiry > nowMs();

      if (active) return { allowed: true, type: 'subscription', expiresAt: expiry };
      if (data.freeMockUsed) return { allowed: false, type: 'payment_required' };

      tx.set(ref, { freeMockUsed: true, freeMockStartedAt: new Date().toISOString() }, { merge: true });
      return { allowed: true, type: 'free' };
    });

    if (!result.allowed) return send(res, 402, result);
    send(res, 200, result);
  } catch (e) {
    send(res, e.statusCode || 500, { error: e.message || 'Unable to check access.' });
  }
};
