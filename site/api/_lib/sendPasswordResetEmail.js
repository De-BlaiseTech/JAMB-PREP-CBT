function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !from) throw new Error('Email service is not configured yet.');

  const safeName = escapeHtml(name || 'Student');
  const safeUrl = escapeHtml(resetUrl);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your De-Blaise Technologies JAMB Prep password',
      html: `<!doctype html><html><body style="margin:0;background:#f4f7f4;font-family:Arial,sans-serif;color:#222;line-height:1.6"><div style="max-width:560px;margin:24px auto;background:#fff;border-radius:14px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,.08)"><h2 style="margin-top:0;color:#246b35">Reset your password</h2><p>Hello ${safeName},</p><p>We received a request to reset the password for your De-Blaise Technologies JAMB Prep account.</p><p>Click the button below to choose a new password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 22px;background:#2e682b;color:#fff;text-decoration:none;border-radius:7px;font-weight:700">Reset Password</a></p><p>This password-reset link is time-limited and can only be used as provided by the password-reset service.</p><p>If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.</p><p>— De-Blaise Technologies</p></div></body></html>`
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Unable to send the password reset email.');
  return payload;
}

module.exports = { sendPasswordResetEmail };
