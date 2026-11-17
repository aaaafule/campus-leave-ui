'use strict';

/* 转发 → 跳到 sim4（同一 App 的另一个学生页面）。
   mobile.html 走 sim4 的手机版，桌面预览走 sim4/index.html */
const SIM4_HREF = location.pathname.endsWith('mobile.html') ? '../leave/mobile.html' : '../leave/index.html';

/* 请假详情页 —— 静态复刻 + 可编辑字段
   要点：编辑态与展示态用的是同一套 CSS（.ed 里不出现任何 font-* / padding /
   line-height 覆盖），所以输入的字与原文字形、字距、行高完全一致。 */

/* ---------------- 可编辑字段 ---------------- */
const STORE = 'sim3:fields';

/** 只保留纯文本：粘贴/拖入的富文本会带字体，必须剥掉 */
function plainOnly(node) {
  node.normalize();
  node.querySelectorAll('*').forEach(el => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
}

function saveField(el) {
  /* 每次打开都重置：不落存储 */
}

function restoreFields() {
  /* 每次打开都重置：不读存储 */
}

/** 粘贴只收纯文本 —— 否则会把外部字体一并带进来，"字体一模一样"就破了 */
document.addEventListener('paste', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (!el) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  const tn = document.createTextNode(text);
  r.insertNode(tn);
  r.setStartAfter(tn); r.collapse(true);
  sel.removeAllRanges(); sel.addRange(r);
  saveField(el);
});

/* 输入：清掉浏览器可能塞进来的样式节点，并落盘 */
document.addEventListener('input', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (!el) return;
  if (el.querySelector('*')) plainOnly(el);
  saveField(el);
});

/* 回车不换行（这几项都是单行语义），Esc 退出编辑 */
document.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (!el) return;
  if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
  if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
});

document.addEventListener('focusin', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (el) el.dataset.before = el.textContent;
});

document.addEventListener('focusout', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (!el) return;
  if (el.textContent.trim() === '' && el.dataset.before) {
    el.textContent = el.dataset.before;   // 不允许留空，回退原值
    saveField(el);
  }
});

/* ---------------- 原有交互 ---------------- */

/* 转发前把「请假详情」里的可编辑内容带给下一页（sim4），
   只带走 7 项：类型 / 需否离校 / 起止时间 / 原因 / 位置 / 审批人 */
const XFER_KEY = 'sim4:inherited';
function collectForSim4() {
  const get = (f) => {
    const el = document.querySelector('.ed[data-field="' + f + '"]');
    return el ? el.textContent.trim() : '';
  };
  const payload = {
    type: get('type'), away: get('away'),
    start: get('start'), end: get('end'),
    reason: get('reason'), place: get('place'), approver: get('approver'),
    applicant: get('applicant'),         /* 审批流程记录里的「发起申请」人 */
    applyAt: (document.querySelector('.tl__time[data-field="flow1"]') || {}).textContent?.trim() || ''
  };
  try { sessionStorage.setItem(XFER_KEY, JSON.stringify(payload)); } catch (_) { }
  return payload;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.ed')) return;          // 编辑区不触发页面点击逻辑

  const tab = e.target.closest('.tab');
  if (tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-on', t === tab));
    const body = document.getElementById('body');
    if (tab.dataset.tab === 'qr') {
      body.innerHTML = `<div class="qrwrap"><div class="qrtip">核验二维码</div>
        <div class="qrimg">（此处为录屏中未展示的二维码区域）</div></div>`;
    } else {
      location.reload();
    }
    return;
  }
  if (e.target.closest('.bbtn')) {
    const txt = e.target.textContent.trim();
    if (txt === '转发') { collectForSim4(); location.href = SIM4_HREF; return; }
    const b = e.target;
    b.animate([{ opacity: 1 }, { opacity: .55 }, { opacity: 1 }], { duration: 180 });
    if (txt === '去销假') alert('模拟器：这里会发起销假流程');
  }
});

/* 启动：不做任何恢复，每次打开都是空白模板 */

/* ---------- 时长徽章 ----------
   规则照抄逆向时 PC 端的 calcDuration：
     · 空 / 格式非法 / 结束 <= 开始 → 一律显示 「—」
     · 有值 → X天X小时X分钟（0 的段省略，至少保留一项）
   页面从录屏里就是这个格式（1天16小时 / 2天15小时51分钟），所以只取规则不取半天的折算。 */
function durText(a, b) {
  const parse = (v) => {
    const m = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec((v || '').trim());
    return m ? new Date(2026, +m[1] - 1, +m[2], +m[3], +m[4]) : null;
  };
  const s = parse(a), e = parse(b);
  if (!s || !e || e <= s) return '\u2014';
  let min = Math.round((e - s) / 60000);
  const d = Math.floor(min / 1440); min -= d * 1440;
  const h = Math.floor(min / 60); min -= h * 60;
  let out = '';
  if (d) out += d + '天';
  if (h) out += h + '小时';
  if (min || !out) out += min + '分钟';
  return out;
}

function fieldText(f) {
  const el = document.querySelector('.ed[data-field="' + f + '"]');
  return el ? el.textContent.trim() : '';
}

function updateDur() {
  const el = document.getElementById('dur');
  if (!el) return;
  el.textContent = durText(fieldText('start'), fieldText('end'));
}

/* 开始/结束一改就重算（手打、选择器、继承都走这条） */
document.addEventListener('input', (e) => {
  const el = e.target.closest && e.target.closest('.ed');
  if (el && (el.dataset.field === 'start' || el.dataset.field === 'end')) updateDur();
});

/* 启动时按已有值算一次（localStorage 里可能存着上次填的） */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateDur);
} else { updateDur(); }
