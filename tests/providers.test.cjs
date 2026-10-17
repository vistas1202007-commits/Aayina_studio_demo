'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { providers } = require('../server/providers.cjs');
test('verification adapter uses Twilio endpoints and only approved checks authenticate', async () => {
  const calls = [];
  const env = { TWILIO_API_KEY_SID: 'SK_test', TWILIO_API_KEY_SECRET: 'test-secret', TWILIO_VERIFY_SERVICE_SID: 'VA' + 'a'.repeat(32) };
  const adapter = providers(env, async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ status: calls.length === 2 ? 'pending' : 'approved' }) }; });
  await adapter.sendOtp('9988776655'); assert.equal(await adapter.checkOtp('9988776655', '123456'), false);
  assert.equal(await adapter.checkOtp('9988776655', '123456'), true);
  assert.ok(calls[0].url.endsWith('/Verifications')); assert.ok(calls[1].url.endsWith('/VerificationCheck'));
  assert.equal(calls[0].options.body.get('To'), '+919988776655'); assert.equal(calls[0].options.body.get('Channel'), 'sms');
});
test('unconfigured verification fails without a transport request', async () => {
  let called = false; const adapter = providers({}, async () => { called = true; });
  await assert.rejects(adapter.sendOtp('9988776655'), /not configured/); assert.equal(called, false);
});
test('notification events are signed and retain a stable idempotency key', async () => {
  let call;
  const secret = 'test-webhook-secret';
  const adapter = providers({ NOTIFICATION_WEBHOOK_URL: 'https://delivery.example/notify', NOTIFICATION_WEBHOOK_SECRET: secret }, async (url, options) => { call = { url, options }; return { ok: true }; });
  await adapter.notify({ id: 'booking:confirmed:1', type: 'confirmed' });
  const headers = call.options.headers;
  assert.equal(headers['Idempotency-Key'], 'booking:confirmed:1');
  const signature = createHmac('sha256', secret).update(headers['X-Aaina-Timestamp'] + '.' + call.options.body).digest('hex');
  assert.equal(headers['X-Aaina-Signature'], signature);
  await assert.rejects(providers({ NOTIFICATION_WEBHOOK_URL: 'http://delivery.example', NOTIFICATION_WEBHOOK_SECRET: secret }).notify({ id: 'x' }), /HTTPS/);
});
