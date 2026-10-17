/* Aaina Beauty Studio - services page
   Needs script.js and data.js loaded before it.
   Wishlist and booking selection are kept in localStorage (this browser only, no server). */

(function () {
  const grid = document.querySelector('#serviceGrid');
  if (!grid) return;

  const chipsBox = document.querySelector('#chips');
  const searchBox = document.querySelector('#searchBox');
  const sortBox = document.querySelector('#sortBox');
  const resultCount = document.querySelector('#resultCount');
  const clearButton = document.querySelector('#clearFilters');
  const comboGrid = document.querySelector('#comboGrid');
  const tray = document.querySelector('#tray');
  const detailModal = document.querySelector('#detailModal');
  const detailBody = document.querySelector('#detailBody');
  const trayModal = document.querySelector('#trayModal');
  const trayBody = document.querySelector('#trayBody');

  const keys = { wishlist: 'aainaWishlist', booking: 'aainaBooking' };

  /* ---------- storage ---------- */

  function readStore(key, fallback) {
    try {
      return AainaCore.readStore(key, fallback);
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    AainaCore.writeStore(key, value);
  }

  const findService = id => serviceList.find(item => item.id === id);
  const findCategory = id => serviceCategories.find(item => item.id === id);

  let wishlist = readStore(keys.wishlist, []).filter(findService);
  let booking = readStore(keys.booking, { services: [], combo: null });
  booking.services = [...new Set((booking.services || []).filter(findService))];

  let activeCategory = 'all';
  let searchText = '';
  let sortBy = 'popular';

  /* ---------- small helpers ---------- */

  const icon = name => `<svg class="icon"><use href="#${name}"/></svg>`;
  const money = amount => '₹' + amount.toLocaleString('en-IN');

  function durationText(mins) {
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    if (hours === 0) return `${mins} min`;
    return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  }

  function priceOf(service) {
    return service.offer ? Math.round(service.price * (1 - service.offer / 100)) : service.price;
  }

  function comboIsActive() {
    const combo = comboList.find(item => item.id === booking.combo);
    return combo && combo.ids.every(id => booking.services.includes(id)) ? combo : null;
  }

  function totals() {
    const picked = booking.services.map(findService);
    const subtotal = picked.reduce((sum, item) => sum + priceOf(item), 0);
    const minutes = picked.reduce((sum, item) => sum + item.mins, 0);
    const combo = comboIsActive();
    const discount = picked.length ? AainaCore.bill(booking.services, combo?.id, serviceList, comboList).discount : 0;
    return { picked, subtotal, minutes, combo, discount, total: subtotal - discount };
  }

  function saveBooking() {
    writeStore(keys.booking, booking);
    updateTray();
  }

  /* ---------- filters + cards ---------- */

  function visibleServices() {
    const query = searchText.trim().toLowerCase();

    const list = serviceList.filter(item => {
      if (item.available === false) return false;
      if (activeCategory === 'saved' && !wishlist.includes(item.id)) return false;
      if (activeCategory !== 'all' && activeCategory !== 'saved' && item.cat !== activeCategory) return false;
      if (!query) return true;
      return `${item.name} ${item.desc} ${findCategory(item.cat).name}`.toLowerCase().includes(query);
    });

    if (sortBy === 'low') list.sort((a, b) => priceOf(a) - priceOf(b));
    else if (sortBy === 'high') list.sort((a, b) => priceOf(b) - priceOf(a));
    else if (sortBy === 'short') list.sort((a, b) => a.mins - b.mins);
    else list.sort((a, b) => (b.tag === 'Popular') - (a.tag === 'Popular'));

    return list;
  }

  function cardHtml(item) {
    const added = booking.services.includes(item.id);
    const saved = wishlist.includes(item.id);

    const tags = (item.tag ? `<span class="tag">${item.tag}</span>` : '') +
      (item.offer ? `<span class="tag offer">${item.offer}% off</span>` : '');

    const action = item.bridal
      ? '<a class="btn btn-line btn-sm" href="bridal.html#mehendi">See bridal</a>'
      : `<button class="btn btn-sm ${added ? 'btn-line' : 'btn-wine'}" data-add="${item.id}" aria-pressed="${added}" aria-label="${added ? 'Remove' : 'Add'} ${item.name} ${added ? 'from' : 'to'} booking">${icon(added ? 'tick' : 'plus')} ${added ? 'Added' : 'Add'}</button>`;

    return `
      <article class="s-card ${added ? 'is-added' : ''}">
        <div class="s-top">
          <span class="s-cat">${findCategory(item.cat).name}</span>
          <button class="s-heart ${saved ? 'saved' : ''}" data-heart="${item.id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${item.name} ${saved ? 'from' : 'to'} saved list">${icon('heart')}</button>
        </div>
        <h3>${item.name}</h3>
        <p class="s-desc">${item.desc}</p>
        <div class="s-meta">
          <span class="time">${icon('clock')} ${durationText(item.mins)}</span>${tags}
        </div>
        <div class="s-foot">
          <div class="s-price">
            ${item.from ? '<small>from</small>' : ''}
            ${item.offer ? `<del>${money(item.price)}</del>` : ''}<b>${money(priceOf(item))}</b>
          </div>
          <div class="s-actions">
            <button class="s-details" data-details="${item.id}">Details</button>
            ${action}
          </div>
        </div>
      </article>`;
  }

  function renderChips() {
    const counts = { all: serviceList.length, saved: wishlist.length };
    serviceCategories.forEach(cat => { counts[cat.id] = serviceList.filter(item => item.cat === cat.id).length; });

    const chips = [{ id: 'all', name: 'All' }, ...serviceCategories, { id: 'saved', name: 'Saved' }];
    chipsBox.innerHTML = chips.map(chip => `
      <button type="button" data-cat="${chip.id}" class="${chip.id === activeCategory ? 'active' : ''}" aria-pressed="${chip.id === activeCategory}">
        ${chip.id === 'saved' ? icon('heart') : ''}${chip.name} <span class="count">${counts[chip.id]}</span>
      </button>`).join('');
  }

  function renderEmpty() {
    const box = document.createElement('div');
    box.className = 'empty';

    if (activeCategory === 'saved' && !searchText.trim()) {
      box.innerHTML = '<h3>Nothing saved yet</h3><p>Tap the heart on any service to keep it here for later.</p><button class="btn btn-wine" type="button" data-show-all>Browse all services</button>';
    } else {
      box.innerHTML = '<h3>No services found</h3><p></p><button class="btn btn-wine" type="button" data-show-all>Clear filters</button>';
      box.querySelector('p').textContent = searchText.trim()
        ? `Nothing matches "${searchText.trim()}". Try a different word, like "facial" or "wax".`
        : 'There are no services in this category yet.';
    }
    grid.innerHTML = '';
    grid.appendChild(box);
  }

  function renderServices() {
    const list = visibleServices();
    renderChips();

    if (list.length === 0) {
      renderEmpty();
    } else {
      grid.innerHTML = list.map(cardHtml).join('');
    }

    resultCount.textContent = `Showing ${list.length} of ${serviceList.length} services`;
    clearButton.hidden = activeCategory === 'all' && !searchText.trim();
  }

  function refocus(selector) {
    const target = document.querySelector(selector);
    if (target) target.focus();
  }

  /* ---------- actions ---------- */

  function toggleWishlist(id) {
    const index = wishlist.indexOf(id);
    if (index === -1) {
      wishlist.push(id);
      showToast(`${findService(id).name} saved to your list.`);
    } else {
      wishlist.splice(index, 1);
    }
    writeStore(keys.wishlist, wishlist);
    renderServices();
    refocus(`[data-heart="${id}"]`);
  }

  function toggleService(id, quiet) {
    const index = booking.services.indexOf(id);
    if (index === -1) {
      booking.services.push(id);
      if (!quiet) showToast(`${findService(id).name} added to your booking.`);
    } else {
      booking.services.splice(index, 1);
      if (!comboIsActive()) booking.combo = null;
    }
    saveBooking();
    renderServices();
    refocus(`[data-add="${id}"]`);
  }

  function addCombo(id) {
    const combo = comboList.find(item => item.id === id);
    combo.ids.forEach(serviceId => {
      if (!booking.services.includes(serviceId)) booking.services.push(serviceId);
    });
    booking.combo = id;
    saveBooking();
    renderServices();
    showToast(`${combo.name} combo added. ${combo.percent}% discount applied.`);
  }

  function resetFilters() {
    activeCategory = 'all';
    searchText = '';
    searchBox.value = '';
    renderServices();
  }

  /* ---------- details modal ---------- */

  function openDetails(id) {
    const item = findService(id);
    const added = booking.services.includes(id);

    detailBody.innerHTML = `
      <span class="s-cat">${findCategory(item.cat).name}</span>
      <h2>${item.name}</h2>
      <p class="lead">${item.desc}</p>
      <div class="s-meta"><span class="time">${icon('clock')} ${durationText(item.mins)}</span>
        ${item.tag ? `<span class="tag">${item.tag}</span>` : ''}${item.offer ? `<span class="tag offer">${item.offer}% off</span>` : ''}</div>
      <h4>What is included</h4>
      <ul class="inc-list">${item.includes.map(line => `<li>${icon('tick')} ${line}</li>`).join('')}</ul>
      ${item.note ? `<p class="modal-note">${item.note}</p>` : ''}
      <div class="modal-foot">
        <div class="s-price">
          ${item.from ? '<small>from</small>' : ''}
          ${item.offer ? `<del>${money(item.price)}</del>` : ''}<b>${money(priceOf(item))}</b>
        </div>
        ${item.bridal
          ? '<a class="btn btn-wine" href="bridal.html#mehendi">See bridal packages</a>'
          : `<button class="btn ${added ? 'btn-line' : 'btn-wine'}" data-modal-add="${item.id}">${icon(added ? 'tick' : 'plus')} ${added ? 'Added to booking' : 'Add to booking'}</button>`}
      </div>`;

    if (!detailModal.open) detailModal.showModal();
  }

  /* ---------- tray + review ---------- */

  function updateTray() {
    const { picked, minutes, total } = totals();
    const count = picked.length;

    document.body.classList.toggle('has-tray', count > 0);
    tray.classList.toggle('show', count > 0);
    if (count === 0) return;

    document.querySelector('#trayCount').textContent = `${count} service${count > 1 ? 's' : ''}`;
    document.querySelector('#trayTotal').textContent = `${money(total)}, ${durationText(minutes)}`;
  }

  function reviewMessage(picked, total) {
    return [
      'Hi! I would like to book these services. I am writing from the Aaina Beauty Studio demo website.',
      ...picked.map(item => `- ${item.name} (${durationText(item.mins)}), ${money(priceOf(item))}`),
      `Estimated total: ${money(total)}`,
      'Please share the available time slots.'
    ].join('\n');
  }

  function renderReview() {
    const { picked, subtotal, minutes, combo, discount, total } = totals();

    if (picked.length === 0) {
      trayModal.close();
      return;
    }

    trayBody.innerHTML = `
      <span class="s-cat">Your booking</span>
      <h2>Review services</h2>
      <div class="t-list">
        ${picked.map(item => `
          <div class="t-row">
            <div><b>${item.name}</b><span>${durationText(item.mins)}</span></div>
            <div class="right">${money(priceOf(item))}
              <button class="t-remove" data-remove="${item.id}" aria-label="Remove ${item.name}">${icon('trash')}</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="t-sums">
        <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
        ${combo ? `<div class="discount"><span>${combo.name} combo, ${combo.percent}% off</span><span>-${money(discount)}</span></div>` : ''}
        <div><span>Time needed</span><span>about ${durationText(minutes)}</span></div>
        <div class="grand"><span>Total</span><span>${money(total)}</span></div>
      </div>
      <div class="t-actions">
        <button class="t-clear" data-clear-all type="button">Clear all</button>
        <a class="btn btn-line btn-sm" target="_blank" rel="noopener" href="${whatsappUrl(reviewMessage(picked, total))}">${icon('whatsapp')} Send on WhatsApp</a>
        <a class="btn btn-wine" href="booking.html">Continue to booking</a>
      </div>
      <p class="demo-line">Estimated total. Final price is confirmed at the studio. Demo only, nothing is booked.</p>`;
  }

  /* ---------- combos ---------- */

  function renderCombos() {
    comboGrid.innerHTML = comboList.filter(combo => combo.ids.every(id => findService(id)?.available !== false)).map(combo => {
      const base = combo.ids.reduce((sum, id) => sum + findService(id).price, 0);
      const now = base - Math.round(base * combo.percent / 100);
      return `
        <article class="combo">
          <div>
            <h3>${combo.name}</h3>
            <p class="blurb">${combo.blurb}</p>
            <ul>${combo.ids.map(id => `<li>${findService(id).name}</li>`).join('')}</ul>
          </div>
          <div class="price-box">
            <div><del>${money(base)}</del><div class="now">${money(now)}</div><span class="save">Save ${combo.percent}%</span></div>
            <button class="btn btn-wine btn-sm" data-combo="${combo.id}">Add combo</button>
          </div>
        </article>`;
    }).join('');
  }

  /* ---------- events ---------- */

  grid.addEventListener('click', event => {
    const heart = event.target.closest('[data-heart]');
    const add = event.target.closest('[data-add]');
    const details = event.target.closest('[data-details]');
    const showAll = event.target.closest('[data-show-all]');

    if (heart) toggleWishlist(heart.dataset.heart);
    else if (add) toggleService(add.dataset.add);
    else if (details) openDetails(details.dataset.details);
    else if (showAll) resetFilters();
  });

  chipsBox.addEventListener('click', event => {
    const chip = event.target.closest('[data-cat]');
    if (!chip) return;
    activeCategory = chip.dataset.cat;
    renderServices();
  });

  searchBox.addEventListener('input', () => {
    searchText = searchBox.value;
    renderServices();
  });

  sortBox.addEventListener('change', () => {
    sortBy = sortBox.value;
    renderServices();
  });

  clearButton.addEventListener('click', resetFilters);

  comboGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-combo]');
    if (button) addCombo(button.dataset.combo);
  });

  detailBody.addEventListener('click', event => {
    const button = event.target.closest('[data-modal-add]');
    if (!button) return;
    toggleService(button.dataset.modalAdd, true);
    openDetails(button.dataset.modalAdd);
  });

  document.querySelector('#trayReview').addEventListener('click', () => {
    renderReview();
    trayModal.showModal();
  });

  trayBody.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      toggleService(remove.dataset.remove, true);
      renderReview();
    }
    if (event.target.closest('[data-clear-all]')) {
      booking = { services: [], combo: null };
      saveBooking();
      renderServices();
      trayModal.close();
    }
  });

  // close dialogs with the X button or by clicking the dark backdrop
  [detailModal, trayModal].forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('[data-close-modal]')) modal.close();
    });
  });

  // links like services.html#nails open that category
  function applyHash() {
    const wanted = location.hash.slice(1);
    if (!serviceCategories.some(cat => cat.id === wanted)) return false;
    activeCategory = wanted;
    renderServices();
    return true;
  }

  window.addEventListener('hashchange', () => {
    if (applyHash()) document.querySelector('#results').scrollIntoView({ behavior: 'smooth' });
  });

  AainaAPI.ready.then(() => { booking.services = booking.services.filter(id => findService(id)?.available !== false); renderServices(); renderCombos(); updateTray(); });

  /* ---------- start ---------- */

  renderCombos();
  renderServices();
  updateTray();
  if (applyHash()) {
    setTimeout(() => document.querySelector('#results').scrollIntoView(), 50);
  }
})();
