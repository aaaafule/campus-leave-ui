'use strict';
/* 今日校园 · 请假页 —— 数据与动态行为
   动态项（与录屏一致）：当前时间每秒刷新、浏览器加载进度、系统时间
   动效项：横幅滑入 / 标题字距展开 / 斜条纹流动 / 卡片错峰上浮 / 盖章 / 客服滑入呼吸
*/

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');

/* ---------- 数据 ---------- */
const DATA = {
  /* 只保留与「请假」本身相关的字段；姓名 / 学号 / 审批人 / 原因 / 地点
     一律留空，由上一页带过来或由用户自己填，代码里不留任何真实人名地名。 */
  student: {
    name: '', no: '', type: '事假', offCampus: '否',
    start: '11-13 15:09', end: '11-16 07:00', flow: '共1步',
    approver: '', reason: '', loc: ''
  }
};

const order = ['student'];
let idx = 0;

/* ---------- 文本填充 ---------- */
function apply(d) {
  $('#startAt').textContent = d.start;
  $('#endAt').textContent = d.end;
  $('#flow').textContent = d.flow;
  /* 审批人 / 请假原因 / 发起位置：本页不预置内容，
     只有从「请假详情」转发过来时才由 applyInherited() 填 —— 首次打开保持空白 */
  document.querySelector('.fact__row--2 span').innerHTML = `<em>请假类型：</em>${d.type}`;
  document.querySelectorAll('.fact__row--2 span')[1].innerHTML = `<em>需要离校：</em>${d.offCampus}`;
  $('#dur').textContent = durText(d.start, d.end);
}

/* 时长：MM-DD HH:mm 之间的距离 */
function durText(a, b) {
  const T = (s) => {
    const m = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(s.trim());
    return m ? new Date(2026, +m[1] - 1, +m[2], +m[3], +m[4]) : null;
  };
  const s = T(a), e = T(b);
  if (!s || !e || e <= s) return '—';
  let min = Math.round((e - s) / 60000);
  const d = Math.floor(min / 1440); min -= d * 1440;
  const h = Math.floor(min / 60); min -= h * 60;
  let out = '';
  if (d) out += d + '天';
  if (h) out += h + '小时';
  if (min || !out) out += min + '分钟';
  return out;
}

