#!/usr/bin/env node
/* 把某个页面目录里的 mobile.html 打成自包含单文件：
   CSS / JS / 图片全部内联，拷到手机任意目录双击即可离线运行。

   用法：
     node tools/build-standalone.mjs detail    → detail/mobile-standalone.html
     node tools/build-standalone.mjs leave     → leave/mobile-standalone.html
     不传参数默认 detail
*/
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const TARGET = resolve(REPO, process.argv[2] || 'detail');

const read = async (p) => (await readFile(join(TARGET, p), 'utf8')).replace(/^\uFEFF/, '');  // 防 BOM：内联后的 BOM 会变成非法 token 吞掉下一条规则
const b64 = async (p) => {
  const buf = await readFile(join(TARGET, p));
  const ext = p.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'svg' ? 'image/svg+xml'
        : ext === 'webp' ? 'image/webp' : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
};

let html = await read('mobile.html');

/* 1) 样式：按 html 里的顺序内联 */
const cssOrder = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"\s*\/?>/g)].map((m) => m[1]);
let cssAll = '';
for (const f of cssOrder) cssAll += `\n/* ===== ${f} ===== */\n` + (await read(f));
html = html.replace(/\s*<link rel="stylesheet" href="\.\/[^"]+"\s*\/?>/g, '');
html = html.replace('</head>', `<style>\n${cssAll}\n</style>\n</head>`);

/* 2) 脚本：按顺序内联 */
const jsOrder = [...html.matchAll(/<script src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]);
let jsAll = '';
for (const f of jsOrder) jsAll += `\n/* ===== ${f} ===== */\n` + (await read(f));
html = html.replace(/\s*<script src="\.\/[^"]+"><\/script>/g, '');
html = html.replace('</body>', `<script>\n${jsAll}\n</script>\n</body>`);

/* 3) 图片内联（HTML 里的 src） */
for (const m of [...html.matchAll(/src="\.\/([^"]+\.(?:png|jpe?g|gif|webp|svg))"/g)]) {
  html = html.replace(m[0], `src="${await b64(m[1])}"`);
}
/* 4) 样式里引用的图片也一并内联 */
for (const f of cssOrder) {
  const css = await read(f);
  for (const m of [...css.matchAll(/url\("\.\/([^"]+\.(?:png|jpe?g|gif|webp|svg))"\)/g)]) {
    html = html.replace(`url("./${m[1]}")`, `url("${await b64(m[1])}")`);
  }
}

const OUT = join(TARGET, 'mobile-standalone.html');
await writeFile(OUT, html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ ${OUT}  ${kb} KB`);
console.log('  内联:', [cssOrder.join(' + '), jsOrder.join(' + ')].join(' | '));
