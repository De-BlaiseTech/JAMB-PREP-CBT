const { db, getAdmin, nowMs } = require('./firebaseAdmin');

async function activateFromPayment(payment) {
  const reference = String(payment.reference || '').trim();
  const uid = String(payment.metadata?.uid || '').trim();

  if (!reference || !uid) throw new Error('Payment information is incomplete.');

  const admin = getAdmin();
  const paymentRef = db().collection('payments').doc(reference);
  const userRef = db().collection('users').doc(uid);

  return db().runTransaction(async tx => {
    const paymentSnap = await tx.get(paymentRef);

    if (paymentSnap.exists) {
      const oldPayment = paymentSnap.data() || {};
      return {
        success: true,
        alreadyProcessed: true,
        expiresAt: Number(oldPayment.expiresAt || 0)
      };
    }

    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};

    const oldExpiry = user.subscriptionExpiresAt?.toMillis
      ? user.subscriptionExpiresAt.toMillis()
      : Number(user.subscriptionExpiresAt || 0);

    const start = Math.max(
      nowMs(),
      user.subscriptionStatus === 'active' ? oldExpiry : 0
    );
    const expiry = start + 30 * 24 * 60 * 60 * 1000;

    const requestedAmount = Number(payment.requested_amount ?? payment.amount);
    const chargedAmount = Number(payment.amount);

    tx.set(userRef, {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: admin.firestore.Timestamp.fromMillis(expiry),
      lastPaymentReference: reference,
      lastPaymentAmount: requestedAmount,
      lastPaymentChargedAmount: chargedAmount,
      lastPaymentAt: new Date().toISOString(),
      plan: 'monthly'
    }, { merge: true });

    tx.set(paymentRef, {
      reference,
      uid,
      requestedAmount,
      chargedAmount,
      currency: payment.currency || 'NGN',
      status: 'success',
      expiresAt: expiry,
      processedAt: new Date().toISOString()
    });

    return {
      success: true,
      alreadyProcessed: false,
      expiresAt: expiry
    };
  });
}

module.exports = { activateFromPayment };
