'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), url = new URL(process.env.PUBLIC_URL || 'https://strong-cucurucho-858239.netlify.app');
if (url.protocol !== 'https:' || url.pathname !== '/') throw Error('PUBLIC_URL must be an HTTPS origin.');
for (const file of ['index.html','services.html','bridal.html','booking.html','app/index.html','robots.txt','sitemap.xml']) {
  const target = path.join(root, file);
  fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/https:\/\/strong-cucurucho-858239\.netlify\.app/g, url.origin));
}
console.log('Public metadata updated for ' + url.origin);
