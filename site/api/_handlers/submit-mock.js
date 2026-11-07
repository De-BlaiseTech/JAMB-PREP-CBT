const { requireUser, db } = require('../_lib/firebaseAdmin');
function send(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body)); }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' });
  try {
    const token = await requireUser(req);
    const examId = String(req.body?.examId || '').trim();
    const result = req.body?.result;
    if (!examId || !result || result.id !== examId || Number(result.total) !== 60) return send(res, 400, { error: 'A valid 60-question mock result is required.' });
    const userRef = db().collection('users').doc(token.uid);
    const resultRef = userRef.collection('results').doc(examId);
    const startRef = userRef.collection('mockStarts').doc(examId);
    const response = await db().runTransaction(async tx => {
      const [userSnap, resultSnap, startSnap] = await Promise.all([tx.get(userRef), tx.get(resultRef), tx.get(startRef)]);
      const user = userSnap.exists ? userSnap.data() : {};
      if (!startSnap.exists) { const err = new Error('This mock session was not started correctly. Please start a new mock.'); err.statusCode = 403; throw err; }
      if (resultSnap.exists) return { result: resultSnap.data(), credits: Math.max(0, Number(user.subscriptionCredits || 0)), alreadySubmitted: true };
      const savedResult = { ...result, creditsCharged: Number(startSnap.data()?.creditsDeducted || 0), practiceType: startSnap.data()?.practiceType || 'paid' };
      tx.set(resultRef, savedResult);
      tx.set(startRef, { status: 'completed', completedAt: new Date().toISOString() }, { merge: true });
      return { result: savedResult, credits: Math.max(0, Number(user.subscriptionCredits || 0)), alreadySubmitted: false };
    });
    return send(res, 200, { success: true, ...response });
  } catch (e) { return send(res, e.statusCode || 500, { error: e.message || 'Unable to submit your mock.' }); }
};
