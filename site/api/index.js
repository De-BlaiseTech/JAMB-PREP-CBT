'use strict';

// Single Vercel Serverless Function router.
// The public /api/<name> URLs are preserved by vercel.json rewrites.
const routes = Object.freeze({
  'admin': require('./_handlers/admin'),
  'config-check': require('./_handlers/config-check'),
  'forgot-password': require('./_handlers/forgot-password'),
  'mock-access': require('./_handlers/mock-access'),
  'password-reset-status': require('./_handlers/password-reset-status'),
  'paystack-initialize': require('./_handlers/paystack-initialize'),
  'paystack-verify': require('./_handlers/paystack-verify'),
  'paystack-webhook': require('./_handlers/paystack-webhook'),
  'register-pending': require('./_handlers/register-pending'),
  'resend-registration': require('./_handlers/resend-registration'),
  'reset-password': require('./_handlers/reset-password'),
  'start-mock': require('./_handlers/start-mock'),
  'submit-mock': require('./_handlers/submit-mock'),
  'verify-registration': require('./_handlers/verify-registration')
});

module.exports = async (req, res) => {
  const rawRoute = req.query && req.query.route;
  const route = Array.isArray(rawRoute) ? rawRoute[0] : rawRoute;
  const name = String(route || '').replace(/^\/+|\/+$/g, '').replace(/\.js$/i, '');
  const handler = routes[name];

  if (!handler) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }

  try {
    return await handler(req, res);
  } catch (error) {
    console.error(`API router error (${name})`, error);
    if (res.headersSent) return;
    return res.status(500).json({ error: 'Unable to complete your request right now. Please try again later.' });
  }
};
