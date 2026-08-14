const crypto = require('crypto');
const { } = require('./_lib/firebaseAdmin');
const { activateFromPayment } = require('./_lib/paymentAccess');

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });

  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return send(res, 503, { error: 'Payment service is not configured.' });

    const signature = String(req.headers['x-paystack-signature'] || '');
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return send(res, 401, { error: 'Invalid signature.' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (event.event !== 'charge.success') return send(res, 200, { received: true });

    const payment = event.data || {};
    if (payment.currency !== 'NGN' || Number(payment.amount) !== 100000 || payment.status !== 'success') {
      return send(res, 200, { received: true });
    }
    if (payment.metadata?.plan !== 'monthly' || !payment.metadata?.uid || !payment.reference) {
      return send(res, 200, { received: true });
    }

    await activateFromPayment(payment);
    send(res, 200, { received: true });
  } catch (e) {
    send(res, 500, { error: 'Webhook processing failed.' });
  }
};
