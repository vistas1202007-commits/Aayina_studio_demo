'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js'), data = require('../data.js');
const now = Date.parse('2030-01-01T00:00:00Z');
const base = { date: '2030-01-02', time: '14:00', services: ['global-colour'], stylist: 'riya', catalog: data.serviceList, artists: data.stylistList, now };
test('appointments occupy their full duration, while different artists remain available', () => {
  const assignments = core.allocation(base);
  const bookings = [{ id: 'first', status: 'confirmed', date: base.date, time: base.time, mins: 120, stylist: 'riya', assignments }];
  assert.throws(() => core.allocation({ ...base, time: '14:30', bookings }), /no longer available/);
  assert.doesNotThrow(() => core.allocation({ ...base, time: '16:00', bookings }));
  assert.doesNotThrow(() => core.allocation({ ...base, services: ['party-makeup'], stylist: 'naina', bookings }));
});
test('mixed-category appointments assign every service to a qualified artist', () => {
  const assignment = core.allocation({ ...base, services: ['blowout-curls', 'party-makeup', 'gel-polish'], stylist: 'any' });
  assert.deepEqual(assignment.map(item => item.artist), ['riya', 'naina', 'simran']);
  assert.equal(assignment[1].start, assignment[0].end);
  assert.throws(() => core.allocation({ ...base, stylist: 'naina' }), /artist/);
});
test('closures, leave, opening hours, stale times and invalid dates are rejected', () => {
  assert.throws(() => core.allocation({ ...base, blocks: [{ date: base.date, artist: 'riya', start: '14:30', end: '15:00' }] }), /no longer available/);
  assert.throws(() => core.allocation({ ...base, openingHours: { 3: null } }), /closed/);
  assert.throws(() => core.allocation({ ...base, time: '19:30' }), /opening hours/);
  assert.throws(() => core.allocation({ ...base, date: '2030-02-30' }), /future/);
  assert.throws(() => core.allocation({ ...base, time: null }), /future/);
  assert.throws(() => core.allocation({ ...base, date: '2029-12-31' }), /future/);
  assert.equal(core.todayKey(Date.parse('2030-01-01T20:00:00Z')), '2030-01-02');
});
test('a booking being rescheduled excludes only itself', () => {
  const assignments = core.allocation(base), booking = { id: 'first', status: 'confirmed', date: base.date, assignments };
  assert.doesNotThrow(() => core.allocation({ ...base, bookings: [booking], excludeId: 'first' }));
  assert.throws(() => core.allocation({ ...base, bookings: [booking], excludeId: 'someone-else' }), /no longer available/);
});
test('pricing, rewards, combo non-stacking and snapshot line items are shared', () => {
  const sum = core.bill(['glow-facial'], null, data.serviceList, data.comboList, true);
  assert.equal(sum.total, 749); assert.equal(sum.lineItems[0].price, 999);
  const menu = [{ id: 'x', name: 'X', cat: 'hair', price: 1000, mins: 30, offer: 20 }];
  const combo = [{ id: 'c', ids: ['x'], percent: 10 }];
  assert.equal(core.bill(['x'], 'c', menu, combo).total, 800);
  assert.throws(() => core.bill(['x', 'x'], null, menu, combo), /duplicates/);
});
test('four-hour cancellation boundary is enforced', () => {
  const item = { status: 'confirmed', date: base.date, time: '14:00' }, start = core.startsAt(item.date, item.time);
  assert.equal(core.canChange(item, start - 4 * 3600000), true);
  assert.equal(core.canChange(item, start - 4 * 3600000 + 1), false);
  assert.equal(core.canChange({ ...item, status: 'completed' }, now), false);
});
test('malformed storage shapes recover and failed writes are observable', () => {
  for (const raw of ['null', '{}', '"bad"', 'invalid']) assert.deepEqual(core.readStore('key', [], { getItem: () => raw }), []);
  assert.deepEqual(core.readStore('key', { services: [] }, { getItem: () => '{"services":"bad"}' }), { services: [] });
  assert.equal(core.writeStore('key', [], { setItem: () => { throw Error('quota'); } }), false);
  assert.deepEqual(core.validBookings([null, {}, { id: 'x', services: [] }], data.serviceList), []);
});
test('HTML escaping and calendar export preserve text and Indian appointment time', () => {
  assert.equal(core.esc('<img src=x onerror="run()">'), '&lt;img src=x onerror=&quot;run()&quot;&gt;');
  const ics = core.calendar({ id: 'AAI-1', date: base.date, time: '14:00', mins: 120 }, 'Studio, Lucknow');
  assert.match(ics, /DTSTART:20300102T083000Z/); assert.match(ics, /DTEND:20300102T103000Z/);
  assert.ok(ics.includes('LOCATION:Studio\\, Lucknow'));
});
test('studio opening status uses Indian time and handles closed days and breaks', () => {
  const time = Date.parse('2030-01-02T05:30:00Z'); // Wednesday 11 AM IST
  assert.equal(core.openStatus(core.hours, time).open, true);
  assert.equal(core.openStatus({ ...core.hours, 3: null }, time).open, false);
  assert.equal(core.openStatus(core.hours, time, [{ date: '2030-01-02', start: '10:00', end: '12:00' }]).open, false);
  assert.match(core.openStatus(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, null])), time).text, /Contact/);
});
