/* Shared site interactions. Live enquiries use client.js; demo actions stay explicitly local. */

/* ---------- contact details ---------- */
// WhatsApp messages made by the scripts use these. The html files also have the number in tel: and wa.me links.
const studioContact = { whatsapp: '918791272440', phoneText: '+91 87912 72440' };
const siteIntro = 'Hi! I am booking through the Aaina Beauty Studio demo website.';

function whatsappUrl(message) {
  return 'https://wa.me/' + studioContact.whatsapp + '?text=' + encodeURIComponent(message);
}

/* ---------- icons ---------- */

const iconSet = {
  'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  'whatsapp': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/><path d="M9 9.5c.3 2 2.5 4.2 5 5l1.3-1.3-1.8-1-.9.7a4 4 0 0 1-1.7-1.7l.7-.9-1-1.8z"/>',
  'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'close': '<path d="M6 6l12 12M18 6 6 18"/>',
  'check': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  'pin': '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'instagram': '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  'shield': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  'sparkle': '<path d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6z"/><path d="M19 15v4M17 17h4"/>',
  'wind': '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',
  'tick': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  'calendar': '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  'heart': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  'search': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  'plus': '<path d="M12 5v14M5 12h14"/>',
  'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  'mandala': '<circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="4"/><ellipse cx="32" cy="15" rx="4" ry="8"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(45 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(90 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(135 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(180 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(225 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(270 32 32)"/><ellipse cx="32" cy="15" rx="4" ry="8" transform="rotate(315 32 32)"/>'
};

const spriteMarkup = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' +
  Object.entries(iconSet).map(([id, paths]) => `<symbol id="${id}" viewBox="${id === 'mandala' ? '0 0 64 64' : '0 0 24 24'}">${paths}</symbol>`).join('') +
  '</svg>';
document.body.insertAdjacentHTML('afterbegin', spriteMarkup);

/* ---------- small helpers ---------- */

const toastBox = document.querySelector('#toast');
let toastTimer;

function showToast(message) {
  if (!toastBox) return;
  toastBox.textContent = message;
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), 3200);
}

// links that would need a real account/page get a demo message
document.querySelectorAll('[data-demo]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    showToast(link.dataset.demo);
  });
});

/* ---------- navigation ---------- */

const mobileMenu = document.querySelector('#mobileMenu');
const burger = document.querySelector('.nav-actions .burger');

function setMenu(open) {
  if (!mobileMenu) return;
  if (open && !mobileMenu.open) mobileMenu.showModal();
  if (!open && mobileMenu.open) mobileMenu.close();
  mobileMenu.classList.toggle('open', open);
  mobileMenu.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
}

if (burger) burger.addEventListener('click', () => setMenu(true));
if (mobileMenu) mobileMenu.addEventListener('cancel', () => setMenu(false));
document.querySelectorAll('[data-close-menu], .mobile-menu a').forEach(el => {
  el.addEventListener('click', () => setMenu(false));
});

// highlight the current page in the menu
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.menu a').forEach(link => {
  const href = link.getAttribute('href');
  if (!href.includes('#') && href === currentPage) link.classList.add('active');
});

/* ---------- open now badge + today's hours ---------- */

// opening hours by weekday (0 = Sunday), 24h clock
const hours = {
  0: [11, 18], 1: [10, 20], 2: [10, 20], 3: [10, 20],
  4: [10, 20], 5: [10, 20], 6: [10, 20]
};

function formatHour(h) {
  return (h % 12 || 12) + (h >= 12 ? ' PM' : ' AM');
}

function getStatus() { return AainaCore.openStatus(AainaAPI.config?.hours || hours, Date.now(), AainaAPI.config?.closures || []); }

function refreshOpenBadges() {
  const status = getStatus();
  document.querySelectorAll('[data-open]').forEach(badge => { badge.querySelector('b').textContent = status.text; badge.classList.toggle('closed', !status.open); });
}
refreshOpenBadges(); AainaAPI.ready.then(refreshOpenBadges); setInterval(refreshOpenBadges, 60000);

