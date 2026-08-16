const admin = require('firebase-admin');

function result(ok, extra = {}) {
  return { ok: !!ok, ...extra };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Temporary diagnostic endpoint. It deliberately NEVER returns secret values.
  const rawService = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const rawKey = String(process.env.REGISTRATION_ENCRYPTION_KEY || '').trim();
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const resendFrom = String(process.env.RESEND_FROM_EMAIL || '').trim();

  const checks = {
    firebaseServiceAccountPresent: result(!!rawService),
    firebaseServiceAccountJson: result(false),
    firebaseServiceAccountFields: result(false),
    registrationEncryptionKey: result(/^[0-9a-fA-F]{64}$/.test(rawKey), {
      length: rawKey.length,
      expectedLength: 64
    }),
    resendApiKeyPresent: result(!!resendKey),
    resendFromEmailPresent: result(!!resendFrom),
    firebaseProjectIdPresent: result(!!String(process.env.FIREBASE_PROJECT_ID || '').trim())
  };

  let serviceAccount = null;
  if (rawService) {
    try {
      serviceAccount = JSON.parse(rawService);
      checks.firebaseServiceAccountJson = result(true);
      checks.firebaseServiceAccountFields = result(
        !!serviceAccount &&
        typeof serviceAccount === 'object' &&
        !!serviceAccount.project_id &&
        !!serviceAccount.client_email &&
        !!serviceAccount.private_key,
        {
          projectIdPresent: !!serviceAccount?.project_id,
          clientEmailPresent: !!serviceAccount?.client_email,
          privateKeyPresent: !!serviceAccount?.private_key
        }
      );
    } catch (e) {
      checks.firebaseServiceAccountJson = result(false, { parseError: true });
    }
  }

  let firestore = { ok: false };
  try {
    if (checks.firebaseServiceAccountJson.ok && checks.firebaseServiceAccountFields.ok) {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'jamb-prep-cbt'
        });
      }
      await admin.firestore().listCollections();
      firestore = { ok: true };
    } else {
      firestore = { ok: false, skipped: true };
    }
  } catch (e) {
    firestore = { ok: false, errorType: e?.code || e?.name || 'FirebaseError' };
  }

  const configurationIncomplete =
    !checks.firebaseServiceAccountJson.ok ||
    !checks.firebaseServiceAccountFields.ok ||
    !checks.registrationEncryptionKey.ok;

  return res.status(200).json({
    configurationIncomplete,
    checks,
    firestore
  });
};
