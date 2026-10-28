process.env.JWT_SECRET = 'test-secret-for-admin-users';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/User', () => ({
  findById: jest.fn(), findByIdAndUpdate: jest.fn(), findOne: jest.fn(),
}));
jest.mock('../src/models/Event', () => ({ find: jest.fn() }));

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const app = require('../src/app');
const ADMIN_ID = '64b0000000000000000000a1';
const USER_ID = '64b0000000000000000000a2';
const MISSING_ID = '64b0000000000000000000ff';
let users;
let passwordHash;
const cookie = (id, role) => `ems_token=${jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '60m' })}`;
const adminCookie = () => cookie(ADMIN_ID, 'Admin');
const update = body => request(app).patch(`/api/admin/users/${USER_ID}`).set('Cookie', adminCookie()).send(body);

beforeAll(async () => { passwordHash = await bcrypt.hash('Correct123', 4); });
beforeEach(() => {
  jest.resetAllMocks();
  users = new Map([
    [ADMIN_ID, { _id: ADMIN_ID, name: 'Admin', email: 'admin@test.local', role: 'Admin', active: true, passwordHash }],
    [USER_ID, { _id: USER_ID, name: 'Attendee', email: 'attendee@test.local', role: 'Attendee', active: true, passwordHash, failedLogins: 0, lockUntil: null }],
  ]);
  User.findById.mockImplementation(async id => users.get(String(id)) || null);
  User.findOne.mockImplementation(async ({ email }) => [...users.values()].find(u => u.email === email) || null);
  User.findByIdAndUpdate.mockImplementation(async (id, { $set }) => {
    const user = users.get(String(id));
    if (!user) return null;
    Object.assign(user, $set);
    return { ...user };
  });
  Event.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
});

describe('Admin user management (EMS-F-031 / TC-ADM-01)', () => {
  test.each([false, true])('sets active=%s without changing other fields', async active => {
    users.get(USER_ID).active = !active;
    const res = await update({ active });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: USER_ID, name: 'Attendee', email: 'attendee@test.local', role: 'Attendee', active });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(USER_ID, { $set: { active } }, { returnDocument: 'after', runValidators: true });
    expect(users.get(USER_ID).passwordHash).toBe(passwordHash);
  });

  test.each(['Attendee', 'Organizer', 'Admin'])('sets the role to %s', async role => {
    const res = await update({ role });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe(role);
    expect(res.body.user.active).toBe(true);
  });

  test('updates activity and role together without leaking authentication metadata', async () => {
    const res = await update({ active: false, role: 'Organizer' });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: USER_ID, name: 'Attendee', email: 'attendee@test.local', active: false, role: 'Organizer' });
    expect(Object.keys(res.body.user).sort()).toEqual(['active', 'email', 'id', 'name', 'role']);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('requires authentication', async () => {
    const res = await request(app).patch(`/api/admin/users/${USER_ID}`).send({ active: false });
    expect(res.status).toBe(401);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['Attendee', 'Organizer'])('rejects a %s even with an Admin role in their JWT', async role => {
    users.get(USER_ID).role = role;
    const res = await request(app).patch(`/api/admin/users/${ADMIN_ID}`).set('Cookie', cookie(USER_ID, 'Admin')).send({ active: false });
    expect(res.status).toBe(403);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('rejects an inactive Admin', async () => {
    users.get(ADMIN_ID).active = false;
    const res = await update({ active: false });
    expect(res.status).toBe(401);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['not-an-id', MISSING_ID])('returns 404 for user %s', async id => {
    const res = await request(app).patch(`/api/admin/users/${id}`).set('Cookie', adminCookie()).send({ active: false });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test.each([
    ['empty object', {}, 'body'],
    ['string active', { active: 'false' }, 'active'],
    ['numeric active', { active: 0 }, 'active'],
    ['null active', { active: null }, 'active'],
    ['unknown role', { role: 'Owner' }, 'role'],
    ['wrong role case', { role: 'admin' }, 'role'],
    ['null role', { role: null }, 'role'],
    ['NoSQL role', { role: { $ne: null } }, 'role'],
    ['password update', { active: false, passwordHash: 'changed' }, 'passwordHash'],
    ['email update', { email: 'changed@test.local' }, 'email'],
    ['operator update', { $set: { role: 'Admin' } }, '$set'],
  ])('rejects %s with 422 and saves nothing', async (label, body, field) => {
    const res = await update(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(users.get(USER_ID).active).toBe(true);
  });

  test('rejects array bodies', async () => {
    const res = await update([]);
    expect(res.status).toBe(422);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('invalid role prevents a valid activity change from being partially saved', async () => {
    const res = await update({ active: false, role: 'Unknown' });
    expect(res.status).toBe(422);
    expect(users.get(USER_ID).active).toBe(true);
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('deactivation rejects an existing session on its next request and rejects login', async () => {
    const session = cookie(USER_ID, 'Attendee');
    expect((await request(app).get('/api/auth/me').set('Cookie', session)).status).toBe(200);
    expect((await update({ active: false })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', session)).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ email: 'attendee@test.local', password: 'Correct123' });
    expect(login.status).toBe(401);
  });

  test('promotion grants Organizer access using the existing Attendee session', async () => {
    const session = cookie(USER_ID, 'Attendee');
    expect((await request(app).get('/api/events/mine').set('Cookie', session)).status).toBe(403);
    expect((await update({ role: 'Organizer' })).status).toBe(200);
    expect((await request(app).get('/api/events/mine').set('Cookie', session)).status).toBe(200);
  });

  test('demotion removes Organizer access from an existing session', async () => {
    users.get(USER_ID).role = 'Organizer';
    const session = cookie(USER_ID, 'Organizer');
    expect((await request(app).get('/api/events/mine').set('Cookie', session)).status).toBe(200);
    expect((await update({ role: 'Attendee' })).status).toBe(200);
    expect((await request(app).get('/api/events/mine').set('Cookie', session)).status).toBe(403);
  });
});