const today = String(new Date(AainaCore.todayKey() + 'T00:00:00Z').getUTCDay());
document.querySelectorAll('.hours li').forEach(row => {
  if (row.dataset.days.split(',').includes(today)) row.classList.add('today');
});

/* ---------- photos: show a soft placeholder until the file exists ---------- */

document.querySelectorAll('.ph img').forEach(img => {
  const markMissing = () => img.closest('.ph').classList.add('no-img');
  if (img.complete && img.naturalWidth === 0) markMissing();
  img.addEventListener('error', markMissing);
});

/* ---------- before / after slider ---------- */

document.querySelectorAll('.ba').forEach(box => {
  const range = box.querySelector('input[type="range"]');
  const update = () => box.style.setProperty('--pos', range.value + '%');
  range.addEventListener('input', update);
  update();
});

/* ---------- gallery preview ---------- */

const lightbox = document.querySelector('#lightbox');

if (lightbox) {
  const lightboxImg = lightbox.querySelector('img');
  const closeLightbox = () => { if (lightbox.open) lightbox.close(); };

  document.querySelectorAll('.gal-item, .b-gal-item').forEach(item => {
    item.addEventListener('click', () => {
      const photo = item.querySelector('img');
      if (!photo || item.querySelector('.ph').classList.contains('no-img')) {
        showToast('Add this photo to the images folder to preview it.');
        return;
      }
      lightboxImg.src = photo.src;
      lightboxImg.alt = photo.alt;
      lightbox.showModal();
    });
  });

  lightbox.addEventListener('click', event => {
    if (event.target !== lightboxImg) closeLightbox();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeLightbox(); setMenu(false); }
  });
}

/* ---------- enquiry form (demo) ---------- */

const enquiryForm = document.querySelector('#enquiryForm');

function setError(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  const errorNode = field.querySelector('.field-error');
  if (!errorNode.id) errorNode.id = (input.id || 'field') + '-error';
  input.setAttribute('aria-describedby', errorNode.id);
  if (message) field.querySelector('.field-error').textContent = message;
}

if (enquiryForm) {
  const nameInput = enquiryForm.querySelector('#enqName');
  const phoneInput = enquiryForm.querySelector('#enqPhone');

  enquiryForm.addEventListener('submit', async event => {
    event.preventDefault();

    const name = nameInput.value.trim();
    let digits = phoneInput.value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);

    setError(nameInput, name.length < 2 ? 'Please enter your name.' : '');
    setError(phoneInput, /^[6-9]\d{9}$/.test(digits) ? '' : 'Enter a valid 10-digit mobile number.');

    if (enquiryForm.querySelector('.invalid')) return;

    const submit = enquiryForm.querySelector('[type=submit]'); submit.disabled = true;
    try {
      if (AainaAPI.live) { await AainaAPI.lead({ name, phone: digits, service: enquiryForm.querySelector('#enqService').value, message: enquiryForm.querySelector('#enqMessage').value, website: enquiryForm.querySelector('[name=website]')?.value || '' }); showToast('Your enquiry was saved for the studio to review.'); }
      else showToast('Demo enquiry checked. Nothing was sent or saved.');
      enquiryForm.reset();
    } catch (error) { showToast(error.message); }
    finally { submit.disabled = false; }
  });
}


/* ---------- bridal page ---------- */

// package buttons pre-select the package in the trial form
document.querySelectorAll('[data-package]').forEach(button => {
  button.addEventListener('click', () => {
    const select = document.querySelector('#trPackage');
    if (select) select.value = button.dataset.package;
  });
});

/* wedding date check (demo calendar, availability is not real) */

const weddingDate = document.querySelector('#weddingDate');
const dateResult = document.querySelector('#dateResult');
const trialDate = document.querySelector('#trDate');

const peakMonths = [0, 1, 3, 4, 5, 10, 11]; // Jan, Feb, Apr, May, Jun, Nov, Dec
const slotLabels = { open: 'Available', filling: 'Filling fast', booked: 'Fully booked' };
const slotNotes = {
  open: 'Good news, we have bridal slots on this date. Book your trial to hold it.',
  filling: 'Only a few bridal slots are left on this date. We suggest booking your trial soon.',
  booked: 'This date is fully booked. You can join the waitlist or pick a nearby date.'
};

function toInputValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function fromInputValue(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfToday() {
  return fromInputValue(AainaCore.todayKey());
}

function slotStatus(date) {
  const seed = (date.getMonth() * 7 + date.getDate() * 3 + date.getDay()) % 10;
  if (peakMonths.includes(date.getMonth())) {
    if (seed >= 7) return 'booked';
    if (seed >= 4) return 'filling';
    return 'open';
  }
  return seed >= 9 ? 'filling' : 'open';
}

function nearbyOpenDates(date) {
  const found = [];
  const today = startOfToday();
  for (let gap = 1; gap <= 12 && found.length < 3; gap++) {
    [gap, -gap].forEach(offset => {
      const other = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
      if (other >= today && found.length < 3 && slotStatus(other) === 'open') found.push(other);
    });
  }
  return found.sort((a, b) => a - b);
}

function showDateResult() {
  if (!weddingDate.value) return;
  const date = fromInputValue(weddingDate.value);

  if (date < startOfToday()) {
    dateResult.innerHTML = '<p class="dc-empty">That date has passed. Please pick an upcoming date.</p>';
    return;
  }

  if (AainaAPI.live) {
    dateResult.innerHTML = '<h3>Ask about this wedding date</h3><p>Bridal availability depends on your venue, package and artist. Send an enquiry so the studio can confirm it.</p><a class="btn btn-gold" href="#trial" data-hold="enquiry">Request a consultation</a>';
    return;
  }
  const status = slotStatus(date);
  const fullDate = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const alternatives = nearbyOpenDates(date);

  let html = `<span class="chip ${status}">${slotLabels[status]}</span>`;
  html += `<h3>${fullDate}</h3><p>${slotNotes[status]}</p>`;

  if (status !== 'open' && alternatives.length) {
    html += '<div class="alts"><span>Nearby open dates</span>';
    html += alternatives.map(other => {
      const short = other.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      return `<button type="button" data-date="${toInputValue(other)}">${short}</button>`;
    }).join('');
    html += '</div>';
  }

  const buttonText = status === 'booked' ? 'Join waitlist for this date' : 'Book trial for this date';
  html += `<a class="btn btn-gold" href="#trial" data-hold="${status}">${buttonText}</a>`;
  dateResult.innerHTML = html;
}

if (weddingDate) {
  weddingDate.min = toInputValue(startOfToday());
  weddingDate.addEventListener('change', showDateResult);

  dateResult.addEventListener('click', event => {
    const altButton = event.target.closest('[data-date]');
    if (altButton) {
      weddingDate.value = altButton.dataset.date;
      showDateResult();
      return;
    }
    const holdButton = event.target.closest('[data-hold]');
    if (holdButton) {
      trialDate.value = weddingDate.value;
      if (holdButton.dataset.hold === 'booked') {
        document.querySelector('#trMessage').value = 'Please add me to the waitlist for this date.';
      }
    }
  });
}

/* trial booking form (demo) */

const trialForm = document.querySelector('#trialForm');

if (trialForm) {
  const trialDone = document.querySelector('#trialDone');
  const trName = trialForm.querySelector('#trName');
  const trPhone = trialForm.querySelector('#trPhone');
  trialDate.min = toInputValue(startOfToday());

  // "send on WhatsApp" button: the message follows whatever is typed in the form
  const trialWhatsapp = document.querySelector('#trWhatsapp');
  function updateTrialWhatsapp() {
    const lines = ['Hi! I want to book a bridal trial. I am writing from the Aaina Beauty Studio demo website.'];
    if (trName.value.trim()) lines.push('Name: ' + trName.value.trim());
    if (trPhone.value.trim()) lines.push('Phone: ' + trPhone.value.trim());
    if (trialDate.value) lines.push('Wedding date: ' + fromInputValue(trialDate.value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
    lines.push('Package: ' + trialForm.querySelector('#trPackage').value);
    lines.push('Service location: ' + trialForm.querySelector('#trPlace').value);
    const note = trialForm.querySelector('#trMessage').value.trim();
    if (note) lines.push('Message: ' + note);
    lines.push('Please share the available dates for a trial.');
    trialWhatsapp.href = whatsappUrl(lines.join('\n'));
  }
  trialForm.addEventListener('input', updateTrialWhatsapp);
  trialForm.addEventListener('change', updateTrialWhatsapp);
  updateTrialWhatsapp();

  trialForm.addEventListener('submit', async event => {
    event.preventDefault();

    const name = trName.value.trim();
    let digits = trPhone.value.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    const dateOk = trialDate.value && fromInputValue(trialDate.value) >= startOfToday();

    setError(trName, name.length < 2 ? 'Please enter your name.' : '');
    setError(trPhone, /^[6-9]\d{9}$/.test(digits) ? '' : 'Enter a valid 10-digit mobile number.');
    setError(trialDate, dateOk ? '' : 'Choose your wedding date.');
    if (trialForm.querySelector('.invalid')) return;

    const packageName = trialForm.querySelector('#trPackage').value;
    const place = trialForm.querySelector('#trPlace').value;
    const prettyDate = fromInputValue(trialDate.value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    let bookingId = 'AAB-' + AainaAPI.uuid();
    if (AainaAPI.live) {
      const submit = trialForm.querySelector('[type=submit]'); submit.disabled = true;
      try {
        const result = await AainaAPI.lead({ type: /waitlist/i.test(trialForm.querySelector('#trMessage').value) ? 'waitlist' : 'bridal', name, phone: digits, date: trialDate.value, package: packageName, location: place, message: trialForm.querySelector('#trMessage').value, website: trialForm.querySelector('[name=website]')?.value || '' });
        bookingId = result.id;
      } catch (error) { showToast(error.message); return; }
      finally { submit.disabled = false; }
    }

    trialDone.querySelector('#doneName').textContent = name.split(' ')[0];
    trialDone.querySelector('#doneId').textContent = bookingId;
    trialDone.querySelector('#doneDate').textContent = prettyDate;
    trialDone.querySelector('#donePackage').textContent = packageName;
    trialDone.querySelector('#donePlace').textContent = place;

    const text = [
      `Hi! I would like to discuss a bridal trial (${bookingId}) through the Aaina Beauty Studio website.`,
      `Name: ${name}`, `Phone: ${digits}`, `Wedding date: ${prettyDate}`,
      `Package: ${packageName}`, `Service location: ${place}`,
      'Please call or message me to confirm the trial.'
    ].join('\n');
    trialDone.querySelector('#doneWhatsapp').href = whatsappUrl(text);

    trialForm.hidden = true;
    trialDone.hidden = false;
    trialDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  trialDone.querySelector('#doneAgain').addEventListener('click', () => {
    trialForm.reset();
    trialForm.hidden = false;
    trialDone.hidden = true;
  });
}

/* gallery filter */

const filterChips = document.querySelectorAll('.chips button');
const galleryTiles = document.querySelectorAll('.b-gal-item');

filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(other => {
      other.classList.toggle('active', other === chip);
      other.setAttribute('aria-pressed', String(other === chip));
    });
    galleryTiles.forEach(tile => {
      tile.hidden = !(chip.dataset.filter === 'all' || tile.dataset.cat === chip.dataset.filter);
    });
  });
});

/* bride testimonials */

const quoteSlides = document.querySelectorAll('.quote-slide');
const quoteDots = document.querySelectorAll('.quote-dots button');
let currentQuote = 0;

function showQuote(index) {
  currentQuote = (index + quoteSlides.length) % quoteSlides.length;
  quoteSlides.forEach((slide, i) => slide.classList.toggle('active', i === currentQuote));
  quoteDots.forEach((dot, i) => dot.classList.toggle('active', i === currentQuote));
}

if (quoteSlides.length) {
  document.querySelector('[data-quote="prev"]').addEventListener('click', () => showQuote(currentQuote - 1));
  document.querySelector('[data-quote="next"]').addEventListener('click', () => showQuote(currentQuote + 1));
  quoteDots.forEach((dot, i) => dot.addEventListener('click', () => showQuote(i)));
}
