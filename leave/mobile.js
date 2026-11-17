'use strict';
/* 手机运行版：按屏宽把 375 宽的舞台等比缩放铺满屏幕 */
(function () {
  const stage = document.getElementById('stage');
  const DESIGN_W = 375;
  const MIN_S = 0.5, MAX_S = 2.4;

  function fit() {
    const vw = window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
    let s = vw / DESIGN_W;
    if (!isFinite(s) || s <= 0) s = 1;
    s = Math.min(MAX_S, Math.max(MIN_S, s));
    document.documentElement.style.setProperty('--s', s.toFixed(4));
    stage.style.transform = 'scale(' + s.toFixed(4) + ')';
  }

  fit();
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(fit, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit, { passive: true });

  /* 双击缩放会破坏等比例还原，禁掉（页面本身仍可正常滚动） */
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch <= 300) e.preventDefault();
    lastTouch = now;
  }, { passive: false });

  window.__sim4fit = fit;
})();
