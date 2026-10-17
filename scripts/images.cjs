/* Rebuild responsive assets with ImageMagick; original demo photographs remain intact. */
'use strict';
const { execFileSync } = require('node:child_process');
const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const name of readdirSync(path.join(root, 'images')).filter(name => name.endsWith('.jpg'))) {
  const input = path.join(root, 'images', name);
  for (const width of [480, 960]) execFileSync('magick', [input, '-auto-orient', '-resize', width + 'x>', '-strip', '-quality', '78', input.replace('.jpg', '.' + width + '.webp')]);
}
for (const size of [192, 512]) execFileSync('magick', [path.join(root, 'icons/aaina.svg'), '-resize', size + 'x' + size, path.join(root, 'icons/aaina-' + size + '.png')]);
for (const file of ['index.html', 'bridal.html']) {
  const source = readFileSync(path.join(root, file), 'utf8');
  const output = source.replace(/<img\b([^>]*?)src="(images\/[^"]+\.jpg)"([^>]*)>/g, (tag, before, image, after) => {
    if (tag.includes('srcset=')) return tag;
    const dimensions = execFileSync('magick', ['identify', '-format', '%w %h', path.join(root, image)], { encoding: 'utf8' }).trim().split(' ');
    const priority = /hero/.test(image) ? ' fetchpriority="high"' : '';
    return '<picture><source type="image/webp" srcset="' + image.replace('.jpg', '.480.webp') + ' 480w, ' + image.replace('.jpg', '.960.webp') + ' 960w" sizes="(max-width:700px) 88vw, (max-width:1100px) 40vw, 480px"><img' + before + 'src="' + image + '"' + after + ' width="' + dimensions[0] + '" height="' + dimensions[1] + '" decoding="async"' + priority + '></picture>';
  });
  writeFileSync(path.join(root, file), output);
}
console.log('Responsive WebP variants and app icons generated.');
