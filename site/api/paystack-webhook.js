const crypto = require('crypto');
const { activateFromPayment } = require('./_lib/paymentAccess');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

function timingSafeHexEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  try {
    const secret = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secret) return send(res, 503, { error: 'Payment service is not configured.' });

    const signature = String(req.headers['x-paystack-signature'] || '').trim();
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    if (!timingSafeHexEqual(signature, expected)) {
      return send(res, 401, { error: 'Invalid signature.' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (event.event !== 'charge.success') return send(res, 200, { received: true });

    const payment = event.data || {};
    if (
      String(payment.status || '').toLowerCase() !== 'success' ||
      String(payment.currency || '').toUpperCase() !== 'NGN' ||
      Number(payment.amount) !== 100000 ||
      String(payment.metadata?.plan || '').toLowerCase() !== 'monthly' ||
      !payment.metadata?.uid ||
      !payment.reference
    ) {
      return send(res, 200, { received: true });
    }

    await activateFromPayment(payment);
    return send(res, 200, { received: true, processed: true });
  } catch (e) {
    return send(res, 500, { error: 'Webhook processing failed.' });
  }
};
