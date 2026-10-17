'use strict';
const { createHmac } = require('node:crypto');
function providers(env = process.env, transport = fetch) {
  const key = env.TWILIO_API_KEY_SID, secret = env.TWILIO_API_KEY_SECRET, service = env.TWILIO_VERIFY_SERVICE_SID;
  const configured = !!(key && secret && /^VA[\da-f]{32}$/i.test(service || ''));
  async function verify(endpoint, values) {
    if (!configured) throw Object.assign(Error('Phone verification is not configured. Please contact the studio.'), { status: 503 });
    const response = await transport('https://verify.twilio.com/v2/Services/' + service + '/' + endpoint, {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { Authorization: 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values)
    });
    if (!response.ok) throw Object.assign(Error('Phone verification could not be completed. Please try again later.'), { status: 503 });
    return response.json();
  }
  return {
    configured,
    sendOtp: phone => verify('Verifications', { To: '+91' + phone, Channel: 'sms' }),
    checkOtp: async (phone, code) => (await verify('VerificationCheck', { To: '+91' + phone, Code: code })).status === 'approved',
    async notify(event) {
      if (!env.NOTIFICATION_WEBHOOK_URL || !env.NOTIFICATION_WEBHOOK_SECRET) throw Error('Notification delivery is not configured.');
      const url = new URL(env.NOTIFICATION_WEBHOOK_URL);
      if (url.protocol !== 'https:') throw Error('Notification webhook must use HTTPS.');
      const payload = JSON.stringify(event), timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac('sha256', env.NOTIFICATION_WEBHOOK_SECRET).update(timestamp + '.' + payload).digest('hex');
      const response = await transport(url, {
        method: 'POST', signal: AbortSignal.timeout(12000),
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': event.id, 'X-Aaina-Timestamp': timestamp, 'X-Aaina-Signature': signature }, body: payload
      });
      if (!response.ok) throw Error('Notification provider rejected the request.');
    }
  };
}
module.exports = { providers };
