const { requireUser } = require('./_lib/firebaseAdmin');
const { activateFromPayment } = require('./_lib/paymentAccess');

function send(res, status, body) {
  res.status(status)
    .setHeader('Content-Type', 'application/json')
    .send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  try {
    const token = await requireUser(req);
    const reference = String(req.body?.reference || '').trim();
    if (!reference) return send(res, 400, { error: 'Payment reference is missing.' });

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return send(res, 503, { error: 'Payment service is not configured yet.' });

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const payload = await response.json();

    if (!response.ok || !payload.status || payload.data?.status !== 'success') {
      return send(res, 400, { error: 'Payment could not be verified.' });
    }

    const payment = payload.data;
    const paidUid = String(payment.metadata?.uid || '').trim();

    if (paidUid && paidUid !== token.uid) {
      return send(res, 403, { error: 'This payment belongs to another account.' });
    }

    if (
      payment.customer?.email &&
      payment.customer.email.toLowerCase() !== String(token.email || '').toLowerCase()
    ) {
      return send(res, 403, { error: 'This payment belongs to another account.' });
    }

    if (payment.currency !== 'NGN') {
      return send(res, 400, {
        error: `Unsupported payment currency: ${payment.currency || 'unknown'}.`
      });
    }

    // Customer charges are disabled in Paystack. The customer must therefore
    // pay exactly the configured product amount. Never accept a higher gross
    // amount as a valid payment for this product.
    const expectedAmount = 100000; // ₦1,000 in kobo
    const chargedAmount = Number(payment.amount);
    const requestedAmount = Number(payment.requested_amount ?? payment.amount);

    if (
      !Number.isFinite(chargedAmount) ||
      chargedAmount !== expectedAmount ||
      (payment.requested_amount != null && requestedAmount !== expectedAmount)
    ) {
      return send(res, 400, {
        error: 'Payment amount could not be confirmed.',
        reference
      });
    }

    if (payment.metadata?.plan !== 'monthly') {
      return send(res, 400, { error: 'The payment plan could not be confirmed.' });
    }

    const result = await activateFromPayment(payment);

    return send(res, 200, {
      success: true,
      expiresAt: result.expiresAt,
      alreadyProcessed: result.alreadyProcessed
    });
  } catch (e) {
    return send(res, e.statusCode || 500, {
      error: e.message || 'Unable to verify payment.'
    });
  }
};
