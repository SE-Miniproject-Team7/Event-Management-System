const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
  } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP configuration is incomplete');
  }

  const port = Number(SMTP_PORT || 587);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP port configuration is invalid');
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const mailer = getTransporter();

  return mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

function resetTransporter() {
  transporter = undefined;
}

module.exports = {
  sendEmail,
  resetTransporter,
};