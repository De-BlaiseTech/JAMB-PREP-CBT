const title = document.getElementById('title');
const message = document.getElementById('message');
const actions = document.getElementById('actions');

function button(text, href) {
  const a = document.createElement('a');
  a.className = 'btn primary';
  a.href = href;
  a.textContent = text;
  return a;
}

function getPaymentReference() {
  const params = new URLSearchParams(location.search);
  // Paystack normally returns `reference`; some integrations/callbacks also expose `trxref`.
  return String(params.get('reference') || params.get('trxref') || '').trim();
}

(async () => {
  const reference = getPaymentReference();

  if (!reference) {
    title.textContent = 'Payment reference not found';
    message.textContent = 'We could not find the Paystack transaction reference. If money was deducted, do not pay again. Return to the dashboard and try the payment verification option.';
    actions.append(button('Back to Dashboard', 'dashboard.html'));
    return;
  }

  try {
    const access = await import('./access.js');
    const result = await access.verifyPayment(reference);

    title.textContent = 'Payment successful! 🎉';
    message.textContent = `Your 30-day premium access is active until ${new Date(result.expiresAt).toLocaleDateString()}.`;
    actions.append(button('Start Your Mock', 'setup.html'));
  } catch (e) {
    title.textContent = 'Payment could not be confirmed';
    message.textContent = e?.message || 'Please check your payment status and try again. If your account was debited, do not pay again.';
    actions.append(button('Back to Dashboard', 'dashboard.html'));
  }
})();
