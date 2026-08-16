function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
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
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;background:#fff"><main style="max-width:600px;margin:0 auto;padding:28px 20px"><h2 style="margin:0 0 18px">Reset your password</h2><p>Hello ${safeName},</p><p>We received a request to reset the password for your De-Blaise Technologies JAMB Prep CBT account.</p><p>Click the button below to choose a new password.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2e682b;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p><p>This link expires in 1 hour and can only be used once.</p><p>If you did not request a password reset, you can ignore this email. Your password will not change.</p><p>— De-Blaise Technologies</p></main></body></html>`
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Unable to send the password reset email.');
  return payload;
}

module.exports = { sendPasswordResetEmail };
