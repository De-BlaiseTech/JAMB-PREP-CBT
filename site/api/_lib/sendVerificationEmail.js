function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

async function sendVerificationEmail({ to, name, verificationUrl }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!apiKey || !from) throw new Error('Email service is not configured yet.');

  const safeName = escapeHtml(name || 'Student');
  const safeUrl = escapeHtml(verificationUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Verify your De-Blaise Technologies JAMB Prep account',
      html: `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222"><h2>Verify your account</h2><p>Hello ${safeName},</p><p>Click the button below to verify your email and complete your JAMB Prep CBT account registration.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2e682b;color:#fff;text-decoration:none;border-radius:6px">Verify Email &amp; Create Account</a></p><p>This link expires in 24 hours and can only be used once.</p><p>If you did not request this registration, you can ignore this email.</p><p>— De-Blaise Technologies</p></body></html>`
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Unable to send the verification email.');
  return payload;
}

module.exports = { sendVerificationEmail };
