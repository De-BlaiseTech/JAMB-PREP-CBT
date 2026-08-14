const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) return admin;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Server configuration is incomplete.');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('Server configuration is incomplete.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'jamb-prep-cbt'
  });
  return admin;
}

async function requireUser(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    const err = new Error('Please sign in to continue.');
    err.statusCode = 401;
    throw err;
  }

  const token = authHeader.slice(7);
  try {
    return await getAdmin().auth().verifyIdToken(token);
  } catch {
    const err = new Error('Your session has expired. Please sign in again.');
    err.statusCode = 401;
    throw err;
  }
}

function db() { return getAdmin().firestore(); }
function nowMs() { return Date.now(); }

module.exports = { getAdmin, requireUser, db, nowMs };
