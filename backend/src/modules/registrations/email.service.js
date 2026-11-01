const MAILTRAP_SEND_URL = 'https://send.api.mailtrap.io/api/send';

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendWaitlistPromotion({ to, name, eventTitle, startAt, venue }) {
  const token = process.env.MAILTRAP_API_TOKEN;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!token || !fromEmail || typeof fetch !== 'function') {
    console.warn(JSON.stringify({ level: 'warn', event: 'waitlist_email_not_configured' }));
    return false;
  }

  const when = startAt
    ? new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kolkata',
    }).format(new Date(startAt))
    : 'Please check the event page for the schedule.';
  const text = [
    `Hello ${name || 'attendee'},`,
    '',
    `A place is now available for ${eventTitle} and you have been promoted from the waitlist to a confirmed registration.`,
    `Event time (India): ${when}`,
    venue ? `Venue: ${venue}` : '',
    '',
    'Please sign in to view your registration details.',
  ].filter(Boolean).join('\n');

  const payload = {
    from: { email: fromEmail, name: process.env.MAIL_FROM_NAME || 'Event Management System' },
    to: [{ email: to }],
    subject: `Your waitlist place is confirmed: ${eventTitle}`,
    text,
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(MAILTRAP_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return true;
    } catch {
      // Retry transient provider and connection failures without exposing payload data.
    }

    if (attempt < 3) await delay(attempt * 100);
  }

  console.warn(JSON.stringify({ level: 'warn', event: 'waitlist_email_delivery_failed', attempts: 3 }));
  return false;
}

module.exports = { sendWaitlistPromotion };
