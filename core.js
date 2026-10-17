/* Shared, side-effect-free booking rules used by both interfaces and the API. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AainaCore = factory();
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const policy = Object.freeze({ cancellationHours: 4, leadMinutes: 60, horizonDays: 90, rewardPercent: 25 });
  const hours = { 0: [11, 18], 1: [10, 20], 2: [10, 20], 3: [10, 20], 4: [10, 20], 5: [10, 20], 6: [10, 20] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const minutes = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;
  const timeKey = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }
  const startsAt = (date, time) => validDate(date) && Number.isFinite(minutes(time)) ? Date.parse(date + 'T' + time + ':00+05:30') : NaN;
  const todayKey = (now = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  function openStatus(openingHours = hours, now = Date.now(), closures = []) {
    const date = todayKey(now), day = new Date(date + 'T00:00:00Z').getUTCDay();
    const elapsed = (now - startsAt(date, '00:00')) / 3600000;
    const pair = openingHours[day];
    const fmt = hour => (hour % 12 || 12) + (hour >= 12 ? ' PM' : ' AM');
    if (closures.some(item => item.date === date && elapsed * 60 >= minutes(item.start) && elapsed * 60 < minutes(item.end))) return { open: false, text: 'Studio break · Contact us for availability' };
    if (pair && elapsed >= pair[0] && elapsed < pair[1]) return { open: true, text: 'Open now · Closes ' + fmt(pair[1]) };
    if (pair && elapsed < pair[0]) return { open: false, text: 'Closed · Opens today ' + fmt(pair[0]) };
    for (let offset = 1; offset <= 7; offset++) {
      const next = openingHours[(day + offset) % 7];
      if (next) return { open: false, text: 'Closed · Opens ' + (offset === 1 ? 'tomorrow' : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][(day + offset) % 7]) + ' ' + fmt(next[0]) };
    }
    return { open: false, text: 'Closed · Contact the studio' };
  }
  const priceOf = item => Math.round(item.price * (1 - (item.offer || 0) / 100));
  function bill(ids, comboId, catalog, combos, reward = false) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw Error('Choose at least one service, without duplicates.');
    const items = ids.map(id => catalog.find(item => item.id === id));
    if (items.some(item => !item || item.bridal || item.available === false)) throw Error('One of these services is unavailable.');
    const subtotal = items.reduce((sum, item) => sum + priceOf(item), 0);
    const combo = combos.find(item => item.id === comboId && item.ids.every(id => ids.includes(id)));
    // An individual offer and combo discount cannot be stacked on the same item.
    const comboBase = combo ? combo.ids.reduce((sum, id) => sum + catalog.find(item => item.id === id).price, 0) : 0;
    const comboCurrent = combo ? combo.ids.reduce((sum, id) => sum + priceOf(catalog.find(item => item.id === id)), 0) : 0;
    const comboOff = combo ? Math.max(0, comboCurrent - (comboBase - Math.round(comboBase * combo.percent / 100))) : 0;
    const rewardOff = reward ? Math.round((subtotal - comboOff) * policy.rewardPercent / 100) : 0;
    return { items, subtotal, mins: items.reduce((sum, item) => sum + item.mins, 0), combo, comboOff, reward: rewardOff, discount: comboOff + rewardOff, total: subtotal - comboOff - rewardOff,
      lineItems: items.map(item => ({ id: item.id, name: item.name, cat: item.cat, mins: item.mins, price: priceOf(item) })) };
  }
  const overlaps = (start, end, otherStart, otherEnd) => start < otherEnd && end > otherStart;
  function allocation({ date, time, services, stylist = 'any', catalog, artists, bookings = [], blocks = [], openingHours = hours, now = Date.now(), excludeId = null }) {
    const start = minutes(time);
    const at = startsAt(date, time);
    const today = startsAt(todayKey(now), '00:00');
    if (!Number.isFinite(at) || at < now + policy.leadMinutes * 60000 || at > today + policy.horizonDays * 86400000) throw Error('Choose a future appointment within the next 90 days, at least an hour ahead.');
    const dayHours = openingHours[new Date(date + 'T00:00:00Z').getUTCDay()];
    if (!Array.isArray(dayHours) || dayHours.length !== 2) throw Error('The studio is closed on this day.');
    const picked = services.map(id => catalog.find(item => item.id === id));
    if (!picked.length || picked.some(item => !item || item.bridal || item.available === false)) throw Error('Choose available salon services.');
    if (stylist !== 'any' && !artists.some(artist => artist.id === stylist && picked.some(item => artist.cats.includes(item.cat)))) throw Error('Choose an artist who offers your selected services.');
    const total = picked.reduce((sum, item) => sum + item.mins, 0);
    if (start < dayHours[0] * 60 || start + total > dayHours[1] * 60) throw Error('Your services must fit within opening hours.');
    const occupied = bookings.filter(item => item.id !== excludeId && ['pending', 'confirmed'].includes(item.status) && item.date === date);
    let cursor = start;
    return picked.map(item => {
      const end = cursor + item.mins;
      let candidates = artists.filter(artist => artist.cats.includes(item.cat));
      if (stylist !== 'any' && candidates.some(artist => artist.id === stylist)) candidates = candidates.filter(artist => artist.id === stylist);
      const artist = candidates.find(candidate => {
        if (blocks.some(block => block.date === date && (block.artist === 'any' || block.artist === candidate.id) && overlaps(cursor, end, minutes(block.start || '00:00'), minutes(block.end || '23:59')))) return false;
        return !occupied.some(booking => {
          const segments = booking.assignments?.length ? booking.assignments : [{ artist: booking.stylist || 'any', start: minutes(booking.time), end: minutes(booking.time) + booking.mins }];
          return segments.some(segment => (segment.artist === 'any' || segment.artist === candidate.id) && overlaps(cursor, end, segment.start, segment.end));
        });
      });
      if (!artist) throw Error('That time is no longer available for all selected services. Choose another slot.');
      const segment = { service: item.id, artist: artist.id, start: cursor, end };
      cursor = end;
      return segment;
    });
  }
  function canChange(booking, now = Date.now()) {
    return ['pending', 'confirmed'].includes(booking.status) && startsAt(booking.date, booking.time) - now >= policy.cancellationHours * 3600000;
  }
  function rewardAvailable(bookings) {
    const completed = bookings.filter(item => item.status === 'completed').length;
    const cycle = Math.floor(completed / 6);
    return completed % 6 === 5 && !bookings.some(item => item.rewardCycle === cycle && item.status !== 'cancelled');
  }
  function readStore(key, fallback, store) {
    try {
      const value = JSON.parse((store || localStorage).getItem(key));
      if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
      if (fallback && typeof fallback === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
        if ('services' in fallback && !Array.isArray(value.services)) return fallback;
        return value;
      }
      return typeof value === typeof fallback && value !== null ? value : fallback;
    } catch { return fallback; }
  }
  function writeStore(key, value, store) {
    try { (store || localStorage).setItem(key, JSON.stringify(value)); return true; }
    catch { if (typeof window !== 'undefined') window.dispatchEvent(new Event('aaina-storage-error')); return false; }
  }
  function validBookings(list, catalog, artists = []) {
    return Array.isArray(list) ? list.filter(item => item && /^AAI-[a-zA-Z0-9-]{4,50}$/.test(item.id || '') && typeof item.name === 'string' && typeof item.phone === 'string' && validDate(item.date) && Number.isFinite(minutes(item.time)) && Number.isFinite(item.mins) && item.mins > 0 && Number.isFinite(item.total) && item.total >= 0 && Array.isArray(item.services) && item.services.length && new Set(item.services).size === item.services.length && item.services.every(id => catalog.some(service => service.id === id)) && (!artists.length || item.stylist === 'any' || artists.some(artist => artist.id === item.stylist)) && ['pending', 'confirmed', 'completed', 'cancelled'].includes(item.status)) : [];
  }
  function calendar(booking, location = 'Aaina Beauty Studio') {
    const stamp = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const clean = text => String(text).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, '\\$&');
    const at = startsAt(booking.date, booking.time);
    if (!Number.isFinite(at)) throw Error('This appointment has no valid date and time.');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Aaina//Appointments//EN', 'BEGIN:VEVENT', `UID:${clean(booking.id)}@aaina`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(at)}`, `DTEND:${stamp(at + booking.mins * 60000)}`, `SUMMARY:${clean('Aaina Beauty Studio - ' + booking.id)}`, `LOCATION:${clean(location)}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  }
  return { policy, hours, esc, minutes, timeKey, validDate, startsAt, todayKey, openStatus, priceOf, bill, overlaps, allocation, canChange, rewardAvailable, readStore, writeStore, validBookings, calendar };
});
