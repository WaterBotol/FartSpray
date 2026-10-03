/* Mathematical Methods interactives: hero, transformations, secant→tangent, Newton's method,
   rectangle/trapezium rules, binomial, normal and confidence-interval simulations. */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const fx = (x, d) => { if (!isFinite(x)) return '–'; const v = Math.abs(x) < 1e-12 ? 0 : x; return v.toFixed(d == null ? 3 : d); };

  // plot y = f(x) on mapped axes, breaking at discontinuities / out-of-range values
  function curve(ctx, f, M, xr, yr, color, width, dash) {
    const n = 500, span = yr[1] - yr[0];
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 2.2; if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false, prev = null;
    for (let i = 0; i <= n; i++) {
      const x = xr[0] + (xr[1] - xr[0]) * i / n;
      let y; try { y = f(x); } catch (e) { y = NaN; }
      if (!isFinite(y) || Math.abs(y) > 1e6 || (prev !== null && Math.abs(y - prev) > span * 2)) { pen = false; prev = isFinite(y) ? y : null; continue; }
      const yc = K.clamp(y, yr[0] - span, yr[1] + span);
      if (!pen) { ctx.moveTo(M.X(x), M.Y(yc)); pen = true; } else ctx.lineTo(M.X(x), M.Y(yc));
      prev = y;
    }
    ctx.stroke(); ctx.restore();
  }
  function clipBox(ctx, b) { ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip(); }
  function dot(ctx, x, y, r, fill, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke(); } }
  const box = (W, H, l, r, t, b) => ({ x: l, y: t, w: W - l - r, h: H - t - b });
  // standard normal cdf (Abramowitz & Stegun 26.2.17, |error| < 7.5e-8)
  function Phi(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327 * Math.exp(-z * z / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }
  function binomPmf(n, p) {
    const out = new Array(n + 1).fill(0);
    if (p <= 0) { out[0] = 1; return out; }
    if (p >= 1) { out[n] = 1; return out; }
    // log-space for stability
    let lg = 0; const lf = [0];
    for (let k = 1; k <= n; k++) { lg += Math.log(k); lf[k] = lg; }
    for (let k = 0; k <= n; k++) out[k] = Math.exp(lf[n] - lf[k] - lf[n - k] + k * Math.log(p) + (n - k) * Math.log(1 - p));
    return out;
  }
  let spare = null;
  function randn() { if (spare !== null) { const s = spare; spare = null; return s; } let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); const r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v); }

  /* ------------------------------------------------------------------ hero: tangent + area */
  S.heroCalc = function (el) {
    el.innerHTML = '';
    const cvs = K.canvas(el, 0.8, { maxH: 440, minH: 260, label: 'A curve with a draggable point showing the tangent line and the area under the curve.' });
    cvs.wrap.style.border = '0'; cvs.wrap.style.borderRadius = '0';
    const cap = document.createElement('div'); cap.className = 'cap'; el.appendChild(cap);
    const f = x => 1.6 + Math.sin(x) + 0.35 * Math.sin(2.3 * x);
    const df = x => Math.cos(x) + 0.805 * Math.cos(2.3 * x);
    const xr = [0, 6.3], yr = [0, 3.4];
    let a = 2.2;
    const { ctx } = cvs;
    function draw() {
      const W = cvs.W, H = cvs.H, c = K.col();
      ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      K.grid(ctx, W, H, 28, c);
      const b = box(W, H, 18, 18, 18, 38);
      const M = { X: v => b.x + (v - xr[0]) / (xr[1] - xr[0]) * b.w, Y: v => b.y + b.h - (v - yr[0]) / (yr[1] - yr[0]) * b.h };
      // area
      ctx.beginPath(); ctx.moveTo(M.X(0), M.Y(0));
      for (let i = 0; i <= 200; i++) { const x = a * i / 200; ctx.lineTo(M.X(x), M.Y(f(x))); }
      ctx.lineTo(M.X(a), M.Y(0)); ctx.closePath(); ctx.fillStyle = c.accSoft; ctx.fill();
      ctx.strokeStyle = c.line2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x, M.Y(0)); ctx.lineTo(b.x + b.w, M.Y(0)); ctx.stroke();
      curve(ctx, f, M, xr, yr, c.acc, 2.6);
      // tangent
      const m = df(a), y0 = f(a), L = 1.3;
      clipBox(ctx, b);
      ctx.strokeStyle = c.n; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(M.X(a - L), M.Y(y0 - m * L)); ctx.lineTo(M.X(a + L), M.Y(y0 + m * L)); ctx.stroke();
      ctx.restore();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(a), M.Y(0)); ctx.lineTo(M.X(a), M.Y(y0)); ctx.stroke(); ctx.setLineDash([]);
      dot(ctx, M.X(a), M.Y(y0), 8, c.n, c.surface);
      let area = 0; const N = 400; for (let i = 0; i < N; i++) { const x = a * (i + 0.5) / N; area += f(x) * a / N; }
      cap.textContent = 'Drag the point · gradient ' + fx(m, 2) + ' · area ' + fx(area, 2);
      cvs._M = M; cvs._b = b;
    }
    cvs.draw = draw; draw();
    let drag = false;
    const toX = e => { const r = cvs.cv.getBoundingClientRect(); const px = (e.clientX - r.left) * cvs.W / r.width; const b = cvs._b; return K.clamp(xr[0] + (px - b.x) / b.w * (xr[1] - xr[0]), 0.15, 6.2); };
    const down = e => { drag = true; cvs.cv.setPointerCapture(e.pointerId); a = toX(e); draw(); e.preventDefault(); };
    const move = e => { if (!drag) return; a = toX(e); draw(); };
    const up = () => { drag = false; };
    cvs.cv.addEventListener('pointerdown', down); cvs.cv.addEventListener('pointermove', move);
    cvs.cv.addEventListener('pointerup', up); cvs.cv.addEventListener('pointercancel', up);
    const off = K.onTheme(draw);
    return () => { off(); cvs.destroy(); };
  };

  /* ------------------------------------------------------------------ transformations */
  const PARENTS = {
    sq: { name: 'x²', f: x => x * x, key: [1, 1] },
    cube: { name: 'x³', f: x => x * x * x, key: [1, 1] },
    recip: { name: '1/x', f: x => 1 / x, key: [1, 1], va: 0, ha: 0 },
    trunc: { name: '1/x²', f: x => 1 / (x * x), key: [1, 1], va: 0, ha: 0 },
    sqrt: { name: '√x', f: x => x >= 0 ? Math.sqrt(x) : NaN, key: [1, 1] },
    exp: { name: 'eˣ', f: x => Math.exp(x), key: [0, 1], ha: 0 },
    log: { name: 'logₑ x', f: x => x > 0 ? Math.log(x) : NaN, key: [1, 0], va: 0 },
    sin: { name: 'sin x', f: x => Math.sin(x), key: [Math.PI / 2, 1] },
    abs: { name: '|x|', f: x => Math.abs(x), key: [0, 0] }
  };
  S.transform = function (el) {
    return K.mount(el, 'Transformations explorer', 'Choose a parent graph, then change a, n, h and k in y = a·f(n(x − h)) + k. The dashed curve is the original; the marked point shows where one point goes.', ({ body, add }) => {
      const cv = K.canvas(body, 0.62, { maxH: 440, label: 'Parent graph and transformed image' });
      const ctl = K.controls(body);
      const P = K.select(ctl, { label: 'Parent function f(x)', value: 'sq', options: Object.entries(PARENTS).map(([k, v]) => [k, v.name]), onChange: upd });
      const A = K.slider(ctl, { label: 'a (vertical dilation / reflection)', min: -3, max: 3, step: 0.1, value: 1, fmt: v => v.toFixed(1), onInput: upd });
      const Nn = K.slider(ctl, { label: 'n (horizontal: factor 1/n)', min: -3, max: 3, step: 0.1, value: 1, fmt: v => v.toFixed(1), onInput: upd });
      const Hh = K.slider(ctl, { label: 'h (translate right)', min: -5, max: 5, step: 0.25, value: 0, fmt: v => v.toFixed(2), onInput: upd });
      const Kk = K.slider(ctl, { label: 'k (translate up)', min: -5, max: 5, step: 0.25, value: 0, fmt: v => v.toFixed(2), onInput: upd });
      K.buttons(body, [{ label: 'Reset', onClick: () => { A.set(1); Nn.set(1); Hh.set(0); Kk.set(0); upd(); } }]);
      const ro = K.readout(body, [['rule', 'Image rule'], ['map', 'Mapping'], ['seq', 'Sequence (dilate/reflect first, then translate)']]);
      let st = null;
      function upd() {
        let n = Nn.get(); if (Math.abs(n) < 0.1) { n = n < 0 ? -0.1 : 0.1; }
        st = { p: PARENTS[P.get()], a: A.get(), n, h: Hh.get(), k: Kk.get() };
        const { a, h, k, p } = st;
        const num = v => (Math.round(v * 100) / 100).toString().replace('-', '−');
        const coef = n === 1 ? '' : n === -1 ? '−' : num(n);
        const shift = h === 0 ? 'x' : 'x ' + (h > 0 ? '− ' + num(h) : '+ ' + num(-h));
        const inner = h === 0 ? coef + 'x' : (coef ? coef + '(' + shift + ')' : shift);
        const w = t => t === 'x' ? 'x' : '(' + t + ')';
        const FM = { sq: t => w(t) + '²', cube: t => w(t) + '³', recip: t => '1/' + w(t), trunc: t => '1/' + w(t) + '²', sqrt: t => '√' + w(t),
          exp: t => 'e^' + w(t), log: t => 'logₑ' + (t === 'x' ? ' x' : w(t)), sin: t => 'sin' + (t === 'x' ? ' x' : w(t)), abs: t => '|' + t + '|' };
        const body = FM[P.get()](inner);
        ro.set('rule', 'y = ' + (a === 1 ? '' : a === -1 ? '−' : num(a) + (/^[\d.]+$/.test(num(Math.abs(a))) && /^[(\d]/.test(body) ? '·' : '')) + body + (k === 0 ? '' : (k > 0 ? ' + ' : ' − ') + num(Math.abs(k))));
        ro.set('map', '(x, y) → (' + (n === 1 ? 'x' : 'x/' + num(n)) + (h ? (h > 0 ? ' + ' : ' − ') + num(Math.abs(h)) : '') + ', ' + (a === 1 ? 'y' : num(a) + 'y') + (k ? (k > 0 ? ' + ' : ' − ') + num(Math.abs(k)) : '') + ')');
        const s = [];
        if (a === 0) s.push('a = 0 collapses the graph onto y = k');
        else { if (Math.abs(a) !== 1) s.push('dilation factor ' + num(Math.abs(a)) + ' from the x-axis'); if (a < 0) s.push('reflection in the x-axis'); }
        if (Math.abs(n) !== 1) s.push('dilation factor ' + num(1 / Math.abs(n)) + ' from the y-axis');
        if (n < 0) s.push('reflection in the y-axis');
        if (h) s.push('translation ' + num(Math.abs(h)) + (h > 0 ? ' right' : ' left'));
        if (k) s.push('translation ' + num(Math.abs(k)) + (k > 0 ? ' up' : ' down'));
        ro.set('seq', s.length ? s.join('; ') : 'none (identity)');
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const b = box(W, H, 36, 12, 12, 26);
        const xr = [-6, 6], yr = [-6 * b.h / b.w * 1.25, 6 * b.h / b.w * 1.25];
        const M = K.axes(ctx, b, xr, yr, c, { x: 'x', y: 'y' });
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(0), b.y); ctx.lineTo(M.X(0), b.y + b.h); ctx.stroke();
        const { p, a, n, h, k } = st;
        const g = x => a * p.f(n * (x - h)) + k;
        clipBox(ctx, b);
        // asymptotes of image
        ctx.setLineDash([5, 5]); ctx.strokeStyle = c.warn; ctx.lineWidth = 1.2;
        if (p.va !== undefined) { const xa = p.va / n + h; ctx.beginPath(); ctx.moveTo(M.X(xa), b.y); ctx.lineTo(M.X(xa), b.y + b.h); ctx.stroke(); }
        if (p.ha !== undefined) { const ya = a * p.ha + k; ctx.beginPath(); ctx.moveTo(b.x, M.Y(ya)); ctx.lineTo(b.x + b.w, M.Y(ya)); ctx.stroke(); }
        ctx.setLineDash([]);
        curve(ctx, p.f, M, xr, yr, c.muted, 1.8, [6, 5]);
        curve(ctx, g, M, xr, yr, c.acc, 2.8);
        // key point and its image
        const [px, py] = p.key, qx = px / n + h, qy = a * py + k;
        if (isFinite(qx) && isFinite(qy)) {
          K.arrow(ctx, M.X(px), M.Y(py), M.X(qx), M.Y(qy), c.v, 1.6, 8);
          dot(ctx, M.X(px), M.Y(py), 5, c.surface, c.muted);
          dot(ctx, M.X(qx), M.Y(qy), 6, c.v, c.surface);
          K.text(ctx, '(' + fx(px, 2) + ', ' + fx(py, 2) + ') → (' + fx(qx, 2) + ', ' + fx(qy, 2) + ')', b.x + 8, b.y + 16, { size: 12, color: c.v, mono: true, c });
        }
        ctx.restore();
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ secant → tangent */
  const TFUN = {
    sq: { name: 'x²', f: x => x * x, d: x => 2 * x, xr: [-3, 3], yr: [-1, 7] },
    cub: { name: 'x³ − 2x', f: x => x * x * x - 2 * x, d: x => 3 * x * x - 2, xr: [-2.5, 2.5], yr: [-5, 5] },
    sin: { name: 'sin x', f: Math.sin, d: Math.cos, xr: [-1, 7], yr: [-2, 2] },
    exp: { name: 'eˣ', f: Math.exp, d: Math.exp, xr: [-3, 2.5], yr: [-1, 8] }
  };
  S.tangent = function (el) {
    return K.mount(el, 'From secant to tangent', 'The gradient of the secant through (a, f(a)) and (a + h, f(a + h)) approaches the derivative f′(a) as h → 0. Press “Shrink h” to watch it happen.', ({ body, add }) => {
      const cv = K.canvas(body, 0.58, { maxH: 420, label: 'Curve with secant and tangent lines' });
      const ctl = K.controls(body);
      const F = K.select(ctl, { label: 'Function', value: 'sq', options: Object.entries(TFUN).map(([k, v]) => [k, 'f(x) = ' + v.name]), onChange: () => { const t = TFUN[F.get()]; A.input.min = t.xr[0] + 0.5; A.input.max = t.xr[1] - 0.5; A.set(K.clamp(A.get(), t.xr[0] + 0.5, t.xr[1] - 0.5)); upd(); } });
      const A = K.slider(ctl, { label: 'a', min: -2.5, max: 2.5, step: 0.05, value: 1, fmt: v => v.toFixed(2), onInput: upd });
      const Hs = K.slider(ctl, { label: 'h', min: -2, max: 2, step: 0.01, value: 1.5, fmt: v => v.toFixed(2), onInput: upd });
      let anim = null;
      K.buttons(body, [
        { label: 'Shrink h → 0', primary: true, onClick: () => {
          if (anim) anim();
          if (K.reduced()) { Hs.set(Math.sign(Hs.get() || 1) * 0.01); upd(); return; }
          anim = K.loop(dt => { const h = Hs.get(); const nh = h * Math.pow(0.25, dt); if (Math.abs(nh) < 0.01) { Hs.set(Math.sign(h) * 0.01); upd(); anim(); anim = null; return; } Hs.set(nh); upd(); }, cv.cv);
        } },
        { label: 'Reset h', onClick: () => { if (anim) { anim(); anim = null; } Hs.set(1.5); upd(); } }
      ]);
      add(() => anim && anim());
      const ro = K.readout(body, [['sec', 'Secant gradient [f(a+h) − f(a)]/h'], ['der', 'Derivative f′(a)'], ['diff', 'Difference']]);
      let st = null;
      function upd() {
        let h = Hs.get(); if (Math.abs(h) < 0.005) h = 0.005;
        const t = TFUN[F.get()], a = A.get();
        const sec = (t.f(a + h) - t.f(a)) / h, der = t.d(a);
        st = { t, a, h, sec, der };
        ro.set('sec', fx(sec, 4)); ro.set('der', fx(der, 4)); ro.set('diff', fx(sec - der, 4), Math.abs(sec - der) < 0.05 ? 'good' : '');
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const { t, a, h, sec, der } = st;
        const b = box(W, H, 40, 12, 14, 28);
        const M = K.axes(ctx, b, t.xr, t.yr, c, { x: 'x', y: 'y' });
        if (t.xr[0] < 0 && t.xr[1] > 0) { ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(0), b.y); ctx.lineTo(M.X(0), b.y + b.h); ctx.stroke(); }
        clipBox(ctx, b);
        curve(ctx, t.f, M, t.xr, t.yr, c.acc, 2.6);
        const ya = t.f(a), yb = t.f(a + h);
        const line = (m, col, w, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(M.X(t.xr[0]), M.Y(ya + m * (t.xr[0] - a))); ctx.lineTo(M.X(t.xr[1]), M.Y(ya + m * (t.xr[1] - a))); ctx.stroke(); ctx.restore(); };
        line(der, c.muted, 1.6, [6, 5]);
        line(sec, c.n, 2.2);
        dot(ctx, M.X(a), M.Y(ya), 6, c.ink, c.surface);
        dot(ctx, M.X(a + h), M.Y(yb), 6, c.n, c.surface);
        ctx.restore();
        K.text(ctx, 'secant', b.x + 8, b.y + 16, { size: 12, color: c.n, bold: true, c });
        K.text(ctx, 'tangent (dashed)', b.x + 62, b.y + 16, { size: 12, color: c.muted, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ Newton's method */
  const NFUN = {
    sqrt2: { name: 'x² − 2', f: x => x * x - 2, d: x => 2 * x, x0: 1, xr: [0.4, 2.2], yr: [-2.2, 3] },
    cubic: { name: 'x³ − 2x − 5', f: x => x * x * x - 2 * x - 5, d: x => 3 * x * x - 2, x0: 2, xr: [1, 3], yr: [-7, 16] },
    cycle: { name: 'x³ − 2x + 2 (cycles!)', f: x => x * x * x - 2 * x + 2, d: x => 3 * x * x - 2, x0: 0, xr: [-2.5, 2], yr: [-4, 6] },
    cos: { name: 'cos x − x', f: x => Math.cos(x) - x, d: x => -Math.sin(x) - 1, x0: 1, xr: [-1, 2.5], yr: [-3, 2] },
    flat: { name: 'x³ − 3x + 1 (flat tangent)', f: x => x * x * x - 3 * x + 1, d: x => 3 * x * x - 3, x0: 1.05, xr: [-2.5, 2.5], yr: [-4, 6] }
  };
  S.newton = function (el) {
    return K.mount(el, "Newton's method", 'Pick a function and a starting value x₀, then press “Next step”. Each tangent line meets the x-axis at the next estimate. Try the cycling and flat-tangent examples to see the method fail.', ({ body, add }) => {
      const cv = K.canvas(body, 0.58, { maxH: 420, label: 'Curve with successive tangent lines from Newton’s method' });
      const ctl = K.controls(body);
      const F = K.select(ctl, { label: 'f(x)', value: 'sqrt2', options: Object.entries(NFUN).map(([k, v]) => [k, v.name]), onChange: () => { const t = NFUN[F.get()]; X0.input.min = t.xr[0]; X0.input.max = t.xr[1]; X0.set(t.x0); reset(); } });
      const X0 = K.slider(ctl, { label: 'x₀', min: -1, max: 3, step: 0.01, value: 1, fmt: v => v.toFixed(2), onInput: reset });
      K.buttons(body, [{ label: 'Next step', primary: true, onClick: step }, { label: 'Reset', onClick: reset }]);
      const ro = K.readout(body, [['it', 'Iterates'], ['fx', 'f(latest)'], ['st', 'Status']]);
      let xs = [];
      function reset() { xs = [X0.get()]; report(); draw(); }
      function step() {
        const t = NFUN[F.get()], x = xs[xs.length - 1], d = t.d(x);
        if (xs.length > 12) { ro.set('st', 'Stopped after 12 steps', ''); return; }
        if (Math.abs(d) < 1e-10) { ro.set('st', 'f′(xₙ) = 0: horizontal tangent, the method fails', 'bad'); return; }
        xs.push(x - t.f(x) / d); report(); draw();
      }
      function report() {
        const t = NFUN[F.get()], last = xs[xs.length - 1];
        ro.set('it', xs.map((v, i) => 'x' + K.sup(i).replace(/./g, ch => ({ '⁰': '₀', '¹': '₁', '²': '₂', '³': '₃', '⁴': '₄', '⁵': '₅', '⁶': '₆', '⁷': '₇', '⁸': '₈', '⁹': '₉' }[ch] || ch)) + ' = ' + fx(v, 6)).slice(-5).join(', '));
        ro.set('fx', fx(t.f(last), 6));
        let s = 'press Next step', cls = '';
        if (xs.length > 1) {
          const dl = Math.abs(xs[xs.length - 1] - xs[xs.length - 2]);
          if (Math.abs(t.f(last)) < 1e-6) { s = 'converged (|f| < 10⁻⁶)'; cls = 'good'; }
          else if (xs.length > 3 && Math.abs(xs[xs.length - 1] - xs[xs.length - 3]) < 1e-9) { s = 'cycling: the estimates repeat'; cls = 'bad'; }
          else if (Math.abs(last) > 50) { s = 'diverging: the estimate shot away'; cls = 'bad'; }
          else s = 'last change ' + fx(dl, 6);
        }
        ro.set('st', s, cls);
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const t = NFUN[F.get()];
        const b = box(W, H, 40, 12, 14, 28);
        const M = K.axes(ctx, b, t.xr, t.yr, c, { x: 'x', y: 'y' });
        if (t.xr[0] < 0 && t.xr[1] > 0) { ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(0), b.y); ctx.lineTo(M.X(0), b.y + b.h); ctx.stroke(); }
        clipBox(ctx, b);
        curve(ctx, t.f, M, t.xr, t.yr, c.acc, 2.6);
        for (let i = 0; i < xs.length; i++) {
          const x = xs[i], y = t.f(x);
          ctx.setLineDash([3, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(x), M.Y(0)); ctx.lineTo(M.X(x), M.Y(y)); ctx.stroke(); ctx.setLineDash([]);
          if (i < xs.length - 1) {
            ctx.strokeStyle = c.n; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.5 + 0.5 * (i + 1) / xs.length;
            ctx.beginPath(); ctx.moveTo(M.X(x), M.Y(y)); ctx.lineTo(M.X(xs[i + 1]), M.Y(0)); ctx.stroke(); ctx.globalAlpha = 1;
          }
          dot(ctx, M.X(x), M.Y(0), 4.5, i === xs.length - 1 ? c.v : c.ink);
          dot(ctx, M.X(x), M.Y(y), 3.5, c.n);
        }
        ctx.restore();
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      F.set('sqrt2'); X0.set(1); reset();
    });
  };

  /* ------------------------------------------------------------------ rectangles and trapeziums */
  const QFUN = {
    sq: { name: 'x² on [0, 2]', f: x => x * x, a: 0, b: 2, exact: 8 / 3, yr: [0, 4.4] },
    sqrt: { name: '√x on [0, 4]', f: x => Math.sqrt(Math.max(0, x)), a: 0, b: 4, exact: 16 / 3, yr: [0, 2.3] },
    recip: { name: '1/x on [1, 3]', f: x => 1 / x, a: 1, b: 3, exact: Math.log(3), yr: [0, 1.1] },
    sin: { name: 'sin x on [0, π]', f: Math.sin, a: 0, b: Math.PI, exact: 2, yr: [0, 1.15] },
    exp: { name: 'e⁻ˣ on [0, 2]', f: x => Math.exp(-x), a: 0, b: 2, exact: 1 - Math.exp(-2), yr: [0, 1.1] }
  };
  S.trapezium = function (el) {
    return K.mount(el, 'Rectangles and trapeziums', 'Estimate the area under a curve with left rectangles, right rectangles or trapeziums. Increase the number of strips and watch the error shrink.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Area under a curve approximated by strips' });
      const ctl = K.controls(body);
      const F = K.select(ctl, { label: 'Function and interval', value: 'sq', options: Object.entries(QFUN).map(([k, v]) => [k, v.name]), onChange: upd });
      const Mth = K.select(ctl, { label: 'Method', value: 'trap', options: [['left', 'Left rectangles'], ['right', 'Right rectangles'], ['trap', 'Trapezium rule']], onChange: upd });
      const Nn = K.slider(ctl, { label: 'Number of strips n', min: 1, max: 24, step: 1, value: 4, onInput: upd });
      const ro = K.readout(body, [['est', 'Estimate'], ['ex', 'Exact value'], ['err', 'Error (estimate − exact)'], ['ou', 'Over or under?']]);
      let st = null;
      function upd() {
        const t = QFUN[F.get()], n = Nn.get(), m = Mth.get(), h = (t.b - t.a) / n;
        let s = 0;
        for (let i = 0; i < n; i++) {
          const xl = t.a + i * h, xr = xl + h;
          s += m === 'left' ? t.f(xl) * h : m === 'right' ? t.f(xr) * h : (t.f(xl) + t.f(xr)) * h / 2;
        }
        st = { t, n, m, h, s };
        const e = s - t.exact;
        ro.set('est', fx(s, 5)); ro.set('ex', fx(t.exact, 5)); ro.set('err', fx(e, 5));
        ro.set('ou', Math.abs(e) < 1e-9 ? 'exact' : e > 0 ? 'overestimate' : 'underestimate', e > 0 ? 'bad' : 'good');
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const { t, n, m, h } = st;
        const pad = (t.b - t.a) * 0.08;
        const b = box(W, H, 40, 12, 14, 28);
        const xr = [t.a - pad, t.b + pad];
        const M = K.axes(ctx, b, xr, t.yr, c, { x: 'x', y: 'y' });
        ctx.fillStyle = c.accSoft; ctx.strokeStyle = c.n; ctx.lineWidth = 1.4;
        for (let i = 0; i < n; i++) {
          const xl = t.a + i * h, xr2 = xl + h;
          ctx.beginPath();
          if (m === 'trap') { ctx.moveTo(M.X(xl), M.Y(0)); ctx.lineTo(M.X(xl), M.Y(t.f(xl))); ctx.lineTo(M.X(xr2), M.Y(t.f(xr2))); ctx.lineTo(M.X(xr2), M.Y(0)); }
          else { const y = m === 'left' ? t.f(xl) : t.f(xr2); ctx.rect(M.X(xl), M.Y(y), M.X(xr2) - M.X(xl), M.Y(0) - M.Y(y)); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        clipBox(ctx, b);
        curve(ctx, t.f, M, xr, t.yr, c.acc, 2.6);
        ctx.restore();
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ binomial */
  S.binomial = function (el) {
    return K.mount(el, 'Binomial distribution explorer', 'Change n and p to see the shape of Bi(n, p). Use the range sliders to shade P(a ≤ X ≤ b).', ({ body, add }) => {
      const cv = K.canvas(body, 0.46, { maxH: 360, label: 'Bar chart of a binomial distribution' });
      const ctl = K.controls(body);
      const Nn = K.slider(ctl, { label: 'n (trials)', min: 1, max: 60, step: 1, value: 10, onInput: upd });
      const Pp = K.slider(ctl, { label: 'p (success probability)', min: 0, max: 1, step: 0.01, value: 0.3, fmt: v => v.toFixed(2), onInput: upd });
      const Aa = K.slider(ctl, { label: 'a (lower)', min: 0, max: 60, step: 1, value: 3, onInput: upd });
      const Bb = K.slider(ctl, { label: 'b (upper)', min: 0, max: 60, step: 1, value: 10, onInput: upd });
      const ro = K.readout(body, [['pr', 'P(a ≤ X ≤ b)'], ['e', 'E(X) = np'], ['sd', 'sd(X) = √(np(1 − p))'], ['mode', 'Most likely value']]);
      let st = null;
      function upd() {
        const n = Nn.get(), p = Pp.get();
        Aa.input.max = n; Bb.input.max = n;
        let a = Math.min(Aa.get(), n), b = Math.min(Bb.get(), n);
        if (a > b) { const t = a; a = b; b = t; }
        const pm = binomPmf(n, p);
        let pr = 0; for (let k = a; k <= b; k++) pr += pm[k];
        let mode = 0; pm.forEach((v, k) => { if (v > pm[mode]) mode = k; });
        st = { n, p, a, b, pm };
        ro.set('pr', 'P(' + a + ' ≤ X ≤ ' + b + ') = ' + fx(pr, 4));
        ro.set('e', fx(n * p, 3)); ro.set('sd', fx(Math.sqrt(n * p * (1 - p)), 3)); ro.set('mode', String(mode));
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const { n, a, b, pm } = st;
        const ymax = Math.max(0.05, ...pm) * 1.15;
        const bx = box(W, H, 44, 12, 14, 28);
        const M = K.axes(ctx, bx, [-0.5, n + 0.5], [0, ymax], c, { x: 'x', y: 'P(X = x)', xfmt: v => Number.isInteger(v) ? String(v) : '' });
        const bw = Math.max(1, (M.X(1) - M.X(0)) * 0.78);
        for (let k = 0; k <= n; k++) {
          const x = M.X(k) - bw / 2, y = M.Y(pm[k]);
          ctx.fillStyle = k >= a && k <= b ? c.acc : c.s3;
          ctx.fillRect(x, y, bw, M.Y(0) - y);
        }
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ normal */
  S.normal = function (el) {
    return K.mount(el, 'Normal distribution explorer', 'Set μ and σ, then choose bounds to shade P(a &lt; X &lt; b). Turn on the 68–95–99.7 guide to see the rule.', ({ body, add }) => {
      const cv = K.canvas(body, 0.46, { maxH: 360, label: 'Normal curve with shaded probability' });
      const ctl = K.controls(body);
      const Mu = K.slider(ctl, { label: 'Mean μ', min: 0, max: 200, step: 1, value: 170, onInput: upd });
      const Sg = K.slider(ctl, { label: 'Standard deviation σ', min: 1, max: 40, step: 0.5, value: 8, fmt: v => v.toFixed(1), onInput: upd });
      const Aa = K.slider(ctl, { label: 'Lower bound a', min: -100, max: 300, step: 0.5, value: 180, fmt: v => v.toFixed(1), onInput: upd });
      const Bb = K.slider(ctl, { label: 'Upper bound b', min: -100, max: 300, step: 0.5, value: 300, fmt: v => v >= 300 ? '∞' : v.toFixed(1), onInput: upd });
      const G = K.check(ctl, { label: 'Show 68–95–99.7 guide', value: false, onChange: upd });
      const ro = K.readout(body, [['z', 'z-scores'], ['pr', 'P(a < X < b)']]);
      let st = null;
      function upd() {
        const mu = Mu.get(), s = Sg.get();
        let a = Aa.get(), b = Bb.get() >= 300 ? Infinity : Bb.get();
        if (a > b) { const t = a; a = b; b = t; }
        const za = (a - mu) / s, zb = (b - mu) / s;
        const pr = (isFinite(zb) ? Phi(zb) : 1) - Phi(za);
        st = { mu, s, a, b };
        ro.set('z', 'z(a) = ' + fx(za, 3) + ', z(b) = ' + (isFinite(zb) ? fx(zb, 3) : '∞'));
        ro.set('pr', fx(pr, 4));
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const { mu, s, a, b } = st;
        const xr = [mu - 4 * s, mu + 4 * s], pdf = x => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
        const top = pdf(mu) * 1.15;
        const bx = box(W, H, 50, 12, 14, 28);
        const M = K.axes(ctx, bx, xr, [0, top], c, { x: 'x', yfmt: v => v.toPrecision(2) });
        // shade
        const lo = Math.max(a, xr[0]), hi = Math.min(b, xr[1]);
        if (hi > lo) {
          ctx.beginPath(); ctx.moveTo(M.X(lo), M.Y(0));
          for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200; ctx.lineTo(M.X(x), M.Y(pdf(x))); }
          ctx.lineTo(M.X(hi), M.Y(0)); ctx.closePath(); ctx.fillStyle = c.accSoft; ctx.fill();
        }
        if (G.get()) {
          [[1, '68%'], [2, '95%'], [3, '99.7%']].forEach(([k, lab], i) => {
            const y = M.Y(top * (0.9 - i * 0.12));
            ctx.strokeStyle = c.v; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(M.X(mu - k * s), y); ctx.lineTo(M.X(mu + k * s), y); ctx.stroke();
            [mu - k * s, mu + k * s].forEach(x => { ctx.beginPath(); ctx.moveTo(M.X(x), y - 4); ctx.lineTo(M.X(x), y + 4); ctx.stroke(); });
            K.text(ctx, lab + ' within ' + k + 'σ', M.X(mu + k * s) + 4, y + 4, { size: 11, color: c.v, c });
          });
        }
        curve(ctx, pdf, M, xr, [0, top], c.acc, 2.6);
        ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(mu), M.Y(0)); ctx.lineTo(M.X(mu), M.Y(pdf(mu))); ctx.stroke(); ctx.setLineDash([]);
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ confidence intervals */
  S.ci = function (el) {
    return K.mount(el, 'Confidence interval simulator', 'Set the true proportion p and the sample size, then take samples. Each line is one sample’s confidence interval; red ones miss the true p. About 95% of 95% intervals should capture it.', ({ body, add }) => {
      const cv = K.canvas(body, 0.55, { maxH: 420, label: 'Stack of simulated confidence intervals around the true proportion' });
      const ctl = K.controls(body);
      const Pp = K.slider(ctl, { label: 'True proportion p', min: 0.05, max: 0.95, step: 0.01, value: 0.4, fmt: v => v.toFixed(2), onInput: clear });
      const Nn = K.slider(ctl, { label: 'Sample size n', min: 20, max: 1000, step: 10, value: 100, onInput: clear });
      const L = K.select(ctl, { label: 'Confidence level', value: '1.96', options: [['1.645', '90%'], ['1.96', '95%'], ['2.576', '99%']], onChange: clear });
      K.buttons(body, [{ label: 'Take 1 sample', onClick: () => take(1) }, { label: 'Take 100 samples', primary: true, onClick: () => take(100) }, { label: 'Clear', onClick: clear }]);
      const ro = K.readout(body, [['last', 'Latest sample'], ['cap', 'Intervals containing p'], ['w', 'Typical margin of error']]);
      let ivs = [];
      function sample(n, p) {
        if (n * p * (1 - p) > 25) return Math.round(K.clamp(n * p + randn() * Math.sqrt(n * p * (1 - p)), 0, n));
        let x = 0; for (let i = 0; i < n; i++) if (Math.random() < p) x++; return x;
      }
      function take(k) {
        const p = Pp.get(), n = Nn.get(), z = +L.get();
        for (let i = 0; i < k; i++) {
          const x = sample(n, p), ph = x / n, m = z * Math.sqrt(ph * (1 - ph) / n);
          ivs.push({ ph, lo: ph - m, hi: ph + m, hit: ph - m <= p && p <= ph + m });
        }
        if (ivs.length > 300) ivs = ivs.slice(-300);
        report(); draw();
      }
      function clear() { ivs = []; report(); draw(); }
      function report() {
        const p = Pp.get(), n = Nn.get(), z = +L.get();
        ro.set('w', '≈ ±' + fx(z * Math.sqrt(p * (1 - p) / n), 4));
        if (!ivs.length) { ro.set('last', 'none yet'); ro.set('cap', '–'); return; }
        const l = ivs[ivs.length - 1];
        ro.set('last', 'p̂ = ' + fx(l.ph, 3) + ' → (' + fx(l.lo, 3) + ', ' + fx(l.hi, 3) + ')', l.hit ? 'good' : 'bad');
        const h = ivs.filter(v => v.hit).length;
        ro.set('cap', h + ' / ' + ivs.length + ' = ' + fx(100 * h / ivs.length, 1) + '%');
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col();
        K.clear(ctx, W, H, c);
        const p = Pp.get(), n = Nn.get(), z = +L.get();
        const m0 = z * Math.sqrt(p * (1 - p) / n) * 3.2;
        const xr = [Math.max(0, p - m0), Math.min(1, p + m0)];
        const bx = box(W, H, 20, 16, 14, 30);
        const M = K.axes(ctx, bx, xr, [0, 1], c, { x: 'proportion', yfmt: () => '' });
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M.X(p), bx.y); ctx.lineTo(M.X(p), bx.y + bx.h); ctx.stroke();
        const shown = ivs.slice(-100), rowH = bx.h / 102;
        shown.forEach((v, i) => {
          const y = bx.y + bx.h - (i + 1.5) * rowH;
          ctx.strokeStyle = v.hit ? c.acc : c.bad; ctx.lineWidth = Math.max(1, rowH * 0.55);
          ctx.beginPath(); ctx.moveTo(M.X(Math.max(xr[0], v.lo)), y); ctx.lineTo(M.X(Math.min(xr[1], v.hi)), y); ctx.stroke();
        });
        ctx.font = '700 12px ' + c.font; const lw = ctx.measureText('true p = 0.00').width + 10;
        ctx.fillStyle = c.surface; ctx.fillRect(M.X(p) + 4, bx.y + 1, lw, 17); ctx.strokeStyle = c.line2; ctx.lineWidth = 1; ctx.strokeRect(M.X(p) + 4, bx.y + 1, lw, 17);
        K.text(ctx, 'true p = ' + p.toFixed(2), M.X(p) + 9, bx.y + 14, { size: 12, bold: true, c });
        if (!shown.length) K.text(ctx, 'Press “Take 100 samples”', bx.x + bx.w / 2, bx.y + bx.h / 2, { align: 'center', color: c.muted, size: 13, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      clear();
    });
  };
})();
