'use strict';
/* ============================================================
   时间选择器（开始时间 / 结束时间）
   ------------------------------------------------------------
   交互原型来自 PC 端请假表单里的 Element Plus datetimerange：
   左侧日历选日期、右侧时/分两列；这里按手机页面改成底部弹出。
   写入格式与页面一致：MM-DD HH:mm
   ============================================================ */
(function () {
  const MIN_YEAR = 2024, MAX_YEAR = 2030;
  const ITEM_H = 34;

  const HTML = `
    <div class="dtp__mask"></div>
    <div class="dtp__panel">
      <div class="dtp__hd">
        <button type="button" class="dtp__cancel">取消</button>
        <span class="dtp__title">选择时间</span>
        <button type="button" class="dtp__ok">确定</button>
      </div>
      <div class="dtp__cal">
        <div class="dtp__mh">
          <button type="button" class="dtp__prev">‹</button>
          <span class="dtp__month"></span>
          <button type="button" class="dtp__next">›</button>
        </div>
        <div class="dtp__week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div class="dtp__days"></div>
      </div>
      <div class="dtp__time">
        <div class="dtp__band"></div>
        <div class="dtp__col" data-unit="h"></div>
        <span class="dtp__colon">:</span>
        <div class="dtp__col" data-unit="m"></div>
      </div>
      <div class="dtp__hint" hidden></div>
    </div>`;

  let root = null, target = null, pendingTime = null;
  let view = { y: 0, m: 0 };          // 当前日历显示的月份
  let picked = { y: 0, m: 0, d: 0 };  // 选中的日期
  let hEl = null, mEl = null;

  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- 解析 / 格式化 ---------- */
  function parse(text) {
    const m = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec((text || '').trim());
    if (!m) return null;
    const now = new Date();
    return { m: +m[1], d: +m[2], h: +m[3], mi: +m[4], y: now.getFullYear() };
  }
  const fmt = (y, m, d, h, mi) => `${pad(m)}-${pad(d)} ${pad(h)}:${pad(mi)}`;

  /* ---------- 滚轮列 ---------- */
  function buildCol(el, from, to) {
    el.innerHTML = '';                       // 居中靠容器的 padding，不再放占位块
    for (let v = from; v <= to; v++) {
      const it = document.createElement('div');
      it.className = 'dtp__item';
      it.dataset.v = v;
      it.textContent = pad(v);
      el.appendChild(it);
    }
    el.addEventListener('scroll', () => markCol(el), { passive: true });
  }
  function markCol(el) {
    const idx = Math.round(el.scrollTop / ITEM_H);
    [...el.children].forEach((c, i) => c.classList.toggle('is-on', i === idx));
  }
  function setCol(el, v) {
    el.scrollTop = v * ITEM_H;         // 容器有 68px 上下 padding，滚到该值即居中
    markCol(el);
  }
  function getCol(el) {
    const idx = Math.round(el.scrollTop / ITEM_H);
    return Math.min(59, Math.max(0, idx));
  }

  /* ---------- 日历 ---------- */
  function renderCal() {
    const box = root.querySelector('.dtp__days');
    const label = root.querySelector('.dtp__month');
    const { y, m } = view;
    label.textContent = `${y}年${m}月`;

    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const today = new Date();
    const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

    box.innerHTML = '';
    for (let i = 0; i < first; i++) {
      const b = document.createElement('div');
      b.className = 'dtp__day is-blank';
      box.appendChild(b);
    }
    for (let d = 1; d <= days; d++) {
      const el = document.createElement('div');
      el.className = 'dtp__day';
      el.dataset.d = d;
      el.textContent = d;
      if (isThisMonth && d === today.getDate()) el.classList.add('is-today');
      if (d === picked.d && m === picked.m && y === picked.y) el.classList.add('is-on');
      if (y === today.getFullYear() && (m < today.getMonth() + 1 ||
          (m === today.getMonth() + 1 && d < today.getDate()))) el.classList.add('is-dim');
      box.appendChild(el);
    }
    root.querySelector('.dtp__prev').disabled = (y === MIN_YEAR && m === 1);
    root.querySelector('.dtp__next').disabled = (y === MAX_YEAR && m === 12);
  }

  function shiftMonth(delta) {
    let m = view.m + delta, y = view.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    if (y < MIN_YEAR || y > MAX_YEAR) return;
    view = { y, m };
    renderCal();
  }

  /* ---------- 打开 / 关闭 ---------- */
  function ensure() {
    if (root) return;
    const host = document.querySelector('#stage') || document.querySelector('.screen') || document.body;
    root = document.createElement('div');
    root.className = 'dtp';
    root.id = 'dtp';
    root.hidden = true;
    root.innerHTML = HTML;
    host.appendChild(root);

    hEl = root.querySelector('[data-unit="h"]');
    mEl = root.querySelector('[data-unit="m"]');
    buildCol(hEl, 0, 23);
    buildCol(mEl, 0, 59);

    root.querySelector('.dtp__mask').addEventListener('click', close);
    root.querySelector('.dtp__cancel').addEventListener('click', close);
    root.querySelector('.dtp__ok').addEventListener('click', confirm);
    root.querySelector('.dtp__prev').addEventListener('click', () => shiftMonth(-1));
    root.querySelector('.dtp__next').addEventListener('click', () => shiftMonth(1));
    root.querySelector('.dtp__days').addEventListener('click', (e) => {
      const d = e.target.closest('.dtp__day');
      if (!d || d.classList.contains('is-blank')) return;
      picked.d = +d.dataset.d;
      picked.m = view.m;
      picked.y = view.y;
      renderCal();
    });
  }

  function open(fieldEl) {
    ensure();
    target = fieldEl;
    const now = new Date();
    const cur = parse(fieldEl.textContent);

    if (cur) {
      picked = { y: now.getFullYear(), m: cur.m, d: cur.d };
      view = { y: picked.y, m: picked.m };
      pendingTime = [cur.h, cur.mi];
    } else {
      /* 没有值时：开始时间取现在；结束时间取开始时间 + 1 小时 */
      let base = new Date();
      if (fieldEl.dataset.field === 'end') {
        const s = document.querySelector('.ed[data-field="start"]');
        const sv = parse(s && s.textContent);
        if (sv) base = new Date(2000, sv.m - 1, sv.d, sv.h, sv.mi + 60);
      }
      picked = { y: base.getFullYear(), m: base.getMonth() + 1, d: base.getDate() };
      view = { y: picked.y, m: picked.m };
      pendingTime = [base.getHours(), base.getMinutes()];
    }

    root.querySelector('.dtp__hint').hidden = true;
    root.hidden = false;
    renderCal();                       // ← 打开时先画日历，否则网格是空的
    requestAnimationFrame(() => {
      root.classList.add('is-open');
      /* 元素可见后再定位滚轮，否则 scrollTop 会被忽略 */
      if (pendingTime) { setCol(hEl, pendingTime[0]); setCol(mEl, pendingTime[1]); pendingTime = null; }
    });
  }

  function close() {
    if (!root) return;
    root.classList.remove('is-open');
    setTimeout(() => { root.hidden = true; }, 240);
    target = null;
  }

  function confirm() {
    if (!target) return;
    const h = getCol(hEl), mi = getCol(mEl);
    const text = fmt(picked.y, picked.m, picked.d, h, mi);

    /* 结束时间不能早于开始时间（同一格式可直接字符串比较） */
    if (target.dataset.field === 'end') {
      const s = document.querySelector('.ed[data-field="start"]');
      const sv = (s && s.textContent.trim()) || '';
      if (/^\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(sv) && text < sv) {
        const hint = root.querySelector('.dtp__hint');
        hint.textContent = '结束时间不能早于开始时间';
        hint.hidden = false;
        return;
      }
    }

    target.textContent = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));   // 走既有的保存逻辑
    close();
  }

  /* ---------- 绑定：点开始/结束时间即可选择 ---------- */
  function bind() {
    const SEL = '.ed[data-field="start"], .ed[data-field="end"], .tl__time[data-field]';
    document.querySelectorAll(SEL).forEach((el) => {
      if (el.dataset.dtpBound) return;
      el.dataset.dtpBound = '1';
      el.addEventListener('click', (e) => { e.preventDefault(); open(el); });
      el.addEventListener('focus', () => open(el));
      /* 只靠选择器输入，禁止手打，避免格式乱 */
      el.addEventListener('beforeinput', (e) => { e.preventDefault(); open(el); });
      el.addEventListener('keydown', (e) => {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault(); open(el);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else { bind(); }

  window.__dtp = { open, close, bind };
})();
