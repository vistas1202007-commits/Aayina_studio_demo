/* Only the public catalogue is available offline. API calls and authentication stay online. */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event;
    document.querySelectorAll('[data-install]').forEach(button => { button.hidden = false; });
  });
  document.addEventListener('click', async event => {
    if (!event.target.closest('[data-install]') || !installPrompt) return;
    await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null;
    document.querySelectorAll('[data-install]').forEach(button => { button.hidden = true; });
  });
})();
