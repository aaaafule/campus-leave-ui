#!/usr/bin/env node
/* 端到端验证分享链接：本地起 HTTP 服务 → 打开 share/index.html#d=... → 截图核对 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));   // 仓库根目录
const OUT = process.argv[2] || join(ROOT, 'share', 'anim');
const PORT = 8777;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = join(ROOT, p === '/' ? '/share/index.html' : p);
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404); res.end('404');
  }
});
await new Promise((r) => server.listen(PORT, r));

const token = (await readFile(join(ROOT, 'share', '_sample_token.txt'), 'utf8')).trim();
const url = `http://127.0.0.1:${PORT}/share/index.html#d=${token}`;

const CDP_PORT = 8330 + (Date.now() % 40);
const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${process.env.TEMP}\\sh-${CDP_PORT}`,
  '--window-size=500,1000', 'about:blank'], { stdio: 'ignore' });

const wsUrl = await (async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json`)).json();
      const p = l.find((t) => t.type === 'page'); if (p) return p.webSocketDebuggerUrl;
    } catch { }
    await sleep(120);
  }
  throw new Error('cdp');
})();
const conn = new WebSocket(wsUrl);
await new Promise((r) => conn.addEventListener('open', r, { once: true }));
let seq = 0; const pend = new Map();
conn.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); conn.send(JSON.stringify({ id, method, params })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result.result.value;

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await mkdir(OUT, { recursive: true });

console.log('链接长度:', url.length, '字符');

await send('Page.navigate', { url });
await sleep(2600);

const got = await ev(`(() => {
  const t = s => { const e = document.querySelector(s); return e ? e.textContent.trim() : null; };
  const cols = [...document.querySelectorAll('.fact__row--2 span')].map(x => x.textContent.trim());
  return { name:t('#whoName'), no:t('#whoNo'), avatar:t('#avatar'), cols,
           start:t('#startAt'), end:t('#endAt'), dur:t('#dur'), reason:t('#reason'),
           place:t('#loc'), approver:t('#approver'), title:document.title,
           splash: !!document.getElementById('splash') };
})()`);
console.log(JSON.stringify(got, null, 1));

let s = await send('Page.captureScreenshot', { format: 'png' });
await writeFile(join(OUT, 'share-ok.png'), Buffer.from(s.result.data, 'base64'));

/* 再验一次：链接被截断时应给出提示而不是空白 */
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/share/index.html` });
await sleep(1800);
const bad = await ev(`(() => ({ text: document.body.innerText.includes('链接不完整') }))()`);
console.log('无参数时是否提示「链接不完整」:', bad.text);
s = await send('Page.captureScreenshot', { format: 'png' });
await writeFile(join(OUT, 'share-invalid.png'), Buffer.from(s.result.data, 'base64'));

conn.close(); child.kill(); server.close(); process.exit(0);
