'use strict';
const fs = require('node:fs'), path = require('node:path'), { Script } = require('node:vm');
const root = path.resolve(__dirname, '..');
let count = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules','.git','var','artifacts'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (/\.(c?js)$/.test(entry.name)) { new Script(fs.readFileSync(file, 'utf8'), { filename: file }); count++; }
    if (entry.name.endsWith('.html')) {
      const source = fs.readFileSync(file, 'utf8');
      if (!source.includes('<html lang="en"') || !source.includes('name="viewport"')) throw Error('Missing document metadata: ' + file);
      if (/\son\w+=/i.test(source)) throw Error('Inline event handler: ' + file);
      for (const match of source.matchAll(/\b(?:src|href)="([^"]*)"/g)) {
        const ref = match[1];
        if (!ref || /^(?:https?:|tel:|mailto:|#|data:)/.test(ref)) continue;
        const target = path.resolve(ref.startsWith('/') ? root : path.dirname(file), ref.replace(/^\//, '').split(/[?#]/)[0]);
        if (!fs.existsSync(target)) throw Error('Missing asset: ' + file + ' -> ' + ref);
      }
    }
  }
}
walk(root);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons) if (!fs.existsSync(path.join(root, icon.src))) throw Error('Missing PWA icon.');
console.log('Syntax and asset references checked (' + count + ' JavaScript files).');
