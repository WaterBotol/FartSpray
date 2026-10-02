/* ==========================================================================
   Motion, iOS style. The rules Apple's "fluid interfaces" follow:
   - motion tied to a scroll or a finger is continuous (no on/off toggles):
     bar depth and the large-title collapse track scroll position exactly
   - gestures move 1:1 with the finger, rubber-band past their limits, and on
     release hand the finger's velocity to a real spring; they can be caught
     mid-flight
   - presses respond on touch-down (iOS Safari needs a touch listener for :active)
   Plus: cards settle in as they reach the screen, stats count up, iOS slider
   fill. Everything is skipped when the system asks for reduced motion.
   ========================================================================== */
(function () {
  'use strict';
  const doc = document, body = doc.body, main = doc.getElementById('main');
  if (!main) return;
  const rm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => !!(rm && rm.matches);
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const topbar = doc.querySelector('.topbar'), barTitle = doc.querySelector('.bar-title');
  const IO = 'IntersectionObserver' in window;

  // :active styles only fire on iOS Safari when the page listens for touches
  doc.addEventListener('touchstart', () => {}, { passive: true });

  /* ---- a damped spring (response = period, damping = fraction of critical), integrated per frame so it can
     start from any position and velocity and be interrupted */
  function spring({ from, to, velocity = 0, response = 0.42, damping = 0.88, onUpdate, onDone }) {
    const w = 2 * Math.PI / response, k = w * w, c = 2 * damping * w;
    let x = from, v = velocity, last = performance.now(), raf = 0;
    const step = now => {
      const dt = Math.min(0.034, (now - last) / 1000); last = now;
      for (let i = 0; i < 4; i++) { const a = -k * (x - to) - c * v; v += a * dt / 4; x += v * dt / 4; }
      if (Math.abs(x - to) < 0.25 && Math.abs(v) < 6) { onUpdate(to); if (onDone) onDone(); return; }
      onUpdate(x); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return { stop: () => cancelAnimationFrame(raf), get x() { return x; }, get v() { return v; } };
  }
  // closed-form spring progress (critically damped) for time-based tweens like count-ups
  const springEase = (t, response) => { const w = 2 * Math.PI / response; return 1 - Math.exp(-w * t) * (1 + w * t); };

  /* ---- scroll: continuous bar depth (--sp) and large-title collapse (--tp); tab bar tucks in while reading */
  let lastY = window.scrollY, down = 0, up = 0, ticking = false, h1 = null;
  function onScroll() {
    ticking = false;
    const y = window.scrollY, dy = y - lastY; lastY = y;
    body.style.setProperty('--sp', clamp01(y / 48).toFixed(3));
    if (h1 && barTitle) {
      const r = h1.getBoundingClientRect(), bar = topbar ? topbar.getBoundingClientRect().bottom : 66;
      body.style.setProperty('--tp', clamp01((bar - r.top) / Math.max(1, r.height)).toFixed(3));
    }
    body.classList.toggle('scrolled', y > 4);
    if (dy > 0) { down += dy; up = 0; } else { up -= dy; down = 0; }
    if (y < 120 || up > 18 || body.classList.contains('nav-open') || body.classList.contains('search-open')) body.classList.remove('bar-min');
    else if (down > 28 && !calm()) body.classList.add('bar-min');
  }
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);

  /* ---- cards settle into place as they reach the screen */
  const REVEAL = '.we, .pq, .mcq, .sim-panel, .fig, .tbl, .eq, aside[class^="c-"], .exq, .ex-card, .map-card, .stat, .nt-card, .fs-card, .mstep, .legend > div, .subj-card, .rv-item, .complete-card, .pn, .ex-report, .sample, .transcript';
  let revealObs = null;
  function settle(el) {
    el.classList.add('rv-in');
    const done = () => { el.classList.remove('rv', 'rv-in'); el.removeEventListener('transitionend', done); };
    el.addEventListener('transitionend', done); setTimeout(done, 1000);
  }
  function reveal() {
    if (revealObs) revealObs.disconnect();
    if (calm() || !IO) return;
    const fold = window.innerHeight * 0.92;
    revealObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { revealObs.unobserve(e.target); settle(e.target); } }), { rootMargin: '0px 0px -4% 0px' });
    main.querySelectorAll(REVEAL).forEach(el => {
      if (el.closest('.rv')) return;
      const r = el.getBoundingClientRect();
      if (!r.height || r.top < fold) return;
      el.classList.add('rv'); revealObs.observe(el);
    });
  }

  /* ---- numbers count up on a spring, like the Fitness summaries */
  function countUp() {
    if (calm()) return;
    main.querySelectorAll('.stat b').forEach(b => {
      const m = b.textContent.match(/^(\d+)(.*)$/); if (!m || !+m[1]) return;
      const end = +m[1], rest = m[2], t0 = performance.now(), resp = 0.7;
      const step = t => { const s = (t - t0) / 1000, e = springEase(s, resp); b.textContent = Math.round(end * Math.min(1, e)) + rest; if (e < 0.999) requestAnimationFrame(step); else b.textContent = end + rest; };
      b.textContent = '0' + rest; requestAnimationFrame(step);
    });
  }

  /* ---- iOS slider fill (WebKit/Blink read --p; Firefox draws the fill natively) */
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

  /* ---- course-map sheet (phones): follows the finger, rubber-bands past fully open, and settles on a spring
     carrying the release velocity; a quick flick closes it even if it hasn't moved far */
  const sheet = doc.getElementById('sidebar'), scrim = doc.getElementById('scrim');
  if (sheet && scrim) {
    let x0 = 0, y0 = 0, base = 0, pos = 0, decided = false, drag = false, anim = null, samples = [];
    const active = () => body.classList.contains('nav-open') && window.innerWidth <= 960;
    const closedX = () => -(sheet.getBoundingClientRect().width + 20);   // matches translateX(calc(-100% - 2 * var(--bar-gap)))
    const rubber = d => { const lim = 60; return lim * (1 - 1 / (d / lim * 0.55 + 1)); };
    const place = x => { pos = x; sheet.style.transform = 'translateX(' + x.toFixed(2) + 'px)'; scrim.style.opacity = String(clamp01(1 + x / -closedX())); };
    const finish = closed => {
      anim = null;
      if (closed) { scrim.click(); }
      requestAnimationFrame(() => { sheet.style.transform = ''; scrim.style.opacity = ''; sheet.classList.remove('dragging'); });
    };
    sheet.addEventListener('touchstart', e => {
      if (!active()) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; decided = drag = false; samples = [];
      if (anim) { anim.stop(); base = anim.x; anim = null; drag = decided = true; sheet.classList.add('dragging'); }   // caught mid-flight
      else base = 0;
    }, { passive: true });
    sheet.addEventListener('touchmove', e => {
      if (!active()) return;
      const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
      if (!decided) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; decided = true; drag = Math.abs(mx) > Math.abs(my) * 1.2; if (drag) sheet.classList.add('dragging'); }
      if (!drag) return;
      const raw = base + mx;
      place(raw > 0 ? rubber(raw) : raw);
      samples.push([performance.now(), raw]); if (samples.length > 6) samples.shift();
    }, { passive: true });
    const end = () => {
      if (!drag) return;
      drag = false;
      let v = 0;
      if (samples.length > 1) { const a = samples[0], b = samples[samples.length - 1]; v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]) * 1000; }   // px/s
      const cx = closedX(), projected = pos + v * 0.22, close = projected < cx * 0.45;
      if (calm()) { finish(close); return; }
      anim = spring({ from: pos, to: close ? cx : 0, velocity: v, response: close ? 0.36 : 0.42, damping: close ? 1 : 0.86, onUpdate: place, onDone: () => finish(close) });
    };
    sheet.addEventListener('touchend', end); sheet.addEventListener('touchcancel', end);
  }

  /* ---- every page */
  function settlePage() {
    h1 = main.querySelector('.t-head h1, .hero h1, h1');
    if (barTitle) barTitle.textContent = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
    reveal(); countUp(); fillIn(main); onScroll();
  }
  window.addEventListener('guide:render', () => requestAnimationFrame(settlePage));
  settlePage();
})();
