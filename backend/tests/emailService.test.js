const { sendWaitlistPromotion } = require('../src/modules/registrations/email.service');

describe('waitlist promotion email delivery', () => {
  const previousToken = process.env.MAILTRAP_API_TOKEN;
  const previousFrom = process.env.MAIL_FROM_EMAIL;
  const previousName = process.env.MAIL_FROM_NAME;
  const previousFetch = global.fetch;
  const previousWarn = console.warn;

  beforeEach(() => {
    process.env.MAILTRAP_API_TOKEN = 'test-token';
    process.env.MAIL_FROM_EMAIL = 'events@example.test';
    process.env.MAIL_FROM_NAME = 'EMS Test';
    global.fetch = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    if (previousToken === undefined) delete process.env.MAILTRAP_API_TOKEN;
    else process.env.MAILTRAP_API_TOKEN = previousToken;
    if (previousFrom === undefined) delete process.env.MAIL_FROM_EMAIL;
    else process.env.MAIL_FROM_EMAIL = previousFrom;
    if (previousName === undefined) delete process.env.MAIL_FROM_NAME;
    else process.env.MAIL_FROM_NAME = previousName;
    global.fetch = previousFetch;
    console.warn = previousWarn;
  });

  test('sends a plain-text promotion notice with India-local event time', async () => {
    global.fetch.mockResolvedValue({ ok: true });
    const sent = await sendWaitlistPromotion({
      to: 'attendee@example.test',
      name: 'Attendee',
      eventTitle: 'Design Week',
      startAt: new Date('2027-01-01T10:00:00.000Z'),
      venue: 'Hall A',
    });

    expect(sent).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://send.api.mailtrap.io/api/send');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toMatchObject({
      to: [{ email: 'attendee@example.test' }],
      subject: 'Your waitlist place is confirmed: Design Week',
      text: expect.stringContaining('Venue: Hall A'),
    });
  });

  test('retries provider errors three times and fails without throwing', async () => {
    global.fetch.mockRejectedValue(new Error('provider unavailable'));
    const sent = await sendWaitlistPromotion({
      to: 'attendee@example.test', name: 'Attendee', eventTitle: 'Design Week',
    });

    expect(sent).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(expect.not.stringContaining('attendee@example.test'));
  });

  test('does not call provider until mail configuration is present', async () => {
    delete process.env.MAILTRAP_API_TOKEN;
    const sent = await sendWaitlistPromotion({ to: 'attendee@example.test', eventTitle: 'Design Week' });

    expect(sent).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
