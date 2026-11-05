const { db } = require('./firebaseAdmin');
const { PLANS } = require('./subscriptionPlans');

async function activateFromPayment(payment) {
  const reference = String(payment.reference || '').trim();
  const uid = String(payment.metadata?.uid || '').trim();
  const plan = PLANS[String(payment.metadata?.planId || '')];
  if (!reference || !uid || !plan) throw new Error('Payment information is incomplete.');
  if (Number(payment.amount) !== plan.amount || String(payment.currency || '').toUpperCase() !== 'NGN') {
    throw new Error('Payment amount could not be confirmed.');
  }
  const admin = require('firebase-admin');
  const paymentRef = db().collection('payments').doc(reference);
  const userRef = db().collection('users').doc(uid);
  return db().runTransaction(async tx => {
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists) {
      const old = paymentSnap.data() || {};
      return { success: true, alreadyProcessed: true, credits: Number(old.creditsAdded || 0) };
    }
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    const current = Math.max(0, Number(user.subscriptionCredits || 0));
    const balance = current + plan.credits;
    tx.set(userRef, {
      subscriptionStatus: 'active', subscriptionCredits: balance,
      totalCreditsPurchased: Math.max(0, Number(user.totalCreditsPurchased || 0)) + plan.credits,
      lastPaymentReference: reference, lastPaymentAmount: plan.price,
      lastPaymentAt: new Date().toISOString(), plan: plan.id,
      subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(paymentRef, { reference, uid, planId: plan.id, requestedAmount: plan.price,
      chargedAmount: Number(payment.amount) / 100, creditsAdded: plan.credits,
      currency: 'NGN', status: 'success', processedAt: new Date().toISOString() });
    tx.set(userRef.collection('creditTransactions').doc(reference), {
      type: 'purchase', credits: plan.credits, balanceAfter: balance,
      amount: plan.price, reference, planId: plan.id, createdAt: new Date().toISOString()
    });
    return { success: true, alreadyProcessed: false, credits: plan.credits, balance };
  });
}
module.exports = { activateFromPayment };
