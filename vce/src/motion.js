/* ==========================================================================
   Motion, iOS style. Small and quiet on purpose:
   - large page title collapses into the glass bar as you scroll (phones)
   - bars gain depth once content scrolls under them; the tab bar shrinks while
     you scroll down and comes back when you scroll up
   - cards ease up into place as they reach the screen; stats count up
   - iOS-style slider fill; swipe the course-map sheet left to dismiss it
   Everything is skipped when the system asks for reduced motion.
   ========================================================================== */
(function () {
  'use strict';
  const doc = document, body = doc.body, main = doc.getElementById('main');
  if (!main) return;
  const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => !!(rm && rm.matches);
  const topbar = doc.querySelector('.topbar'), barTitle = doc.querySelector('.bar-title');
  const IO = 'IntersectionObserver' in window;

  /* ---- scroll: bar depth + tab bar minimise */
  let lastY = window.scrollY, down = 0, up = 0, ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY, dy = y - lastY; lastY = y;
    body.classList.toggle('scrolled', y > 4);
    if (dy > 0) { down += dy; up = 0; } else { up -= dy; down = 0; }
    if (y < 120 || up > 18 || body.classList.contains('nav-open') || body.classList.contains('search-open')) body.classList.remove('bar-min');
    else if (down > 28 && !calm()) body.classList.add('bar-min');
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---- large title -> inline title in the bar */
  let titleObs = null;
  function watchTitle() {
    if (titleObs) titleObs.disconnect();
    body.classList.remove('title-collapsed');
    const h1 = main.querySelector('.t-head h1, .hero h1, h1');
    if (!h1 || !barTitle || !IO) return;
    barTitle.textContent = h1.textContent.replace(/\s+/g, ' ').trim();
    const top = topbar ? Math.round(topbar.getBoundingClientRect().bottom) : 70;
    titleObs = new IntersectionObserver(([e]) => {
      body.classList.toggle('title-collapsed', !e.isIntersecting && e.boundingClientRect.top < top);
    }, { rootMargin: '-' + top + 'px 0px 0px 0px' });
    titleObs.observe(h1);
  }

  /* ---- cards ease into place as they reach the screen */
  const REVEAL = '.we, .pq, .mcq, .sim-panel, .fig, .tbl, .eq, aside[class^="c-"], .exq, .ex-card, .map-card, .stat, .nt-card, .fs-card, .mstep, .legend > div, .subj-card, .rv-item, .complete-card, .pn, .ex-report, .sample, .transcript';
  let revealObs = null;
  function settle(el) {
    el.classList.add('rv-in');
    const done = () => { el.classList.remove('rv', 'rv-in'); el.removeEventListener('transitionend', done); };
    el.addEventListener('transitionend', done); setTimeout(done, 900);
  }
  function reveal() {
    if (revealObs) revealObs.disconnect();
    if (calm() || !IO) return;
    const fold = window.innerHeight * 0.92;
    revealObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { revealObs.unobserve(e.target); settle(e.target); } }), { rootMargin: '0px 0px -5% 0px' });
    main.querySelectorAll(REVEAL).forEach(el => {
      if (el.closest('.rv')) return;                                 // already inside a revealing card
      const r = el.getBoundingClientRect();
      if (!r.height || r.top < fold) return;                         // hidden, or on screen now (the page-in animation covers it)
      el.classList.add('rv'); revealObs.observe(el);
    });
  }

  /* ---- numbers count up, like the Fitness and Health summaries */
  function countUp() {
    if (calm()) return;
    main.querySelectorAll('.stat b').forEach(b => {
      const m = b.textContent.match(/^(\d+)(.*)$/); if (!m || !+m[1]) return;
      const end = +m[1], rest = m[2], t0 = performance.now(), dur = Math.min(900, 420 + end * 3);
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(end * e) + rest; if (k < 1) requestAnimationFrame(step); };
      b.textContent = '0' + rest; requestAnimationFrame(step);
    });
  }

  /* ---- iOS slider: filled track up to the thumb (WebKit/Blink need a CSS variable; Firefox draws it natively) */
  function fillRange(r) {
    const min = r.min === '' ? 0 : +r.min, max = r.max === '' ? 100 : +r.max;
    r.style.setProperty('--p', Math.max(0, Math.min(100, (+r.value - min) / ((max - min) || 1) * 100)).toFixed(2) + '%');
  }
  const fillIn = root => { if (root.querySelectorAll) root.querySelectorAll('input[type="range"]').forEach(fillRange); };
  doc.addEventListener('input', e => { if (e.target.matches && e.target.matches('input[type="range"]')) fillRange(e.target); }, true);
  doc.addEventListener('click', e => { const p = e.target.closest && e.target.closest('.sim-panel'); if (p) requestAnimationFrame(() => fillIn(p)); }, true);
  if ('MutationObserver' in window) new MutationObserver(ms => {
    if (ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches('input[type="range"]') || n.querySelector('input[type="range"]'))))) requestAnimationFrame(() => fillIn(main));
  }).observe(main, { childList: true, subtree: true });

  /* ---- swipe the course-map sheet left to dismiss it */
  const sheet = doc.getElementById('sidebar'), scrim = doc.getElementById('scrim');
  if (sheet && scrim) {
    let sx = 0, sy = 0, dx = 0, decided = false, drag = false;
    const active = () => body.classList.contains('nav-open') && window.innerWidth <= 960;
    sheet.addEventListener('touchstart', e => { if (!active()) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; decided = drag = false; }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!active()) return;
      const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
      if (!decided) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; decided = true; drag = mx < 0 && Math.abs(mx) > Math.abs(my); if (drag) sheet.style.transition = 'none'; }
      if (!drag) return;
      dx = Math.min(0, mx); sheet.style.transform = 'translateX(' + dx + 'px)';
    }, { passive: true });
    const end = () => { if (!drag) return; drag = false; sheet.style.transition = ''; sheet.style.transform = ''; if (dx < -70) scrim.click(); };
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
  }

  /* ---- every page */
  function settlePage() { watchTitle(); reveal(); countUp(); fillIn(main); onScroll(); }
  window.addEventListener('guide:render', () => requestAnimationFrame(settlePage));
  window.addEventListener('resize', () => { if (titleObs) watchTitle(); });
  settlePage();
})();
