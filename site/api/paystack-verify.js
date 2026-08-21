const { requireUser } = require('./_lib/firebaseAdmin');
const { activateFromPayment } = require('./_lib/paymentAccess');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function getReference(req) {
  const body = req.body || {};
  const query = req.query || {};
  return String(body.reference || body.trxref || query.reference || query.trxref || '').trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  try {
    const token = await requireUser(req);
    const reference = getReference(req);
    if (!reference) return send(res, 400, { error: 'Payment reference is missing.' });

    const secret = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secret) return send(res, 503, { error: 'Payment service is not configured yet.' });

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } }
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.status !== true || payload.data?.status !== 'success') {
      return send(res, 400, { error: payload.message || 'Payment could not be verified.' });
    }

    const payment = payload.data;
    const paidUid = String(payment.metadata?.uid || '').trim();
    const paidEmail = String(payment.customer?.email || '').trim().toLowerCase();
    const userEmail = String(token.email || '').trim().toLowerCase();

    if (!paidUid) return send(res, 400, { error: 'The verified payment is missing the account identifier.' });
    if (paidUid !== token.uid) return send(res, 403, { error: 'This payment belongs to another account.' });
    if (paidEmail && userEmail && paidEmail !== userEmail) {
      return send(res, 403, { error: 'This payment belongs to another account.' });
    }

    // Paystack amounts are in the smallest currency unit: ₦1,000 = 100000 kobo.
    if (Number(payment.amount) !== 100000 || String(payment.currency || '').toUpperCase() !== 'NGN') {
      return send(res, 400, { error: 'The payment amount could not be confirmed.' });
    }
    if (String(payment.metadata?.plan || '').toLowerCase() !== 'monthly') {
      return send(res, 400, { error: 'The payment plan could not be confirmed.' });
    }

    const result = await activateFromPayment(payment, { expectedUid: token.uid });
    return send(res, 200, {
      success: true,
      verified: true,
      reference,
      expiresAt: result.expiresAt,
      alreadyProcessed: result.alreadyProcessed
    });
  } catch (e) {
    return send(res, e.statusCode || 500, { error: e.message || 'Unable to verify payment.' });
  }
};
