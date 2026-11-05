const { requireUser, db, nowMs } = require('./_lib/firebaseAdmin');
function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }
const MOCK_CREDITS = 100;
// Accounts created from this release onward receive one free first mock.
const FREE_TRIAL_CUTOFF = Date.parse('2026-11-05T09:06:00.000Z');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const token = await requireUser(req);
    const ref = db().collection('users').doc(token.uid);
    const state = await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : {};
      let freePracticeUsed = data.freePracticeUsed === true;
      if (!Object.prototype.hasOwnProperty.call(data, 'freePracticeUsed')) {
        const createdAt = Date.parse(data.createdAt || '');
        freePracticeUsed = !Number.isFinite(createdAt) || createdAt < FREE_TRIAL_CUTOFF;
        tx.set(ref, { freePracticeUsed }, { merge: true });
      }
      let credits = Math.max(0, Number(data.subscriptionCredits || 0));
      if (!Object.prototype.hasOwnProperty.call(data, 'subscriptionCredits') && data.subscriptionStatus === 'active') {
        const expiry = data.subscriptionExpiresAt?.toMillis ? data.subscriptionExpiresAt.toMillis() : Number(data.subscriptionExpiresAt || 0);
        if (expiry > nowMs()) {
          credits = 1200;
          tx.set(ref, { subscriptionCredits: credits, totalCreditsPurchased: credits, plan: 'basic', subscriptionStatus: 'active', creditMigration: 'legacy-monthly-v1' }, { merge: true });
        }
      }
      return { credits, plan: data.plan || null, totalCreditsPurchased: Number(data.totalCreditsPurchased || credits), freePracticeUsed };
    });
    const freePracticeAvailable = !state.freePracticeUsed;
    const allowed = freePracticeAvailable || state.credits >= MOCK_CREDITS;
    send(res, 200, { allowed, credits: state.credits, requiredCredits: MOCK_CREDITS, freePracticeAvailable, freePracticeUsed: state.freePracticeUsed, subscriptionActive: state.credits >= MOCK_CREDITS, plan: state.plan, totalCreditsPurchased: state.totalCreditsPurchased });
  } catch (e) { send(res, e.statusCode || 500, { error: e.message || 'Unable to check access.' }); }
};
