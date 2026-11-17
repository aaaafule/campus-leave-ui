'use strict';
/* 手机运行版：按屏宽把 375 宽的舞台等比缩放，铺满屏幕。
   同时处理：软键盘弹出时别把页面顶飞、旋转/分屏时重算。 */
(function () {
  const stage = document.getElementById('stage');
  const app = document.getElementById('app');
  const DESIGN_W = 375;
  const MIN_S = 0.5, MAX_S = 2.4;

  function fit() {
    const vw = window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
    let s = vw / DESIGN_W;
    if (!isFinite(s) || s <= 0) s = 1;
    s = Math.min(MAX_S, Math.max(MIN_S, s));
    document.documentElement.style.setProperty('--s', s.toFixed(4));
    stage.style.transform = 'scale(' + s.toFixed(4) + ')';
    /* 舞台加 transform 后，其"布局高度"仍是 100dvh/s，视觉高度正好是视口高 */
  }

  fit();
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));

  /* iOS：软键盘弹起会让 visualViewport 变矮，重算一次避免底部栏被顶上去 */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fit, { passive: true });
  }

  /* 双击缩放：这个版本按设计稿缩放显示，禁掉浏览器二次缩放以保证还原度 */
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  window.__sim3fit = fit;
})();
