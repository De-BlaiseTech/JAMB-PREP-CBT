const { requireUser } = require('../_lib/firebaseAdmin');
const { activateFromPayment } = require('../_lib/paymentAccess');
const { PLANS } = require('../_lib/subscriptionPlans');

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

    const plan = PLANS[String(payment.metadata?.planId || '')];
    const chargedAmount = Number(payment.amount);
    const requestedAmount = Number(payment.requested_amount ?? payment.amount);
    if (!plan || chargedAmount !== plan.amount || (payment.requested_amount != null && requestedAmount !== plan.amount)) {
      return send(res, 400, { error: 'Payment amount could not be confirmed.', reference });
    }
    if (payment.metadata?.plan !== 'credit_subscription') {
      return send(res, 400, { error: 'The subscription package could not be confirmed.' });
    }

    const result = await activateFromPayment(payment);

    return send(res, 200, {
      success: true,
      creditsAdded: result.credits,
      alreadyProcessed: result.alreadyProcessed
    });
  } catch (e) {
    return send(res, e.statusCode || 500, {
      error: e.message || 'Unable to verify payment.'
    });
  }
};
