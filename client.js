/* Same-origin API client. Live mode never falls back to browser-local confirmations. */
(function () {
  'use strict';
  const core = window.AainaCore;
  let remembered = false;
  try { remembered = localStorage.getItem('aainaLastMode') === 'live'; } catch {}
  const live = window.AAINA_RUNTIME ? window.AAINA_RUNTIME.mode === 'live' : remembered;
  try { localStorage.setItem('aainaLastMode', live ? 'live' : 'demo'); } catch {}
  const api = window.AainaAPI = { live, user: null, config: null };
  async function request(route, options = {}) {
    if (!navigator.onLine) throw Error('You are offline. Reconnect before saving an appointment.');
    const response = await fetch(route, { credentials: 'same-origin', cache: 'no-store', ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    let value; try { value = await response.json(); } catch { throw Error('The studio server is unavailable. Please try again later.'); }
    if (!response.ok) { if (response.status === 401) api.user = null; throw Object.assign(Error(value.error || 'The request failed.'), { status: response.status }); }
    return value;
  }
  api.request = request;
  api.ready = live ? request('/api/config').then(async config => {
    if (config.mode !== 'live') throw Error('Live booking is currently unavailable.');
    api.config = config;
    if (typeof serviceList !== 'undefined') serviceList.splice(0, serviceList.length, ...config.services);
    if (typeof comboList !== 'undefined') comboList.splice(0, comboList.length, ...config.combos);
    if (typeof stylistList !== 'undefined') stylistList.splice(0, stylistList.length, ...config.artists);
    api.user = (await request('/api/me')).user;
    return config;
  }).catch(error => { api.error = error; window.dispatchEvent(new CustomEvent('aaina-api-error', { detail: error.message })); return null; }) : Promise.resolve(null);
  api.ensureUser = async function (defaults = {}) {
    await api.ready;
    if (api.error) throw api.error;
    if (api.user) return api.user;
    return new Promise((resolve, reject) => {
      const modal = document.createElement('dialog');
      modal.className = 'account-dialog';
      modal.setAttribute('aria-labelledby', 'accountTitle');
      modal.innerHTML = '<form id="accountForm"><h2 id="accountTitle">Verify your phone</h2><p>Access your appointments securely from any device.</p><label>Your name<input name="name" autocomplete="name" required minlength="2" maxlength="100"></label><label>Mobile number<input name="phone" type="tel" autocomplete="tel-national" required pattern="[6-9][0-9]{9}" maxlength="10"></label><label hidden id="codeField">Verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" maxlength="8"></label><p id="accountError" role="alert"></p><div class="account-actions"><button type="button" data-account-close>Cancel</button><button type="submit" class="btn btn-wine">Send code</button></div><p><a href="/privacy.html">How we use your details</a></p></form>';
      document.body.appendChild(modal);
      const form = modal.querySelector('form'), submit = form.querySelector('[type=submit]'), errorBox = form.querySelector('[role=alert]');
      form.elements.name.value = defaults.name || '';
      const digits = String(defaults.phone || '').replace(/\D/g, '');
      form.elements.phone.value = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
      let challenge = null, finished = false;
      modal.addEventListener('close', () => { modal.remove(); if (!finished) reject(Error('Phone verification was cancelled.')); });
      modal.querySelector('[data-account-close]').addEventListener('click', () => modal.close());
      form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true; errorBox.textContent = '';
        try {
          if (!challenge) {
            const result = await request('/api/auth/request', { method: 'POST', body: { name: form.elements.name.value, phone: form.elements.phone.value } });
            challenge = result.challenge;
            form.elements.name.readOnly = true; form.elements.phone.readOnly = true;
            modal.querySelector('#codeField').hidden = false; form.elements.code.required = true;
            submit.textContent = 'Verify and sign in'; form.elements.code.focus();
          } else {
            api.user = (await request('/api/auth/verify', { method: 'POST', body: { challenge, code: form.elements.code.value } })).user;
            finished = true; modal.close(); window.dispatchEvent(new Event('aaina-session')); resolve(api.user);
          }
        } catch (error) { errorBox.textContent = error.message; }
        finally { submit.disabled = false; }
      });
      modal.showModal();
    });
  };
  api.logout = async () => { await request('/api/auth/logout', { method: 'POST', body: {} }); api.user = null; window.dispatchEvent(new Event('aaina-session')); };
  api.bookings = async () => (await request('/api/bookings')).bookings;
  api.createBooking = async (value, key) => (await request('/api/bookings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: value })).booking;
  api.changeBooking = async (id, action, body = {}) => (await request('/api/bookings/' + encodeURIComponent(id) + '/' + action, { method: 'POST', body })).booking;
  api.lead = value => request('/api/leads', { method: 'POST', body: value });
  const schedules = new Map();
  api.clearSchedule = () => schedules.clear();
  api.schedule = (query, refresh) => {
    const key = JSON.stringify(query), cached = schedules.get(key);
    if (cached && Date.now() - cached.at < 15000) return cached.slots;
    schedules.set(key, { at: Date.now(), slots: null });
    api.ready.then(() => {
      if (api.error) throw api.error;
      return request('/api/slots?' + new URLSearchParams(query));
    }).then(result => { schedules.set(key, { at: Date.now(), slots: result.slots }); refresh(); })
      .catch(error => { schedules.set(key, { at: Date.now(), slots: [] }); if (typeof showToast === 'function') showToast(error.message); refresh(); });
    return null;
  };
  api.uuid = () => crypto.randomUUID();
  api.calendar = booking => {
    const url = URL.createObjectURL(new Blob([core.calendar(booking)], { type: 'text/calendar' }));
    const link = document.createElement('a'); link.href = url; link.download = 'aaina-' + booking.id + '.ics'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  function notice(message) {
    let banner = document.querySelector('#systemNotice');
    if (!banner) { banner = document.createElement('p'); banner.id = 'systemNotice'; banner.className = 'system-notice'; banner.setAttribute('role', 'status'); document.body.prepend(banner); }
    banner.textContent = message;
  }
  window.addEventListener('aaina-storage-error', () => notice('Your browser could not save these demo changes. They may be lost when you leave this page.'));
  window.addEventListener('aaina-api-error', event => notice(event.detail));
  api.ready.then(() => {
    if (api.error) notice(api.error.message);
    document.querySelectorAll('[data-demo-mode]').forEach(node => { node.hidden = live; });
    if (live && document.querySelector('.stage-note')) document.querySelector('.stage-note').innerHTML = 'Aaina Beauty Studio · Your appointments, together. <a href="../index.html">Open the website</a>';
    if (live) document.querySelectorAll('.demo-note').forEach(node => { node.textContent = 'Submitting an enquiry saves your details for studio review. Sending a WhatsApp message is a separate action.'; });
    if (live && document.querySelector('#trialDone > p')) document.querySelector('#trialDone > p').textContent = 'Your enquiry is saved for the studio to review.';
  });
})();