/* ---------- 当前时间：每秒跳动（录屏里真实存在的动效） ---------- */
function tickClock() {
  const n = new Date();
  const el = $('#clock');
  if (el) el.textContent = `当前时间:${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  const st = $('#sysTime');
  if (st) st.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
}

/* ---------- 浏览器进度条：加载动画 ---------- */
function runProgress() {
  const bar = $('#prog');
  if (!bar) return;
  let v = 0;
  const t = setInterval(() => {
    v = Math.min(100, v + Math.random() * 28 + 8);
    bar.style.width = v + '%';
    if (v >= 100) {
      clearInterval(t);
      setTimeout(() => { bar.style.opacity = '0'; }, 320);
    }
  }, 130);
}

/* ---------- 重播入场动画（切人/切状态时） ---------- */
function replay() {
  const page = $('#page');
  page.scrollTop = 0;
  // 强制重排以重启动画
  page.querySelectorAll('.hero,.who,.fact,.card,.dur,.seal,.help,.okico,.hero__big,.hero__clock')
    .forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
}


/* ---------- 可编辑：姓名 / 性别学号 ----------
   蓝色圆圈里的字 = 姓名的后两个字，随输入实时变化。
   字体不做任何覆盖：编辑用的就是 .who__name / .who__no 原样式。 */
/* 不再使用本地存储 */

function avatarText(name) {
  const n = (name || '').trim();
  return n.length > 2 ? n.slice(-2) : n;
}

function saveIdentity() {
  /* 每次打开都重置：不落存储 */
}

function restoreIdentity() {
  /* 每次打开都重置：不读存储 */
}

function bindIdentity() {
  document.querySelectorAll('.ed[data-field]').forEach((el) => {
    el.dataset.initial = el.textContent;

    el.addEventListener('input', () => {
      if (el.querySelector('*')) el.textContent = el.textContent;   // 只留纯文本
      if (el.dataset.field === 'name') $('#avatar').textContent = avatarText(el.textContent);
      saveIdentity();
    });

    // 粘贴只收纯文本，避免把外部字体带进来
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const t = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      document.execCommand('insertText', false, t);
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); el.blur(); }
    });

    el.addEventListener('blur', () => {
      const v = el.textContent.trim();
      el.textContent = v || el.dataset.initial;      // 不许留空
      if (el.dataset.field === 'name') $('#avatar').textContent = avatarText(el.textContent);
      saveIdentity();
    });
  });
}

/* ---------- 交互 ---------- */
function next() {
  idx = (idx + 1) % order.length;
  apply(DATA[order[idx]]);
  replay();
}
function togglePending() {
  document.body.classList.toggle('is-pending');
  const on = document.body.classList.contains('is-pending');
  $('.hero__ok').lastChild.textContent = on ? '审批中' : '审批已通过';
  $('#heroBig').textContent = on ? '请假审核中' : '正在休假中';
  replay();
}

/* 审批流程弹层 */
function openSheet() {
  $('#sheetMask').hidden = false; $('#sheet').classList.add('is-open');
  requestAnimationFrame(() => $('#sheetMask').classList.add('is-open'));
  const d = DATA[order[idx]];
  /* 名字优先取上一页带过来的（发起申请人 / 审批人）；没有才回落到本页数据 */
  /* 没有从上一页带过来就保持空白（不再回落到本页数据） */
  $('#stApplicant').textContent = inheritedNames.applicant;
  $('#stApprover').textContent = inheritedNames.approver;
  $('#stApplyAt').textContent = inheritedNames.applyAt;   /* 同名字一样：没有就空着 */
}
function closeSheet() {
  $('#sheet').classList.remove('is-open');
  $('#sheetMask').classList.remove('is-open');
  setTimeout(() => { $('#sheetMask').hidden = true; }, 240);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.lnk')) { openSheet(); return; }
  if (e.target.closest('#sheetX') || e.target.closest('#sheetMask')) { closeSheet(); return; }
  if (e.target.closest('.chrome__more')) { next(); return; }
  if (e.target.closest('.chrome__close')) { togglePending(); return; }
  if (e.target.closest('.hero__ok')) { togglePending(); return; }
  if (e.target.closest('.help')) {
    const h = $('#help');
    h.animate([{ transform: 'scale(1)' }, { transform: 'scale(.92)' }, { transform: 'scale(1)' }], { duration: 220 });
    return;
  }
});


/* ---------- 继承 sim3「请假详情」带过来的内容 ----------
   只覆盖有值的项；某一项在上一页是空的，就保留本页原数据，
   避免继承成一片空白又无法在这里修改（这些项在本页是不可编辑的）。 */
const inheritedNames = { applicant: '', approver: '', applyAt: '' };

function applyInherited() {
  let m = null;
  try { m = JSON.parse(sessionStorage.getItem('sim4:inherited') || 'null'); } catch (_) { }
  if (!m) return;
  try { sessionStorage.removeItem('sim4:inherited'); } catch (_) { }   /* 一次性：读完即清，刷新不再带 */

  const val = (v) => (typeof v === 'string' ? v.trim() : '');

  // 请假类型 / 需要离校（两个 <span>，各自带 <em> 标签）
  const cols = document.querySelectorAll('.fact__row--2 span');
  if (cols.length >= 2) {
    [['请假类型：', val(m.type)], ['需要离校：', val(m.away)]].forEach((pair, i) => {
      if (!pair[1]) return;
      const em = document.createElement('em');
      em.textContent = pair[0];
      cols[i].textContent = '';
      cols[i].appendChild(em);
      cols[i].appendChild(document.createTextNode(pair[1]));
    });
  }

  const put = (sel, v) => {
    if (!v) return;
    const el = document.querySelector(sel);
    if (el) el.textContent = v;
  };
  put('#startAt', val(m.start));
  put('#endAt', val(m.end));
  put('#reason', val(m.reason));
  put('#loc', val(m.place));
  put('#approver', val(m.approver));

  /* 审批流程弹层里的两个名字也跟着上一页走 */
  inheritedNames.applicant = val(m.applicant);
  inheritedNames.approver = val(m.approver);
  inheritedNames.applyAt = val(m.applyAt);

  // 起止时间变了，时长徽章跟着重算
  const a = val(m.start), b = val(m.end);
  if (a && b) {
    /* 与逆向里的 calcDuration 一致：非法/倒序也照样写回（会显示 —），不留旧值 */
    document.querySelector('#dur').textContent = durText(a, b);
  }
}

/* ---------- 启动 ---------- */
apply(DATA[order[idx]]);
/* 一次性清理：此前按录屏数据自动写入的姓名/学号不要带回来（要空白模板） */
restoreIdentity();
bindIdentity();
applyInherited();
if (/[?&]pending=1/.test(location.search)) togglePending();
if (/[?&]who=(\w+)/.test(location.search)) { const m=/[?&]who=(\S+)/.exec(location.search); if (DATA[m[1]]) { idx = order.indexOf(m[1]); apply(DATA[order[idx]]); } }
tickClock();
setInterval(tickClock, 1000);
runProgress();

window.leavePage = { next, togglePending, apply: (k) => { if (DATA[k]) { idx = order.indexOf(k); apply(DATA[k]); replay(); } } };

/* ============================================================
   分享假条：把当前页面的内容编码进链接，对方打开就是这张假条
   链接形如  …/share/index.html#d=<base64url(JSON)>
   ============================================================ */
function collectShare() {
  const g = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; };
  const cols = [...document.querySelectorAll('.fact__row--2 span')]
    .map((s) => s.textContent.replace(/^[^：]*：/, '').trim());
  return {
    name: g('#whoName'), no: g('#whoNo'),
    type: cols[0] || '', away: cols[1] || '',
    start: g('#startAt'), end: g('#endAt'),
    reason: g('#reason'), place: g('#loc'), approver: g('#approver'),
    applicant: inheritedNames.applicant || g('#whoName'),
    applyAt: inheritedNames.applyAt || ''
  };
}

function toB64Url(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sharePageUrl(token) {
  return new URL('../share/index.html#d=' + token, location.href).href;
}

function buildShareDlg() {
  if (document.getElementById('shareDlg')) return;
  const host = document.querySelector('#stage') || document.querySelector('.screen') || document.body;
  const mask = document.createElement('div');
  mask.className = 'share-mask'; mask.id = 'shareMask'; mask.hidden = true;
  const dlg = document.createElement('div');
  dlg.className = 'share-dlg'; dlg.id = 'shareDlg'; dlg.hidden = true;
  dlg.innerHTML = '<div class="share-dlg__t">分享这张假条</div>' +
    '<div class="share-dlg__link" id="shareLink"></div>' +
    '<div class="share-dlg__ops"><button type="button" class="is-plain" id="shareClose">关闭</button>' +
    '<button type="button" class="is-primary" id="shareCopy">复制链接</button></div>' +
    '<div class="share-dlg__tip" id="shareTip"></div>';
  host.appendChild(mask); host.appendChild(dlg);

  const close = () => {
    dlg.classList.remove('is-open'); mask.classList.remove('is-open');
    setTimeout(() => { dlg.hidden = true; mask.hidden = true; }, 200);
  };
  mask.addEventListener('click', close);
  dlg.querySelector('#shareClose').addEventListener('click', close);

  dlg.querySelector('#shareCopy').addEventListener('click', async () => {
    const text = dlg.querySelector('#shareLink').textContent;
    const tip = dlg.querySelector('#shareTip');
    try {
      await navigator.clipboard.writeText(text);
      tip.textContent = '已复制，粘贴到聊天窗口发给对方即可';
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); tip.textContent = '已复制，粘贴到聊天窗口发给对方即可'; }
      catch (e) { tip.textContent = '复制失败，请长按上面的链接手动选择复制'; }
      ta.remove();
    }
  });
}

/* 离线时用的纯文字版假条 */
function slipText() {
  const d = collectShare();
  const cols = [];
  cols.push('【请假条】');
  if (d.name) cols.push('姓名：' + d.name + (d.no ? '（' + d.no + '）' : ''));
  cols.push('类型：' + (d.type || '-') + '  |  需要离校：' + (d.away || '-'));
  cols.push('时间：' + (d.start || '-') + ' → ' + (d.end || '-') + (document.getElementById('dur') ? '（' + document.getElementById('dur').textContent.trim() + '）' : ''));
  if (d.reason) cols.push('原因：' + d.reason);
  if (d.place) cols.push('地点：' + d.place);
  if (d.approver) cols.push('审批人：' + d.approver);
  cols.push('（本程序仅供交流学习使用）');
  return cols.join('\n');
}

function openShare() {
  buildShareDlg();
  const dlg = document.getElementById('shareDlg');
  const mask = document.getElementById('shareMask');
  const linkEl = dlg.querySelector('#shareLink');
  const tip = dlg.querySelector('#shareTip');

  /* 本地文件 / APK 里没有公网地址，链接发出去别人打不开 */
  const offline = location.protocol === 'file:' || /appassets\.local/.test(location.hostname);
  const token = toB64Url(collectShare());
  const url = offline ? '' : sharePageUrl(token);

  const copyBtn = dlg.querySelector('#shareCopy');
  if (offline) {
    /* 装在 APK 里没有公网地址：改成把假条内容整理成文字，直接粘到聊天窗口 */
    linkEl.textContent = slipText();
    copyBtn.textContent = '复制假条文字';
    tip.textContent = '当前是离线运行，没有可分享的公网地址；把上面的文字发过去，对方同样能看到完整的请假信息。';
  } else {
    linkEl.textContent = url;
    copyBtn.textContent = '复制链接';
    tip.textContent = '链接本身包含假条内容，对方打开即可查看；请不要转发给无关的人。';
  }

  dlg.hidden = false; mask.hidden = false;
  requestAnimationFrame(() => { dlg.classList.add('is-open'); mask.classList.add('is-open'); });
}

/* 右下角一个看不见的热区，点它就是分享（不打扰页面观感） */
function mountShareHotspot() {
  if (document.getElementById('shareBtn')) return;
  const host = document.querySelector('#stage') || document.querySelector('.screen') || document.body;
  const btn = document.createElement('button');
  btn.id = 'shareBtn';
  btn.type = 'button';
  btn.className = 'share-hot';
  btn.setAttribute('aria-label', '分享这张假条');
  host.appendChild(btn);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountShareHotspot);
else mountShareHotspot();

document.addEventListener('click', (e) => {
  if (e.target.closest('#shareBtn')) { openShare(); }
});
