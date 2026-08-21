const { db, getAdmin, nowMs } = require('./firebaseAdmin');

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function timestampToMs(value) {
  if (value?.toMillis) return value.toMillis();
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function activateFromPayment(payment, options = {}) {
  const reference = String(payment.reference || '').trim();
  const uid = String(payment.metadata?.uid || '').trim();
  const expectedUid = String(options.expectedUid || '').trim();

  if (!reference || !uid) throw new Error('Payment information is incomplete.');
  if (expectedUid && uid !== expectedUid) throw new Error('Payment account does not match the signed-in account.');
  if (String(payment.status || '').toLowerCase() !== 'success') throw new Error('Payment is not successful.');
  if (String(payment.currency || '').toUpperCase() !== 'NGN') throw new Error('Payment currency is invalid.');
  if (Number(payment.amount) !== 100000) throw new Error('Payment amount is invalid.');
  if (String(payment.metadata?.plan || '').toLowerCase() !== 'monthly') throw new Error('Payment plan is invalid.');

  const admin = getAdmin();
  const paymentRef = db().collection('payments').doc(reference);
  const userRef = db().collection('users').doc(uid);

  return db().runTransaction(async tx => {
    const paymentSnap = await tx.get(paymentRef);

    if (paymentSnap.exists) {
      const oldPayment = paymentSnap.data() || {};
      const oldUid = String(oldPayment.uid || '').trim();
      if (oldUid && oldUid !== uid) throw new Error('This payment reference is already linked to another account.');
      return {
        success: true,
        alreadyProcessed: true,
        expiresAt: Number(oldPayment.expiresAt || 0)
      };
    }

    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    const oldExpiry = timestampToMs(user.subscriptionExpiresAt);
    const start = Math.max(nowMs(), user.subscriptionStatus === 'active' ? oldExpiry : 0);
    const expiry = start + MONTH_MS;

    tx.set(userRef, {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: admin.firestore.Timestamp.fromMillis(expiry),
      lastPaymentReference: reference,
      lastPaymentAmount: Number(payment.amount),
      lastPaymentAt: new Date().toISOString(),
      plan: 'monthly'
    }, { merge: true });

    tx.create(paymentRef, {
      reference,
      uid,
      amount: Number(payment.amount),
      currency: String(payment.currency || 'NGN').toUpperCase(),
      status: 'success',
      expiresAt: expiry,
      processedAt: new Date().toISOString()
    });

    return { success: true, alreadyProcessed: false, expiresAt: expiry };
  });
}

module.exports = { activateFromPayment };
