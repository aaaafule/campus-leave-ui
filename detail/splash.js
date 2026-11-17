'use strict';
/* ============================================================
   启动动画：白底 + 一行提示文字，淡入 → 停留 → 淡出。
   · 每次「打开程序」播放一次；同一次会话里跳到下一页不再重复
     （sessionStorage 标记，关掉程序自然清掉，与「每次打开都重置」一致）
   · 想跳过：地址后面加 ?nosplash=1
   ============================================================ */
(function () {
  const KEY = 'app:splash-shown';
  const IN_MS = 60;      // 文字开始淡入
  const HOLD_MS = 1300;  // 停留
  const OUT_MS = 650;    // 整块淡出

  if (/[?&]nosplash=1/.test(location.search)) return;
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch (_) { }

  function mount() {
    if (document.getElementById('splash')) return;

    const host = document.querySelector('#stage') || document.querySelector('.screen') || document.body;
    const el = document.createElement('div');
    el.id = 'splash';
    el.innerHTML = '<div class="splash__box"><div class="splash__t">本程序仅供交流学习使用</div></div>';
    host.appendChild(el);

    try { sessionStorage.setItem(KEY, '1'); } catch (_) { }

    /* 下一帧再入场，保证过渡能触发 */
    requestAnimationFrame(() => {
      setTimeout(() => el.classList.add('is-in'), IN_MS);

      setTimeout(() => {
        el.classList.add('is-out');
        setTimeout(() => el.remove(), OUT_MS + 80);
      }, IN_MS + HOLD_MS);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else { mount(); }

  window.__splash = { KEY };
})();
