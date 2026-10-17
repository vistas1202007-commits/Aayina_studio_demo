'use strict';
const $ = selector => document.querySelector(selector), esc = AainaCore.esc;
let state = null, panel = 'calendar', calendarView = 'week', selectedDate = AainaCore.todayKey(), selectedArtist = 'any', editing = null;
const money = amount => '₹' + amount.toLocaleString('en-IN');
const day = key => new Date(key + 'T00:00:00Z');
const add = (key, count) => new Date(+day(key) + count * 86400000).toISOString().slice(0, 10);
const title = key => day(key).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
$('#today').textContent = title(selectedDate);
function message(value) { $('#deskMessage').hidden = !value; $('#deskMessage').textContent = value || ''; }
function demoState() {
  return { services: serviceList, artists: stylistList, hours: AainaCore.hours, blocks: [], leads: [{ id: 'sample-lead', name: 'Meera Kapoor', phone: 'Demo customer', type: 'bridal', date: add(selectedDate, 30), package: 'Royal Bride', message: 'A consultation for a winter wedding.', status: 'new' }], notifications: [],
    bookings: [{ id: 'sample-1', name: 'Ananya Sharma', phone: 'Demo customer', services: ['hair-spa'], stylist: 'riya', date: selectedDate, time: '11:00', mins: 60, total: 639, status: 'confirmed', notes: 'A little time for herself.' }, { id: 'sample-2', name: 'Meera Kapoor', phone: 'Demo customer', services: ['party-makeup'], stylist: 'naina', date: selectedDate, time: '14:30', mins: 60, total: 1499, status: 'pending' }, { id: 'sample-3', name: 'Sana Ali', phone: 'Demo customer', services: ['manicure'], stylist: 'simran', date: add(selectedDate, 1), time: '12:00', mins: 40, total: 499, status: 'confirmed' }] };
}
async function loadDesk() {
  await AainaAPI.ready;
  if (AainaAPI.error) { message(AainaAPI.error.message); return; }
  if (!AainaAPI.live) { state = state || demoState(); message('Studio desk preview. These are sample appointments; changes stay in this page only.'); }
  else {
    if (!AainaAPI.user || AainaAPI.user.role !== 'admin') { $('#authPanel').hidden = false; $('#workspace').hidden = true; if (AainaAPI.user) message('Your verified account is not on the studio administrator list.'); return; }
    state = await AainaAPI.request('/api/admin/overview'); $('#logout').hidden = false;
  }
  $('#authPanel').hidden = true; $('#workspace').hidden = false; render();
}
function stats() {
  const today = state.bookings.filter(item => item.date === AainaCore.todayKey() && item.status !== 'cancelled');
  const values = [[today.length, 'Appointments today', 'A little care, beautifully planned'], [state.bookings.filter(item => item.status === 'pending').length, 'Awaiting confirmation', 'Requests for your attention'], [state.leads.filter(item => item.status === 'new').length, 'New enquiries', 'Start a conversation'], [money(today.filter(item => item.status === 'completed').reduce((sum, item) => sum + item.total, 0)), 'Completed services today', 'Value of completed appointments']];
  $('#stats').innerHTML = values.map(([value, label, note]) => '<article class="stat"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(note) + '</small></article>').join('');
}
function appointment(item) {
  const names = item.lineItems ? item.lineItems.map(line => line.name).join(' + ') : item.services.map(id => serviceList.find(service => service.id === id)?.name || id).join(' + ');
  const artist = stylistList.find(artist => artist.id === item.stylist)?.name || 'Team appointment';
  return '<button class="appointment ' + esc(item.status) + '" data-booking="' + esc(item.id) + '"><span>' + esc(item.time) + ' · ' + item.mins + ' min</span><b>' + esc(item.name) + '</b><span>' + esc(names) + '</span><small>' + esc(artist) + ' · ' + esc(item.status) + '</small></button>';
}
function calendar() {
  const weekday = day(selectedDate).getUTCDay(), start = add(selectedDate, -(weekday === 0 ? 6 : weekday - 1));
  const dates = calendarView === 'week' ? Array.from({ length: 7 }, (_, i) => add(start, i)) : [selectedDate];
  const rows = state.bookings.filter(item => selectedArtist === 'any' || item.stylist === selectedArtist || item.assignments?.some(segment => segment.artist === selectedArtist));
  return '<div class="desk-toolbar"><div><p class="eyebrow">THE WEEK, AT A GLANCE</p><h2>Your appointment book</h2><p>' + title(dates[0]) + (dates.length > 1 ? ' — ' + title(dates[6]) : '') + '</p></div><div class="desk-controls"><button data-shift="-1" aria-label="Previous period">←</button><button data-shift="1" aria-label="Next period">→</button><input type="date" id="calendarDate" aria-label="Calendar date" value="' + selectedDate + '"><select id="artistFilter" aria-label="Filter by artist"><option value="any">All artists</option>' + stylistList.map(artist => '<option value="' + artist.id + '" ' + (selectedArtist === artist.id ? 'selected' : '') + '>' + esc(artist.name.split(' ')[0]) + '</option>').join('') + '</select><button data-view="day" class="' + (calendarView === 'day' ? 'active' : '') + '">Day</button><button data-view="week" class="' + (calendarView === 'week' ? 'active' : '') + '">Week</button></div></div><div class="table-scroll"><div class="' + (calendarView === 'week' ? 'week-grid' : 'day-list') + '">' + dates.map(date => {
    const list = rows.filter(item => item.date === date).sort((a, b) => a.time.localeCompare(b.time));
    return '<section class="week-day ' + (date === AainaCore.todayKey() ? 'is-today' : '') + '"><div class="day-heading"><span>' + day(date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) + '</span><strong>' + day(date).getUTCDate() + '</strong></div>' + (list.length ? list.map(appointment).join('') : '<p class="calendar-empty">Space to breathe</p>') + '</section>';
  }).join('') + '</div></div>';
}
function leads() {
  return '<div class="desk-toolbar"><div><p class="eyebrow">NEW CONVERSATIONS</p><h2>Enquiries & bridal plans</h2></div></div><div class="table-scroll"><table><thead><tr><th>Client</th><th>Enquiry</th><th>Details</th><th>Status</th></tr></thead><tbody>' + state.leads.map(lead => '<tr><td><b>' + esc(lead.name) + '</b><small>' + esc(lead.phone) + '</small></td><td>' + esc(lead.type) + '<small>' + esc(lead.date || '') + '</small></td><td>' + esc(lead.package || lead.service || '') + '<small>' + esc(lead.message || '') + '</small></td><td><select data-lead="' + esc(lead.id) + '" aria-label="Status for ' + esc(lead.name) + '">' + ['new', 'contacted', 'waitlist', 'closed'].map(status => '<option ' + (lead.status === status ? 'selected' : '') + '>' + status + '</option>').join('') + '</select></td></tr>').join('') + '</tbody></table>' + (!state.leads.length ? '<p>No enquiries yet. New website enquiries will appear here.</p>' : '') + '</div>';
}
function services() {
  return '<div class="desk-toolbar"><div><p class="eyebrow">LITTLE RITUALS, CLEAR PRICES</p><h2>Your service menu</h2><p>Updates apply to new appointments. Existing price snapshots are preserved.</p></div></div><div class="table-scroll"><table><thead><tr><th>Service</th><th>Price ₹</th><th>Minutes</th><th>Offer %</th><th>Available</th><th></th></tr></thead><tbody>' + state.services.map(item => '<tr data-service-row="' + item.id + '"><td><b>' + esc(item.name) + '</b><small>' + esc(item.cat) + '</small></td><td><input data-value="price" type="number" min="1" max="1000000" value="' + item.price + '" aria-label="Price for ' + esc(item.name) + '"></td><td><input data-value="mins" type="number" min="5" max="600" value="' + item.mins + '" aria-label="Duration for ' + esc(item.name) + '"></td><td><input data-value="offer" type="number" min="0" max="90" value="' + (item.offer || 0) + '" aria-label="Offer for ' + esc(item.name) + '"></td><td><input data-value="available" type="checkbox" ' + (item.available !== false ? 'checked' : '') + ' aria-label="Availability for ' + esc(item.name) + '"></td><td><button class="btn btn-line btn-sm" data-save-service="' + item.id + '">Save</button></td></tr>').join('') + '</tbody></table></div>';
}
function schedule() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return '<p class="eyebrow">MAKE ROOM FOR YOUR TEAM</p><h2>Hours, holidays & artist leave</h2><form id="hoursForm">' + days.map((name, index) => '<div class="hours-row" data-day="' + index + '"><span>' + name + '</span><input data-open type="number" min="0" max="23" value="' + (state.hours[index]?.[0] || 10) + '" aria-label="' + name + ' opening hour"><input data-close type="number" min="1" max="24" value="' + (state.hours[index]?.[1] || 20) + '" aria-label="' + name + ' closing hour"><label><input data-closed type="checkbox" ' + (!state.hours[index] ? 'checked' : '') + '> Closed</label></div>').join('') + '<button class="btn btn-wine btn-sm">Save opening hours</button></form><h3>Add a holiday or time away</h3><form id="blockForm"><label>Date<input name="date" type="date" required></label><label>Artist<select name="artist"><option value="any">Entire studio</option>' + stylistList.map(artist => '<option value="' + artist.id + '">' + esc(artist.name) + '</option>').join('') + '</select></label><label>Reason<input name="reason" maxlength="200" placeholder="Holiday, lunch, personal leave"></label><label>From<input name="start" type="time" value="10:00" required></label><label>Until<input name="end" type="time" value="20:00" required></label><button class="btn btn-line btn-sm">Block time</button></form><div class="table-scroll"><table><thead><tr><th>Date</th><th>Artist</th><th>Time</th><th>Reason</th><th></th></tr></thead><tbody>' + state.blocks.map(block => '<tr><td>' + esc(block.date) + '</td><td>' + esc(block.artist) + '</td><td>' + esc(block.start + '–' + block.end) + '</td><td>' + esc(block.reason) + '</td><td><button data-remove-block="' + block.id + '">Remove block</button></td></tr>').join('') + '</tbody></table></div>';
}
function notifications() {
  return '<p class="eyebrow">KEEP EVERYONE IN THE LOOP</p><h2>Notification delivery</h2><p>Provider acceptance means the delivery service accepted the event. It does not confirm receipt by a customer.</p><div class="table-scroll"><table><thead><tr><th>Event</th><th>Next attempt</th><th>Attempts</th><th>State</th></tr></thead><tbody>' + state.notifications.map(item => '<tr><td>' + esc(item.id) + '</td><td>' + esc(new Date(item.due).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })) + '</td><td>' + item.attempts + '</td><td>' + (item.accepted ? 'Provider accepted' : item.attempts >= 8 ? 'Needs attention' : 'Queued') + '</td></tr>').join('') + '</tbody></table></div>';
}
function render() {
  stats(); document.querySelectorAll('[data-panel]').forEach(button => button.classList.toggle('active', button.dataset.panel === panel));
  $('#content').innerHTML = ({ calendar, leads, services, schedule, notifications })[panel]();
}
async function mutate(route, method, body, demo) {
  if (AainaAPI.live) await AainaAPI.request(route, { method, body });
  else demo?.();
  await loadDesk();
  if (AainaAPI.live) message('Changes saved.');
}
document.addEventListener('click', async event => {
  const target = event.target.closest('button'); if (!target) return;
  try {
    if (target.dataset.panel) { panel = target.dataset.panel; if (state) render(); }
    if (target.dataset.view) { calendarView = target.dataset.view; render(); }
    if (target.dataset.shift) { selectedDate = add(selectedDate, Number(target.dataset.shift) * (calendarView === 'week' ? 7 : 1)); render(); }
    if (target.dataset.booking) {
      editing = state.bookings.find(item => item.id === target.dataset.booking);
      $('#editTitle').textContent = editing.name; $('#bookingInfo').textContent = editing.services.map(id => serviceList.find(item => item.id === id)?.name || id).join(' + ') + ' · ' + money(editing.total) + '\n' + editing.phone + '\n' + (editing.notes || '');
      const form = $('#bookingForm'); form.elements.date.value = editing.date; form.elements.time.value = editing.time;
      form.elements.stylist.innerHTML = '<option value="any">Any qualified artist</option>' + stylistList.map(artist => '<option value="' + artist.id + '">' + esc(artist.name) + '</option>').join(''); form.elements.stylist.value = editing.stylist;
      form.querySelector('[role=alert]').textContent = ''; $('#editBooking').showModal();
    }
    if (target.hasAttribute('data-close')) $('#editBooking').close();
    if (target.dataset.saveService) {
      const row = target.closest('tr'), value = {};
      row.querySelectorAll('[data-value]').forEach(input => { value[input.dataset.value] = input.type === 'checkbox' ? input.checked : Number(input.value); });
      await mutate('/api/admin/services/' + target.dataset.saveService, 'PATCH', value, () => Object.assign(state.services.find(item => item.id === target.dataset.saveService), value));
    }
    if (target.dataset.removeBlock) await mutate('/api/admin/blocks/' + target.dataset.removeBlock, 'DELETE', {}, () => { state.blocks = state.blocks.filter(item => item.id !== target.dataset.removeBlock); });
  } catch (error) { message(error.message); }
});
document.addEventListener('change', async event => {
  try {
    if (event.target.id === 'calendarDate' && AainaCore.validDate(event.target.value)) { selectedDate = event.target.value; render(); }
    if (event.target.id === 'artistFilter') { selectedArtist = event.target.value; render(); }
    if (event.target.dataset.lead) await mutate('/api/admin/leads/' + event.target.dataset.lead, 'PATCH', { status: event.target.value }, () => { state.leads.find(item => item.id === event.target.dataset.lead).status = event.target.value; });
  } catch (error) { message(error.message); }
});
document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target;
  try {
    if (form.id === 'bookingForm') {
      const value = Object.fromEntries(new FormData(form));
      await mutate('/api/admin/bookings/' + editing.id, 'PATCH', value, () => Object.assign(editing, value)); $('#editBooking').close();
    }
    if (form.id === 'hoursForm') {
      const hours = {}; form.querySelectorAll('[data-day]').forEach(row => { hours[row.dataset.day] = row.querySelector('[data-closed]').checked ? null : [Number(row.querySelector('[data-open]').value), Number(row.querySelector('[data-close]').value)]; });
      await mutate('/api/admin/hours', 'PUT', { hours }, () => { state.hours = hours; });
    }
    if (form.id === 'blockForm') { const value = Object.fromEntries(new FormData(form)); await mutate('/api/admin/blocks', 'POST', value, () => state.blocks.push({ ...value, id: crypto.randomUUID() })); }
  } catch (error) { const box = form.querySelector('[role=alert]'); if (box) box.textContent = error.message; else message(error.message); }
});
$('#signIn').addEventListener('click', async () => { try { await AainaAPI.ensureUser(); await loadDesk(); } catch (error) { message(error.message); } });
$('#logout').addEventListener('click', async () => { try { await AainaAPI.logout(); state = null; await loadDesk(); } catch (error) { message(error.message); } });
loadDesk().catch(error => message(error.message));
