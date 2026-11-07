const { requireUser, db } = require('../_lib/firebaseAdmin');
function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }
const MOCK_CREDITS = 100;
const FREE_TRIAL_CUTOFF = Date.parse('2026-11-05T09:06:00.000Z');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const token = await requireUser(req);
    const examId = String(req.body?.examId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,120}$/.test(examId)) return send(res, 400, { error: 'A valid mock session is required.' });
    const userRef = db().collection('users').doc(token.uid);
    const startRef = userRef.collection('mockStarts').doc(examId);
    const debitRef = userRef.collection('creditTransactions').doc(`mock_start_${examId}`);
    const state = await db().runTransaction(async tx => {
      const [userSnap, startSnap] = await Promise.all([tx.get(userRef), tx.get(startRef)]);
      const user = userSnap.exists ? userSnap.data() : {};
      if (startSnap.exists) return { ...startSnap.data(), alreadyStarted: true, credits: Math.max(0, Number(user.subscriptionCredits || 0)) };
      let credits = Math.max(0, Number(user.subscriptionCredits || 0));
      let freePracticeUsed = Object.prototype.hasOwnProperty.call(user, 'freePracticeUsed')
        ? user.freePracticeUsed === true
        : (!Number.isFinite(Date.parse(user.createdAt || '')) || Date.parse(user.createdAt) < FREE_TRIAL_CUTOFF);
      let practiceType;
      let balance = credits;
      if (!freePracticeUsed) {
        practiceType = 'free';
        freePracticeUsed = true;
      } else {
        if (credits < MOCK_CREDITS) {
          const err = new Error(`You need ${MOCK_CREDITS} credits to start a mock. Your balance is ${credits}. Please subscribe to continue.`);
          err.statusCode = 402;
          throw err;
        }
        practiceType = 'paid';
        balance = credits - MOCK_CREDITS;
      }
      const now = new Date().toISOString();
      tx.set(userRef, {
        freePracticeUsed,
        subscriptionCredits: balance,
        subscriptionStatus: balance > 0 ? 'active' : 'exhausted',
        lastPracticeAt: now
      }, { merge: true });
      const startData = { examId, practiceType, creditsDeducted: practiceType === 'paid' ? MOCK_CREDITS : 0, balanceAfter: balance, startedAt: now, status: 'started' };
      tx.set(startRef, startData);
      tx.set(debitRef, { type: practiceType === 'free' ? 'free_practice_started' : 'mock_started', credits: practiceType === 'paid' ? -MOCK_CREDITS : 0, balanceAfter: balance, examId, createdAt: now });
      return { ...startData, credits: balance, alreadyStarted: false };
    });
    return send(res, 200, { success: true, ...state, requiredCredits: MOCK_CREDITS });
  } catch (e) { return send(res, e.statusCode || 500, { error: e.message || 'Unable to start your mock.' }); }
};
