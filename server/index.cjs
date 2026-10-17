'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite = require('node:sqlite');
const core = require('../core.js');
const data = require('../data.js');
const { providers } = require('./providers.cjs');
const ROOT = path.resolve(__dirname, '..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function phoneNumber(value) {
  let phone = text(value, 30).replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  if (!/^[6-9]\d{9}$/.test(phone)) fail('Enter a valid 10-digit Indian mobile number.');
  return phone;
}
function createStudio(options = {}) {
  const env = options.env || process.env, live = env.STUDIO_MODE === 'live';
  const publicUrl = env.PUBLIC_URL ? new URL(env.PUBLIC_URL) : null;
  if (env.NODE_ENV === 'production' && live && publicUrl?.protocol !== 'https:') throw Error('Live production requires an HTTPS PUBLIC_URL.');
  const dbPath = options.dbPath || env.DATABASE_PATH || path.join(ROOT, 'var/studio.sqlite');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const Database = sqlite.Database || sqlite.DatabaseSync;
  const db = new Database(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (phone TEXT PRIMARY KEY, name TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, phone TEXT NOT NULL REFERENCES users(phone), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, phone TEXT NOT NULL, name TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, phone TEXT NOT NULL REFERENCES users(phone), date TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date, status);
    CREATE INDEX IF NOT EXISTS bookings_phone ON bookings(phone);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, booking TEXT, due INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, accepted INTEGER, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS limits (key TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(key,bucket));
  `);
  const delivery = options.providers || providers(env), clock = options.now || (() => Date.now());
  const admins = new Set((env.ADMIN_PHONES || '').split(',').map(value => value.trim()).filter(Boolean).map(phoneNumber));
  if (live && env.NODE_ENV === 'production' && (!delivery.configured || !admins.size)) { db.close(); throw Error('Live production requires a verification provider and at least one ADMIN_PHONES entry.'); }
  const getSetting = (key, fallback) => { const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? JSON.parse(row.value) : fallback; };
  const setSetting = (key, value) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, JSON.stringify(value));
  const catalog = () => data.serviceList.map(item => ({ ...item, ...getSetting('service:' + item.id, {}) }));
  const allBookings = () => db.prepare('SELECT data FROM bookings').all().map(row => JSON.parse(row.data));
  const blocks = () => db.prepare('SELECT data FROM blocks').all().map(row => JSON.parse(row.data));
  const openingHours = () => getSetting('hours', core.hours);
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
  function userFor(req) {
    const token = /(?:^|;\s*)aaina_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return null;
    const row = db.prepare('SELECT users.* FROM sessions JOIN users ON users.phone=sessions.phone WHERE token=? AND expires>?').get(hash(token), clock());
    return row ? { ...JSON.parse(row.profile), phone: row.phone, name: row.name, role: admins.has(row.phone) ? 'admin' : 'customer' } : null;
  }
  function requireUser(req, admin = false) { const user = userFor(req); if (!user) fail('Sign in with your verified phone number to continue.', 401); if (admin && user.role !== 'admin') fail('Studio administrator access is required.', 403); return user; }
  function rate(key, max, interval = 900000) {
    const bucket = Math.floor(clock() / interval);
    db.prepare('DELETE FROM limits WHERE bucket<?').run(bucket - 4);
    const row = db.prepare('INSERT INTO limits(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1 RETURNING count').get(key, bucket);
    if (row.count > max) fail('Too many attempts. Please try again later.', 429);
  }
  function saveBooking(item) { db.prepare('INSERT INTO bookings(id,phone,date,status,data) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,status=excluded.status,data=excluded.data').run(item.id, item.phone, item.date, item.status, JSON.stringify(item)); }
  function ownedBooking(req, id, admin = false) {
    const user = requireUser(req, admin), row = db.prepare('SELECT data FROM bookings WHERE id=?').get(id);
    if (!row) fail('Appointment not found.', 404);
    const item = JSON.parse(row.data);
    if (user.role !== 'admin' && item.phone !== user.phone) fail('Appointment not found.', 404);
    return item;
  }
  function queue(item, type, due = clock(), suffix = '') {
    const id = item.id + ':' + type + ':' + (suffix || item.revision || 1);
    db.prepare('INSERT OR IGNORE INTO outbox(id,booking,due,data) VALUES(?,?,?,?)').run(id, item.id, due, JSON.stringify({ id, type, phone: item.phone, booking: item }));
  }
  function reminderQueue(item) {
    if (item.status !== 'confirmed') return;
    for (const hours of [24, 2]) { const due = core.startsAt(item.date, item.time) - hours * 3600000; if (due > clock()) queue(item, 'reminder', due, item.revision + ':' + hours); }
  }
  function changes(item, type) { db.prepare('DELETE FROM outbox WHERE booking=? AND accepted IS NULL').run(item.id); queue(item, type); reminderQueue(item); }
  function allocation(item, excludeId, snapshot) {
    const menu = (snapshot?.catalog || catalog()).map(service => ({ ...service, ...(item.lineItems?.find(line => line.id === service.id) || {}) }));
    try { return core.allocation({ ...item, catalog: menu, artists: data.stylistList, bookings: snapshot?.bookings || allBookings(), blocks: snapshot?.blocks || blocks(), openingHours: snapshot?.hours || openingHours(), now: clock(), excludeId }); }
    catch (error) { throw Object.assign(error, { status: error.message.includes('no longer available') ? 409 : 400 }); }
  }
  function cookie(value, age = 7 * 86400) { return 'aaina_session=' + value + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (publicUrl?.protocol === 'https:' ? '; Secure' : ''); }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) fail('Use application/json.', 415);
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 16384) fail('Request is too large.', 413); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString() || '{}'); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Use a JSON object.'); return value; }
    catch (error) { if (error.status) throw error; fail('Invalid JSON.'); }
  }
  function json(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  async function api(req, res, url) {
    const route = url.pathname;
    if (route === '/api/config' && req.method === 'GET') return json(res, { mode: live ? 'live' : 'demo', services: catalog(), artists: data.stylistList, combos: data.comboList, hours: openingHours(), closures: blocks().filter(item => item.artist === 'any').map(({ date, start, end }) => ({ date, start, end })), policy: core.policy, authAvailable: !!delivery.configured, notificationConfigured: !!(env.NOTIFICATION_WEBHOOK_URL && env.NOTIFICATION_WEBHOOK_SECRET) });
    if (!live) fail('The API is disabled in demo mode.', 503);
    if (!['GET', 'HEAD'].includes(req.method)) { const expected = publicUrl?.origin || 'http://' + req.headers.host; if (req.headers.origin !== expected || req.headers['sec-fetch-site'] === 'cross-site') fail('This request must come from the studio website.', 403); }
    const ip = req.socket.remoteAddress || 'unknown';
    if (route === '/api/auth/request' && req.method === 'POST') {
      const input = await body(req), phone = phoneNumber(input.phone), name = text(input.name, 100);
      if (name.length < 2) fail('Enter your name.');
      rate('otp-phone:' + hash(phone), 5); rate('otp-ip:' + ip, 20);
      await delivery.sendOtp(phone);
      const id = crypto.randomBytes(32).toString('hex');
      transaction(() => { db.prepare('DELETE FROM challenges WHERE phone=? OR expires<?').run(phone, clock()); db.prepare('INSERT INTO challenges(id,phone,name,expires) VALUES(?,?,?,?)').run(hash(id), phone, name, clock() + 600000); });
      return json(res, { challenge: id, message: 'Verification code requested. Check your phone.' });
    }
    if (route === '/api/auth/verify' && req.method === 'POST') {
      const input = await body(req); rate('verify-ip:' + ip, 30);
      const challenge = db.prepare('SELECT * FROM challenges WHERE id=?').get(hash(text(input.challenge, 64)));
      if (!challenge || challenge.expires <= clock() || challenge.attempts >= 5) fail('Request a new verification code.', 401);
      db.prepare('UPDATE challenges SET attempts=attempts+1 WHERE id=?').run(challenge.id);
      if (!/^\d{4,8}$/.test(input.code || '') || !await delivery.checkOtp(challenge.phone, input.code)) fail('The verification code is invalid.', 401);
      const token = crypto.randomBytes(32).toString('hex');
      transaction(() => {
        const removed = db.prepare('DELETE FROM challenges WHERE id=?').run(challenge.id); if (!removed.changes) fail('That verification was already used.', 401);
        db.prepare('INSERT INTO users(phone,name) VALUES(?,?) ON CONFLICT(phone) DO UPDATE SET name=excluded.name').run(challenge.phone, challenge.name);
        db.prepare('DELETE FROM sessions WHERE expires<?').run(clock());
        db.prepare('INSERT INTO sessions(token,phone,expires) VALUES(?,?,?)').run(hash(token), challenge.phone, clock() + 7 * 86400000);
      });
      res.setHeader('Set-Cookie', cookie(token)); return json(res, { user: { phone: challenge.phone, name: challenge.name, role: admins.has(challenge.phone) ? 'admin' : 'customer' } });
    }
    if (route === '/api/auth/logout' && req.method === 'POST') {
      await body(req); const token = /aaina_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];
      if (token) db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token));
      res.setHeader('Set-Cookie', cookie('', 0)); return json(res, { ok: true });
    }
    if (route === '/api/me' && req.method === 'GET') return json(res, { user: userFor(req) });
    if (route === '/api/me' && req.method === 'PATCH') {
      const user = requireUser(req), input = await body(req), name = text(input.name, 100); if (name.length < 2) fail('Enter your name.');
      const profile = { email: text(input.email, 200), birthday: core.validDate(input.birthday) ? input.birthday : '', reminders: input.reminders !== false, offers: input.offers === true, artist: data.stylistList.some(item => item.id === input.artist) ? input.artist : 'any' };
      db.prepare('UPDATE users SET name=?,profile=? WHERE phone=?').run(name, JSON.stringify(profile), user.phone);
      return json(res, { user: { ...user, ...profile, name } });
    }
    if (route === '/api/slots' && req.method === 'GET') {
      const ids = (url.searchParams.get('services') || '').split(','), date = url.searchParams.get('date'), stylist = url.searchParams.get('stylist') || 'any';
      if (!core.validDate(date)) fail('Choose a valid date.');
      const exclude = url.searchParams.get('exclude'), existing = exclude ? ownedBooking(req, exclude) : null;
      core.bill(ids, null, catalog(), data.comboList);
      const slots = [];
      const snapshot = { catalog: catalog(), bookings: allBookings(), blocks: blocks(), hours: openingHours() };
      for (let start = 0; start < 1440; start += 30) { const time = core.timeKey(start); try { allocation({ ...existing, date, time, services: ids, stylist }, existing?.id, snapshot); slots.push({ time, taken: false }); } catch {} }
      return json(res, { date, slots });
    }
    if (route === '/api/bookings' && req.method === 'GET') { const user = requireUser(req); return json(res, { bookings: allBookings().filter(item => item.phone === user.phone) }); }
    if (route === '/api/bookings' && req.method === 'POST') {
      const user = requireUser(req), input = await body(req); rate('book:' + user.phone, 20, 3600000);
      const key = text(req.headers['idempotency-key'], 100); if (!/^[\w-]{16,100}$/.test(key)) fail('An idempotency key is required.');
      const item = transaction(() => {
        const own = allBookings().filter(item => item.phone === user.phone), repeated = own.find(item => item.requestKey === key); if (repeated) return repeated;
        const completed = own.filter(item => item.status === 'completed').length, cycle = Math.floor(completed / 6);
        const reward = completed % 6 === 5 && !own.some(item => item.rewardCycle === cycle && item.status !== 'cancelled');
        const sum = core.bill(input.services, input.combo, catalog(), data.comboList, reward);
        const item = { id: 'AAI-' + crypto.randomUUID(), requestKey: key, phone: user.phone, name: user.name, services: sum.items.map(item => item.id), combo: sum.combo?.id || null, lineItems: sum.lineItems, subtotal: sum.subtotal, discount: sum.discount, total: sum.total, mins: sum.mins, rewardCycle: reward ? cycle : null,
          stylist: text(input.stylist, 30) || 'any', date: text(input.date, 10), time: text(input.time, 5), notes: text(input.notes, 1000), status: env.AUTO_CONFIRM === 'true' ? 'confirmed' : 'pending', revision: 1, createdAt: clock(), updatedAt: clock() };
        item.assignments = allocation(item);
        const start = core.startsAt(item.date, item.time);
        if (own.some(other => ['pending', 'confirmed'].includes(other.status) && core.overlaps(start, start + item.mins * 60000, core.startsAt(other.date, other.time), core.startsAt(other.date, other.time) + other.mins * 60000))) fail('You already have an appointment during this time.', 409);
        saveBooking(item); changes(item, item.status === 'confirmed' ? 'confirmed' : 'requested'); return item;
      });
      return json(res, { booking: item, notification: 'queued' }, 201);
    }
    const bookingRoute = /^\/api\/bookings\/([^/]+)\/(cancel|reschedule)$/.exec(route);
    if (bookingRoute && req.method === 'POST') {
      const input = await body(req);
      const item = transaction(() => {
        const item = ownedBooking(req, bookingRoute[1]); if (!core.canChange(item, clock())) fail('Appointments can be changed until 4 hours before their start.', 409);
        if (bookingRoute[2] === 'cancel') item.status = 'cancelled';
        else { item.date = text(input.date, 10); item.time = text(input.time, 5); item.assignments = allocation(item, item.id); item.rescheduled = true; }
        item.updatedAt = clock(); item.revision++; saveBooking(item); changes(item, bookingRoute[2] === 'cancel' ? 'cancelled' : 'rescheduled'); return item;
      });
      return json(res, { booking: item, notification: 'queued' });
    }
    if (route === '/api/leads' && req.method === 'POST') {
      const input = await body(req); rate('lead:' + ip, 8, 3600000); if (input.website) return json(res, { ok: true });
      const lead = { id: crypto.randomUUID(), name: text(input.name, 100), phone: phoneNumber(input.phone), type: ['bridal', 'waitlist'].includes(input.type) ? input.type : 'callback', date: text(input.date, 10), package: text(input.package, 100), location: text(input.location, 100), message: text(input.message, 1000), service: text(input.service, 100), status: 'new', createdAt: clock() };
      if (lead.name.length < 2 || (lead.date && (!core.validDate(lead.date) || lead.date < core.todayKey(clock())))) fail('Enter your name and a valid upcoming date.');
      db.prepare('INSERT INTO leads(id,data) VALUES(?,?)').run(lead.id, JSON.stringify(lead));
      return json(res, { id: lead.id, message: 'Your enquiry was saved. The studio will review it.' }, 201);
    }
    if (route.startsWith('/api/admin/')) {
      requireUser(req, true);
      if (route === '/api/admin/overview' && req.method === 'GET') return json(res, { bookings: allBookings(), leads: db.prepare('SELECT data FROM leads').all().map(row => JSON.parse(row.data)), blocks: blocks(), services: catalog(), artists: data.stylistList, hours: openingHours(), notifications: db.prepare('SELECT id,booking,due,attempts,accepted FROM outbox ORDER BY due DESC LIMIT 100').all() });
      if (route === '/api/admin/hours' && req.method === 'PUT') {
        const input = await body(req), hours = input.hours;
        if (!hours || Object.keys(hours).length !== 7 || !Array.from({ length: 7 }, (_, i) => String(i)).every(day => Object.hasOwn(hours, day)) || Object.values(hours).some(pair => pair !== null && (!Array.isArray(pair) || pair.length !== 2 || pair.some(n => !Number.isInteger(n) || n < 0 || n > 24) || pair[0] >= pair[1]))) fail('Provide seven opening-hour entries; use null for a closed day.');
        setSetting('hours', hours); return json(res, { hours });
      }
      const serviceRoute = /^\/api\/admin\/services\/([\w-]+)$/.exec(route);
      if (serviceRoute && req.method === 'PATCH') {
        const input = await body(req), id = serviceRoute[1]; if (!data.serviceList.some(item => item.id === id)) fail('Service not found.', 404);
        if (!Number.isInteger(input.price) || input.price < 1 || input.price > 1000000 || !Number.isInteger(input.mins) || input.mins < 5 || input.mins > 600 || !Number.isInteger(input.offer) || input.offer < 0 || input.offer > 90 || typeof input.available !== 'boolean') fail('Provide a valid price, duration, offer and availability.');
        setSetting('service:' + id, { price: input.price, mins: input.mins, offer: input.offer, available: input.available }); return json(res, { services: catalog() });
      }
      if (route === '/api/admin/blocks' && req.method === 'POST') {
        const input = await body(req), block = { id: crypto.randomUUID(), date: text(input.date, 10), artist: text(input.artist, 30), start: text(input.start, 5), end: text(input.end, 5), reason: text(input.reason, 200) };
        if (!core.validDate(block.date) || !['any', ...data.stylistList.map(item => item.id)].includes(block.artist) || !Number.isFinite(core.minutes(block.start)) || !Number.isFinite(core.minutes(block.end)) || core.minutes(block.start) >= core.minutes(block.end)) fail('Provide a valid date, artist and time range.');
        db.prepare('INSERT INTO blocks(id,data) VALUES(?,?)').run(block.id, JSON.stringify(block)); return json(res, { block }, 201);
      }
      const blockRoute = /^\/api\/admin\/blocks\/([\w-]+)$/.exec(route);
      if (blockRoute && req.method === 'DELETE') { await body(req); db.prepare('DELETE FROM blocks WHERE id=?').run(blockRoute[1]); return json(res, { ok: true }); }
      const leadRoute = /^\/api\/admin\/leads\/([\w-]+)$/.exec(route);
      if (leadRoute && req.method === 'PATCH') {
        const input = await body(req), row = db.prepare('SELECT data FROM leads WHERE id=?').get(leadRoute[1]); if (!row) fail('Enquiry not found.', 404);
        if (!['new', 'contacted', 'waitlist', 'closed'].includes(input.status)) fail('Choose a valid enquiry status.');
        const lead = { ...JSON.parse(row.data), status: input.status }; db.prepare('UPDATE leads SET data=? WHERE id=?').run(JSON.stringify(lead), lead.id); return json(res, { lead });
      }
      const adminBooking = /^\/api\/admin\/bookings\/([\w-]+)$/.exec(route);
      if (adminBooking && req.method === 'PATCH') {
        const input = await body(req);
        const item = transaction(() => {
          const item = ownedBooking(req, adminBooking[1], true); if (!['pending', 'confirmed'].includes(item.status)) fail('This appointment is already closed.', 409);
          if (!['confirmed', 'cancelled', 'completed'].includes(input.status)) fail('Choose a valid appointment status.');
          if (input.status === 'completed' && core.startsAt(item.date, item.time) + item.mins * 60000 > clock()) fail('A future appointment cannot be completed.');
          if (input.status === 'confirmed' && (input.date || input.time || input.stylist)) { item.date = input.date || item.date; item.time = input.time || item.time; item.stylist = input.stylist || item.stylist; item.assignments = allocation(item, item.id); }
          item.status = input.status; item.updatedAt = clock(); item.revision++; saveBooking(item); changes(item, item.status); return item;
        });
        return json(res, { booking: item });
      }
    }
    fail('Endpoint not found.', 404);
  }
  let processing = false;
  async function processOutbox() {
    if (processing || !live) return; processing = true;
    try {
      for (const row of db.prepare('SELECT * FROM outbox WHERE accepted IS NULL AND due<=? AND attempts<8 ORDER BY due LIMIT 20').all(clock())) {
        const event = JSON.parse(row.data);
        if (event.type === 'reminder') {
          const current = db.prepare('SELECT data FROM bookings WHERE id=?').get(row.booking);
          const user = db.prepare('SELECT profile FROM users WHERE phone=?').get(event.phone);
          if (!current || JSON.parse(current.data).status !== 'confirmed' || core.startsAt(event.booking.date, event.booking.time) <= clock() || (user && JSON.parse(user.profile).reminders === false)) { db.prepare('DELETE FROM outbox WHERE id=?').run(row.id); continue; }
        }
        try { await delivery.notify(event); db.prepare('UPDATE outbox SET accepted=?,attempts=attempts+1 WHERE id=?').run(clock(), row.id); }
        catch { db.prepare('UPDATE outbox SET attempts=attempts+1,due=? WHERE id=?').run(clock() + Math.min(86400000, 60000 * 2 ** row.attempts), row.id); }
      }
    } finally { processing = false; }
  }
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
  const publicDirs = new Set(['images', 'icons', 'app', 'admin']);
  const publicFiles = new Set(['index.html', 'services.html', 'bridal.html', 'booking.html', 'offline.html', 'privacy.html', 'style.css', 'refresh.css', 'services.css', 'bridal.css', 'booking.css', 'script.js', 'services.js', 'booking.js', 'data.js', 'core.js', 'client.js', 'runtime-config.js', 'pwa.js', 'sw.js', 'favicon.svg', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml']);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if (publicUrl?.protocol === 'https:') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (url.pathname === '/healthz') return json(res, { ok: true, mode: live ? 'live' : 'demo' });
      if (!['GET', 'HEAD'].includes(req.method)) fail('Method not allowed.', 405);
      if (url.pathname === '/runtime-config.js') { res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-store' }); return res.end('window.AAINA_RUNTIME=' + JSON.stringify({ mode: live ? 'live' : 'demo' }) + ';'); }
      if (url.pathname === '/sitemap.xml' && publicUrl) { res.writeHead(200, { 'Content-Type': mime['.xml'], 'Cache-Control': 'public, max-age=3600' }); return res.end('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ['/', '/services.html', '/bridal.html', '/booking.html'].map(page => '<url><loc>' + core.esc(publicUrl.origin + page) + '</loc></url>').join('') + '</urlset>'); }
      let relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); if (!relative || relative.endsWith('/')) relative += 'index.html';
      if (relative.split('/').some(part => part.startsWith('.')) || relative.includes('\\') || (!publicFiles.has(relative) && !publicDirs.has(relative.split('/')[0]))) fail('Not found.', 404);
      const file = path.resolve(ROOT, relative);
      if (!file.startsWith(ROOT + path.sep) || !mime[path.extname(file)] || !fs.existsSync(file) || !fs.statSync(file).isFile()) fail('Not found.', 404);
      let content = fs.readFileSync(file);
      if (publicUrl && /\.(html|txt)$/.test(relative)) content = Buffer.from(content.toString('utf8').replaceAll('https://strong-cucurucho-858239.netlify.app', publicUrl.origin));
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': relative === 'sw.js' || relative.endsWith('.html') ? 'no-cache' : 'public, max-age=3600' }); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { json(res, { error: error.status ? error.message : 'The request could not be completed. Please try again.' }, error.status || (error.message?.includes('no longer available') ? 409 : 400)); }
  });
  return { server, db, processOutbox, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(() => { db.close(); resolve(); }); }) };
}
if (require.main === module) {
  const studio = createStudio();
  const timer = setInterval(() => studio.processOutbox().catch(() => {}), 60000); timer.unref();
  studio.server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Aaina studio listening on port ' + (process.env.PORT || 3000)));
  const stop = () => { clearInterval(timer); studio.close().then(() => process.exit(0)); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
module.exports = { createStudio };
