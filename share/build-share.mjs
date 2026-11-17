#!/usr/bin/env node
/* 由 leave/ 的单文件版生成「假条分享页」 share/index.html
   ------------------------------------------------------------
   分享页 = leave 页面 + 一段读取地址栏 #d=<base64url(JSON)> 的脚本。
   数据全在链接里，不需要服务器、不需要数据库：
   同一个 HTML 文件发给谁都能打开，链接换一组参数就是另一张假条。
*/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const SRC = join(ROOT, 'leave', 'mobile-standalone.html');
const OUT_DIR = join(ROOT, 'share');
const OUT = join(OUT_DIR, 'index.html');

const READER = `
<script>
/* ================= 假条分享页：从链接里读数据 ================= */
(function () {
  'use strict';

  /* 分享页不播启动动画 */
  try { sessionStorage.setItem('app:splash-shown', '1'); } catch (_) { }

  function decodeHash() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return null;
    const m = /(?:^|&)d=([^&]+)/.exec(raw);
    const b64 = m ? m[1] : raw;
    if (!b64) return null;
    try {
      const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    } catch (e) { return null; }
  }

  function durText(a, b) {
    const parse = (v) => {
      const m = /^(\\d{2})-(\\d{2})\\s+(\\d{2}):(\\d{2})$/.exec((v || '').trim());
      return m ? new Date(2026, +m[1] - 1, +m[2], +m[3], +m[4]) : null;
    };
    const s = parse(a), e = parse(b);
    if (!s || !e || e <= s) return '\\u2014';
    let min = Math.round((e - s) / 60000);
    const d = Math.floor(min / 1440); min -= d * 1440;
    const h = Math.floor(min / 60); min -= h * 60;
    let out = '';
    if (d) out += d + '天';
    if (h) out += h + '小时';
    if (min || !out) out += min + '分钟';
    return out;
  }

  const q = (sel) => document.querySelector(sel);
  const put = (sel, v) => { const el = q(sel); if (el) el.textContent = v || ''; };

  function fill(d) {
    const name = (d.name || '').trim();
    put('#whoName', name);
    put('#whoNo', d.no);
    const av = q('#avatar');
    if (av) av.textContent = name.length > 2 ? name.slice(-2) : name;

    const cols = document.querySelectorAll('.fact__row--2 span');
    if (cols.length >= 2) {
      [['请假类型：', d.type], ['需要离校：', d.away]].forEach((p, i) => {
        const em = document.createElement('em');
        em.textContent = p[0];
        cols[i].textContent = '';
        cols[i].appendChild(em);
        cols[i].appendChild(document.createTextNode(p[1] || ''));
      });
    }

    put('#startAt', d.start);
    put('#endAt', d.end);
    put('#reason', d.reason);
    put('#loc', d.place);
    put('#approver', d.approver);
    put('#dur', durText(d.start, d.end));

    /* 审批流程弹层 */
    put('#stApplicant', d.applicant || name);
    put('#stApprover', d.approver);
    put('#stApplyAt', d.applyAt || d.start);
  }

  function invalid() {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;z-index:300;background:#f5f6f8;display:flex;' +
      'align-items:center;justify-content:center;flex-direction:column;gap:10px;padding:32px;text-align:center;' +
      'font:15px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#3c4148;';
    el.innerHTML = '<div style="font-size:17px;font-weight:600">链接不完整</div>' +
      '<div style="color:#8b929c;font-size:13px">这个地址里没有包含假条信息，可能复制时被截断了。<br>请让对方重新发一次完整链接。</div>';
    (document.getElementById('stage') || document.body).appendChild(el);
  }

  function boot() {
    const d = decodeHash();
    if (!d) { invalid(); return; }
    /* 等 app.js 跑完再填，避免被它的默认值覆盖 */
    setTimeout(() => fill(d), 60);
    document.title = '请假详情' + (d.name ? ' · ' + d.name : '');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>
`;

let html = await readFile(SRC, 'utf8');

/* 分享页不显示「智能客服」（对查看者没意义，还会挡住时间） */
html = html.replace('<button class="help" id="help">', '<button class="help" id="help" style="display:none">');

/* reader 放最后，保证 app.js 先跑 */
html = html.replace('</body>', READER + '</body>');

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, html, 'utf8');

const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`✓ ${OUT}  ${kb} KB`);
console.log('  分享链接格式： share/index.html#d=<base64url(JSON)>');
