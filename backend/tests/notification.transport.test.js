jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const nodemailer = require('nodemailer');

const {
  sendEmail,
  resetTransporter,
} = require('../src/modules/notifications/email.transport');

describe('Email transport', () => {
  let sendMail;

  beforeEach(() => {
    jest.clearAllMocks();
    resetTransporter();

    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'test-password';
    process.env.SMTP_FROM = 'EMS Test <test@example.com>';

    sendMail = jest.fn().mockResolvedValue({ messageId: 'test-123' });

    nodemailer.createTransport.mockReturnValue({ sendMail });
  });

  afterAll(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  test('creates an SMTP transporter and sends an email', async () => {
    const result = await sendEmail({
      to: 'attendee@example.com',
      subject: 'Registration confirmed',
      text: 'Your registration is confirmed.',
      html: '<p>Your registration is confirmed.</p>',
    });

    expect(result.messageId).toBe('test-123');

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
      })
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'EMS Test <test@example.com>',
        to: 'attendee@example.com',
        subject: 'Registration confirmed',
      })
    );
  });

  test('reuses the transporter for subsequent emails', async () => {
    await sendEmail({
      to: 'one@example.com',
      subject: 'First',
      text: 'First email',
    });

    await sendEmail({
      to: 'two@example.com',
      subject: 'Second',
      text: 'Second email',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  test('rejects when SMTP configuration is incomplete', async () => {
    resetTransporter();
    delete process.env.SMTP_HOST;

    await expect(
      sendEmail({
        to: 'attendee@example.com',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow('SMTP configuration is incomplete');

    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('rejects an invalid SMTP port', async () => {
    resetTransporter();
    process.env.SMTP_PORT = 'invalid';

    await expect(
      sendEmail({
        to: 'attendee@example.com',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow('SMTP port configuration is invalid');
  });

  test('propagates SMTP delivery failures', async () => {
    sendMail.mockRejectedValue(new Error('SMTP unavailable'));

    await expect(
      sendEmail({
        to: 'attendee@example.com',
        subject: 'Test',
        text: 'Test',
      })
    ).rejects.toThrow('SMTP unavailable');
  });
});