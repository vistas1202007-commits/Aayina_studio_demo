'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStudio } = require('../server/index.cjs');
const { randomUUID } = require('node:crypto');
async function fixture(t, extras = {}) {
  let now = Date.parse('2030-01-01T00:00:00Z');
  const events = [];
  const studio = createStudio({ dbPath: ':memory:', env: { STUDIO_MODE: 'live', ADMIN_PHONES: '9876543210' }, now: () => now,
    providers: { configured: true, sendOtp: async () => {}, checkOtp: async (_, code) => code === '123456', notify: async event => events.push(event) }, ...extras });
  const close = studio.close; let closed = false;
  studio.close = () => { if (closed) return Promise.resolve(); closed = true; return close(); };
  await new Promise(resolve => studio.server.listen(0, '127.0.0.1', resolve));
  t.after(() => studio.close());
  const origin = 'http://127.0.0.1:' + studio.server.address().port;
  async function request(route, { method = 'GET', body, cookie = '', key = randomUUID(), customOrigin = origin } = {}) {
    const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', Origin: customOrigin, Cookie: cookie, 'Idempotency-Key': key }, body: body === undefined ? undefined : JSON.stringify(body) });
    const raw = await response.text(); let data; try { data = JSON.parse(raw); } catch { data = raw; }
    return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  async function login(phone = '9988776655') {
    const challenge = await request('/api/auth/request', { method: 'POST', body: { phone, name: 'Test customer' } });
    assert.equal(challenge.status, 200);
    const verified = await request('/api/auth/verify', { method: 'POST', body: { challenge: challenge.data.challenge, code: '123456' } });
    assert.equal(verified.status, 200); return verified.cookie;
  }
  return { ...studio, request, login, events, advance: value => { now += value; } };
}
const booking = { services: ['global-colour'], stylist: 'riya', date: '2030-01-02', time: '14:00', total: 1, status: 'completed' };
test('verified sessions, role checks, origin protection and session revocation', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/bookings')).status, 401);
  const challenge = await f.request('/api/auth/request', { method: 'POST', body: { name: 'Example', phone: '9988776655' } });
  assert.equal((await f.request('/api/auth/verify', { method: 'POST', body: { challenge: challenge.data.challenge, code: '000000' } })).status, 401);
  const cookie = await f.login();
  assert.equal((await f.request('/api/admin/overview', { cookie })).status, 403);
  assert.equal((await f.request('/api/bookings', { method: 'POST', cookie, body: booking, customOrigin: 'https://other.example' })).status, 403);
  await f.request('/api/auth/logout', { method: 'POST', cookie, body: {} });
  assert.equal((await f.request('/api/bookings', { cookie })).status, 401);
  const admin = await f.login('9876543210');
  assert.equal((await f.request('/api/admin/overview', { cookie: admin })).status, 200);
});
test('atomic scheduling rejects overlaps, permits other artists and is idempotent', async t => {
  const f = await fixture(t), cookie = await f.login(), other = await f.login('9776655443'), key = randomUUID();
  const first = await f.request('/api/bookings', { method: 'POST', cookie, body: booking, key });
  assert.equal(first.status, 201); assert.equal(first.data.booking.status, 'pending'); assert.equal(first.data.booking.total, 2499);
  const duplicate = await f.request('/api/bookings', { method: 'POST', cookie, body: booking, key });
  assert.equal(duplicate.data.booking.id, first.data.booking.id);
  assert.equal((await f.request('/api/bookings', { method: 'POST', cookie: other, body: { ...booking, time: '14:30' } })).status, 409);
  const different = await f.request('/api/bookings', { method: 'POST', cookie: other, body: { ...booking, services: ['party-makeup'], stylist: 'naina' } });
  assert.equal(different.status, 201);
  const slots = await f.request('/api/slots?date=2030-01-02&services=global-colour&stylist=riya');
  assert.ok(!slots.data.slots.some(slot => slot.time === '14:30'));
  const concurrent = await Promise.all([1, 2].map(() => f.request('/api/bookings', { method: 'POST', cookie: other, body: { ...booking, date: '2030-01-03' } })));
  assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 409]);
});
test('ownership, cancellation policy and reschedule validation preserve stored prices', async t => {
  const f = await fixture(t), cookie = await f.login(), other = await f.login('9776655443'), admin = await f.login('9876543210');
  const first = await f.request('/api/bookings', { method: 'POST', cookie, body: booking }), id = first.data.booking.id;
  assert.equal((await f.request('/api/bookings/' + id + '/cancel', { method: 'POST', cookie: other, body: {} })).status, 404);
  assert.equal((await f.request('/api/bookings/' + id + '/reschedule', { method: 'POST', cookie, body: { date: null, time: null } })).status, 400);
  await f.request('/api/admin/services/global-colour', { method: 'PATCH', cookie: admin, body: { price: 9999, mins: 60, offer: 0, available: true } });
  const moved = await f.request('/api/bookings/' + id + '/reschedule', { method: 'POST', cookie, body: { date: '2030-01-03', time: '15:00' } });
  assert.equal(moved.status, 200); assert.equal(moved.data.booking.total, 2499); assert.equal(moved.data.booking.mins, 120);
  f.advance(2 * 86400000 + 6 * 3600000); // Jan 3, 11:30 IST, less than four hours before 15:00.
  assert.equal((await f.request('/api/bookings/' + id + '/cancel', { method: 'POST', cookie, body: {} })).status, 409);
});
test('admin hours and leave change availability; enquiries persist; notifications reflect provider acceptance', async t => {
  const f = await fixture(t), cookie = await f.login(), admin = await f.login('9876543210');
  const first = await f.request('/api/bookings', { method: 'POST', cookie, body: booking }), id = first.data.booking.id;
  assert.equal((await f.request('/api/admin/bookings/' + id, { method: 'PATCH', cookie: admin, body: { status: 'completed' } })).status, 400);
  await f.request('/api/admin/bookings/' + id, { method: 'PATCH', cookie: admin, body: { status: 'confirmed' } });
  await f.processOutbox(); assert.equal(f.events.length, 1); assert.equal(f.events[0].type, 'confirmed');
  const lead = await f.request('/api/leads', { method: 'POST', body: { name: '<Example>', phone: '9887766554', type: 'bridal', date: '2030-02-02', message: 'Trial enquiry' } });
  assert.equal(lead.status, 201);
  await f.request('/api/admin/blocks', { method: 'POST', cookie: admin, body: { date: '2030-01-04', artist: 'riya', start: '10:00', end: '20:00', reason: 'Leave' } });
  assert.equal((await f.request('/api/slots?date=2030-01-04&services=global-colour&stylist=riya')).data.slots.length, 0);
  const overview = await f.request('/api/admin/overview', { cookie: admin });
  assert.equal(overview.data.leads[0].name, '<Example>');
  assert.ok(overview.data.notifications.some(item => item.accepted));
});
test('rate limiting, invalid input, private files and notification retries', async t => {
  const f = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/auth/request', { method: 'POST', body: { name: 'User', phone: '9887766554' } })).status, 200);
  assert.equal((await f.request('/api/auth/request', { method: 'POST', body: { name: 'User', phone: '9887766554' } })).status, 429);
  assert.equal((await f.request('/api/leads', { method: 'POST', body: { name: 'User', phone: '123' } })).status, 400);
  for (const route of ['/server/index.cjs', '/var/studio.sqlite', '/.env', '/package.json']) assert.equal((await f.request(route)).status, 404);
  const cookie = await f.login();
  assert.equal((await f.request('/api/bookings', { method: 'POST', cookie, body: { ...booking, services: ['missing'] } })).status, 400);
});
test('production mode requires HTTPS and default demo has no live mutations', async t => {
  assert.throws(() => createStudio({ dbPath: ':memory:', env: { STUDIO_MODE: 'live', NODE_ENV: 'production' } }), /HTTPS/);
  const f = await fixture(t, { env: { STUDIO_MODE: 'demo' } });
  assert.equal((await f.request('/api/config')).data.mode, 'demo');
  assert.equal((await f.request('/api/auth/request', { method: 'POST', body: {} })).status, 503);
});

