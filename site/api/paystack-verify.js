const { requireUser } = require('./_lib/firebaseAdmin');
const { activateFromPayment } = require('./_lib/paymentAccess');

function send(res, status, body) {
  res.status(status)
    .setHeader('Content-Type', 'application/json')
    .send(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const token = await requireUser(req);
    const reference = String(req.body?.reference || '').trim();

    if (!reference) {
      return send(res, 400, { error: 'Payment reference is missing.' });
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      return send(res, 503, { error: 'Payment service is not configured yet.' });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secret}`
        }
      }
    );

    const payload = await response.json();
    const payment = payload?.data || {};

    // Temporary diagnostic response. This deliberately exposes only
    // non-secret transaction fields needed to identify the mismatch.
    if (!response.ok || !payload.status || payment.status !== 'success') {
      return send(res, 400, {
        error: 'Payment could not be verified.',
        diagnostic: {
          paystackHttpStatus: response.status,
          paystackStatus: Boolean(payload.status),
          transactionStatus: payment.status || null,
          reference: payment.reference || reference
        }
      });
    }

    const paidUid = payment.metadata?.uid;
    if (paidUid && paidUid !== token.uid) {
      return send(res, 403, { error: 'This payment belongs to another account.' });
    }

    if (
      payment.customer?.email &&
      payment.customer.email.toLowerCase() !== String(token.email || '').toLowerCase()
    ) {
      return send(res, 403, { error: 'This payment belongs to another account.' });
    }

    const amount = Number(payment.amount);
    const currency = String(payment.currency || '').trim().toUpperCase();

    // DIAGNOSTIC: tell us exactly what Paystack returned instead of hiding
    // the mismatch behind the generic "amount could not be confirmed" message.
    if (amount !== 100000 || currency !== 'NGN') {
      return send(res, 400, {
        error: 'The payment amount could not be confirmed.',
        diagnostic: {
          expectedAmountMinorUnits: 100000,
          receivedAmount: payment.amount ?? null,
          receivedAmountAsNumber: Number.isFinite(amount) ? amount : null,
          expectedCurrency: 'NGN',
          receivedCurrency: payment.currency ?? null,
          transactionStatus: payment.status || null,
          reference: payment.reference || reference,
          channel: payment.channel || null,
          paidAt: payment.paid_at || null
        }
      });
    }

    if (payment.metadata?.plan !== 'monthly') {
      return send(res, 400, {
        error: 'The payment plan could not be confirmed.',
        diagnostic: {
          receivedPlan: payment.metadata?.plan ?? null,
          expectedPlan: 'monthly',
          reference: payment.reference || reference
        }
      });
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
