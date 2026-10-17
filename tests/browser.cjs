'use strict';
const { chromium, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { createStudio } = require('../server/index.cjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
async function listen(studio) { await new Promise(resolve => studio.server.listen(0, '127.0.0.1', resolve)); return 'http://127.0.0.1:' + studio.server.address().port; }
async function verifyDialog(page, name, phone) {
  const form = page.locator('#accountForm'); await expect(form).toBeVisible();
  await form.locator('[name=name]').fill(name); await form.locator('[name=phone]').fill(phone);
  await form.locator('[type=submit]').click(); await expect(form.locator('[name=code]')).toBeVisible();
  await form.locator('[name=code]').fill('123456'); await form.locator('[type=submit]').click(); await expect(form).toHaveCount(0);
}
async function websiteFlow(page, live) {
  await page.goto('/booking.html');
  await page.locator('[data-pick="hair-spa"]').click(); await page.locator('[data-nav=next]').click();
  await page.locator('[data-stylist=riya]').click(); await page.locator('[data-nav=next]').click();
  await page.locator('[data-date]').nth(1).click();
  await page.locator('[data-time]:enabled').first().click(); await page.locator('[data-nav=next]').click();
  await page.locator('#bkName').fill('Browser customer'); await page.locator('#bkPhone').fill('9988776655'); await page.locator('#bkNotes').fill('A quiet appointment, please.');
  await page.locator('[data-nav=next]').click();
  if (live) await verifyDialog(page, 'Browser customer', '9988776655');
  await expect(page.locator('#confirmView')).toBeVisible(); await expect(page.locator('#confirmView h2')).toContainText(live ? 'Appointment requested' : 'You are booked');
}
async function main() {
  process.chdir(root); fs.mkdirSync('artifacts', { recursive: true });
  const demo = createStudio({ dbPath: ':memory:', env: { STUDIO_MODE: 'demo' } });
  const live = createStudio({ dbPath: ':memory:', env: { STUDIO_MODE: 'live', ADMIN_PHONES: '9876543210' },
    providers: { configured: true, sendOtp: async () => {}, checkOtp: async (_, code) => code === '123456', notify: async () => {} } });
  const demoOrigin = await listen(demo), liveOrigin = await listen(live);
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] });
  const errors = [], audit = [];
  const contexts = [];
  async function context(origin, viewport = { width: 1440, height: 1000 }, workers = 'block') {
    const result = await browser.newContext({ baseURL: origin, viewport, serviceWorkers: workers, reducedMotion: 'reduce' }); contexts.push(result);
    result.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    return result;
  }
  try {
    const ui = await context(demoOrigin), page = await ui.newPage();
    for (const size of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(size);
      for (const route of ['/', '/services.html', '/bridal.html', '/booking.html', '/app/', '/admin/']) {
        await page.goto(route); await page.waitForLoadState('networkidle');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, route + ' overflows at ' + size.width);
        const name = route === '/' ? 'home' : route.replaceAll('/', '').replace('.html', '');
        if (size.width !== 320) await page.screenshot({ path: 'artifacts/' + name + '-' + (size.width === 1440 ? 'desktop' : 'mobile') + '.png', fullPage: route === '/admin/' });
        if (size.width === 1440) {
          const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          audit.push({ route, violations: report.violations.map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
        }
      }
    }
    fs.writeFileSync('artifacts/accessibility.json', JSON.stringify(audit, null, 2));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/'); await page.locator('.gal-item').first().click(); await expect(page.locator('#lightbox')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#lightbox')).not.toBeVisible();
    await page.goto('/services.html'); await page.locator('#searchBox').fill('hair spa'); await expect(page.locator('#serviceGrid .s-card')).toHaveCount(1);
    await page.locator('[data-heart="hair-spa"]').click(); await expect(page.locator('[data-heart="hair-spa"]')).toHaveAttribute('aria-pressed', 'true');
    await websiteFlow(page, false);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('aainaBookings')).at(-1));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('[data-act=manage]').click(); await page.locator('[data-manage=reschedule]').click();
    await expect(page.locator('#stepper')).not.toBeVisible(); await expect(page.locator('#stepBody h2')).toHaveText('Pick a date and time');
    await page.locator('[data-nav=next]').click(); await expect(page.locator('#stepError')).toContainText('Pick a date');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('aainaBookings')).at(-1)), before);
    await page.locator('[data-date]').nth(2).click(); await page.locator('[data-time]:enabled').first().click(); await page.locator('[data-nav=next]').click();
    await expect(page.locator('#confirmView h2')).toHaveText('Booking rescheduled');
    const download = page.waitForEvent('download'); await page.locator('[data-act=calendar]').click(); assert.ok((await download).suggestedFilename().endsWith('.ics'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/'); await page.locator('[data-skip-login]').click();
    await page.locator('#tabbar [data-go=profile]').click(); await page.locator('[data-edit-profile]').first().click();
    await page.locator('#editForm [name=name]').fill('<img id="unsafe-profile" src=x>');
    await page.locator('#editForm [type=submit]').click(); await expect(page.locator('#unsafe-profile')).toHaveCount(0);
    await page.locator('#tabbar [data-go=services]').click(); await page.locator('[data-add="hair-spa"]').click(); await page.locator('[data-book-cart]').click();
    await page.locator('[data-flow-next]').click(); await page.locator('[data-artist=riya]').click(); await page.locator('[data-flow-next]').click();
    await page.locator('[data-date]').nth(3).click(); await page.locator('[data-time]:enabled').first().click(); await page.locator('[data-flow-next]').click();
    await page.locator('[data-field=name]').fill('Demo customer'); await page.locator('[data-field=notes]').fill('</textarea><b id="unsafe-note">text</b>');
    await page.locator('[data-flow-next]').click(); await page.locator('[data-flow-back]').click(); await expect(page.locator('#unsafe-note')).toHaveCount(0);
    await page.locator('[data-flow-next]').click(); await page.locator('[data-flow-next]').click(); await expect(page.locator('.done h1')).toContainText('Demo booking ready');
    await page.goto('/app/'); await page.evaluate(() => { localStorage.setItem('aainaWishlist', '{}'); localStorage.setItem('aainaBookings', '[null,{}]'); localStorage.setItem('aainaBooking', 'null'); }); await page.reload();
    await expect(page.locator('#view')).not.toBeEmpty();
    console.log('PASS demo journeys: favourites, booking, rescheduling guard, calendar export, HTML escaping, malformed storage.');
    const customer = await context(liveOrigin, { width: 390, height: 844 }), livePage = await customer.newPage();
    await websiteFlow(livePage, true);
    assert.equal(await livePage.evaluate(() => localStorage.getItem('aainaBookings')), null, 'Live appointments must not persist in browser storage.');
    const staff = await context(liveOrigin), staffPage = await staff.newPage();
    await staffPage.goto('/admin/'); await staffPage.locator('#signIn').click(); await verifyDialog(staffPage, 'Studio manager', '9876543210');
    await expect(staffPage.locator('#workspace')).toBeVisible();
    const savedDate = JSON.parse(live.db.prepare('SELECT data FROM bookings').get().data).date;
    await staffPage.locator('#calendarDate').fill(savedDate); await staffPage.locator('#calendarDate').press('Tab');
    await staffPage.locator('[data-booking]').first().click();
    await staffPage.locator('#bookingForm [name=status]').selectOption('confirmed'); await staffPage.locator('#bookingForm [type=submit]').click();
    await expect(staffPage.locator('#editBooking')).not.toBeVisible();
    await staffPage.screenshot({ path: 'artifacts/admin-live-desktop.png', fullPage: true });
    await livePage.goto('/app/'); await expect(livePage.locator('#tabbar')).toBeVisible(); await livePage.locator('#tabbar [data-go=bookings]').click();
    await expect(livePage.locator('.bk')).toHaveCount(1); await expect(livePage.locator('.bk .status')).toHaveText('Confirmed');
    await livePage.locator('[data-reschedule]').click(); await livePage.locator('#sheet [data-date]:enabled').nth(2).click();
    await livePage.locator('#sheet [data-time]:enabled').first().click(); await livePage.locator('[data-confirm-resched]').click(); await expect(livePage.locator('#sheet')).not.toBeVisible();
    await livePage.locator('[data-cancel]').click(); await livePage.locator('[data-confirm-cancel]').click();
    await expect(livePage.locator('.empty h3')).toHaveText('No upcoming visits');
    await livePage.locator('#tabbar [data-go=profile]').click(); await livePage.locator('[data-logout]').click();
    await expect(livePage.locator('[data-live-login]')).toBeVisible();
    console.log('PASS live journeys with test verification adapter: phone login, request, staff confirmation, cross-page history, reschedule, cancel, logout.');
    const offline = await context(liveOrigin, { width: 390, height: 844 }, 'allow'), offlinePage = await offline.newPage();
    await offlinePage.goto('/services.html'); await offlinePage.evaluate(() => navigator.serviceWorker.ready); await offlinePage.reload();
    await expect(offlinePage.locator('#serviceGrid .s-card').first()).toBeVisible();
    await offline.setOffline(true); await offlinePage.goto('/services.html');
    const offlineResult = await offlinePage.evaluate(async () => { try { await AainaAPI.createBooking({}, crypto.randomUUID()); return 'saved'; } catch (error) { return error.message; } });
    assert.match(offlineResult, /offline|unavailable/i);
    await offline.setOffline(false);
    fs.writeFileSync('artifacts/accessibility.json', JSON.stringify(audit, null, 2));
    const serious = audit.flatMap(report => report.violations.filter(item => ['serious', 'critical'].includes(item.impact)).map(item => ({ route: report.route, ...item })));
    console.log('Accessibility findings:', JSON.stringify(serious.map(item => ({ route: item.route, id: item.id, nodes: item.nodes.length }))));
    assert.deepEqual(errors, [], 'Browser JavaScript errors');
    if (process.env.AXE_STRICT === '1') assert.deepEqual(serious, [], 'Serious or critical accessibility findings');
    console.log('PASS responsive layouts at 1440, 390 and 320px; public offline catalogue; live bookings fail closed offline.');
  } finally { for (const context of contexts) await context.close(); await browser.close(); await demo.close(); await live.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