test('a reward can be reserved once, then released on cancellation', async t => {
  const f = await fixture(t), cookie = await f.login(), phone = '9988776655';
  for (let i = 0; i < 5; i++) {
    const item = { id: 'AAI-history-' + i, phone, name: 'Customer', services: ['glow-facial'], date: '2029-12-' + (10 + i), time: '12:00', mins: 60, total: 999, status: 'completed', stylist: 'simran' };
    f.db.prepare('INSERT INTO bookings(id,phone,date,status,data) VALUES(?,?,?,?,?)').run(item.id, phone, item.date, item.status, JSON.stringify(item));
  }
  const input = { services: ['glow-facial'], stylist: 'simran', date: '2030-01-02', time: '14:00' };
  const first = await f.request('/api/bookings', { method: 'POST', cookie, body: input });
  assert.equal(first.data.booking.total, 749);
  const second = await f.request('/api/bookings', { method: 'POST', cookie, body: { ...input, date: '2030-01-03' } });
  assert.equal(second.data.booking.total, 999);
  await f.request('/api/bookings/' + first.data.booking.id + '/cancel', { method: 'POST', cookie, body: {} });
  const third = await f.request('/api/bookings', { method: 'POST', cookie, body: { ...input, date: '2030-01-04' } });
  assert.equal(third.data.booking.total, 749);
});
test('failed notifications are retried and rescheduling removes obsolete queued reminders', async t => {
  let reject = true;
  const f = await fixture(t, { providers: { configured: true, sendOtp: async () => {}, checkOtp: async () => true, notify: async () => { if (reject) throw Error('Provider unavailable'); } } });
  const cookie = await f.login(), admin = await f.login('9876543210');
  const first = await f.request('/api/bookings', { method: 'POST', cookie, body: booking }), id = first.data.booking.id;
  await f.request('/api/admin/bookings/' + id, { method: 'PATCH', cookie: admin, body: { status: 'confirmed' } });
  await f.processOutbox();
  assert.equal(f.db.prepare('SELECT attempts FROM outbox WHERE id LIKE ?').get(id + ':confirmed:%').attempts, 1);
  reject = false; f.advance(60000); await f.processOutbox();
  assert.ok(f.db.prepare('SELECT accepted FROM outbox WHERE id LIKE ?').get(id + ':confirmed:%').accepted);
  const previous = f.db.prepare('SELECT id FROM outbox WHERE accepted IS NULL').all().map(item => item.id);
  await f.request('/api/bookings/' + id + '/reschedule', { method: 'POST', cookie, body: { date: '2030-01-04', time: '13:00' } });
  for (const key of previous) assert.equal(f.db.prepare('SELECT id FROM outbox WHERE id=?').get(key), undefined);
});
test('appointments and session hashes persist across a server restart', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aaina-test-'));
  const dbPath = path.join(directory, 'studio.sqlite');
  const first = await fixture(t, { dbPath }), cookie = await first.login();
  const saved = await first.request('/api/bookings', { method: 'POST', cookie, body: booking });
  assert.equal(saved.status, 201); await first.close();
  const second = await fixture(t, { dbPath });
  const restored = await second.request('/api/bookings', { cookie });
  assert.equal(restored.status, 200); assert.equal(restored.data.bookings[0].id, saved.data.booking.id);
  assert.equal(second.db.prepare('SELECT token FROM sessions').get().token.includes(cookie.split('=')[1]), false);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
});
