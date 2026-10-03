/* ==========================================================================
   Simulation toolkit: panels, canvases, controls, readouts, theme colours.
   Each simulation is SIMS[name](el) and returns a cleanup function.
   ========================================================================== */
(function () {
  'use strict';
  const SIMS = window.SIMS = window.SIMS || {};
  const K = window.SIMKIT = {};
  K.g = 9.8;

  K.col = function () {
    const cs = getComputedStyle(document.body || document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    return {
      bg: v('--bg'), surface: v('--surface'), s2: v('--surface-2'), s3: v('--surface-3'),
      ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'), line: v('--line'), line2: v('--line-2'),
      acc: v('--accent'), accSoft: v('--accent-soft'), w: v('--fw'), n: v('--fn'), t: v('--ft'), f: v('--ff'),
      net: v('--fnet'), v: v('--fv'), good: v('--good'), bad: v('--bad'), warn: v('--warn'), grid: v('--grid'),
      font: v('--font-body') || 'system-ui, sans-serif', mono: v('--font-mono') || 'monospace'
    };
  };

  K.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  K.panel = function (el, title, desc) {
    el.innerHTML = '<div class="sim-panel"><div class="sim-head"><span class="sim-tag">Interactive</span><h4>' + title + '</h4>' +
      (desc ? '<p class="sim-desc">' + desc + '</p>' : '') + '</div><div class="sim-body"></div></div>';
    return el.querySelector('.sim-body');
  };

  let uid = 0;
  K.id = p => (p || 'sim') + '-' + (++uid);

  // Responsive HiDPI canvas. draw() is called on resize and theme change.
  K.canvas = function (parent, aspect, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'sim-canvas-wrap';
    const cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    if (opts.label) cv.setAttribute('aria-label', opts.label);
    wrap.appendChild(cv);
    parent.appendChild(wrap);
    const ctx = cv.getContext('2d');
    const api = { cv, ctx, wrap, W: 0, H: 0, draw: null };
    const size = () => {
      const w = Math.max(260, wrap.clientWidth || 600);
      let h = Math.round(w * aspect);
      if (opts.maxH) h = Math.min(h, opts.maxH);
      if (opts.minH) h = Math.max(h, opts.minH);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.W = w; api.H = h;
      if (api.draw) api.draw();
    };
    api.resize = size;
    let ro = null;
    if ('ResizeObserver' in window) { ro = new ResizeObserver(() => size()); ro.observe(wrap); }
    else window.addEventListener('resize', size);
    api.destroy = () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', size); };
    size();
    return api;
  };

  K.controls = function (parent) { const d = document.createElement('div'); d.className = 'sim-controls'; parent.appendChild(d); return d; };

  K.slider = function (parent, o) {
    const id = K.id('rng');
    const lab = document.createElement('label');
    lab.className = 'ctl';
    lab.setAttribute('for', id);
    lab.innerHTML = '<span class="ctl-top"><span>' + o.label + '</span><output></output></span><input type="range" id="' + id + '">';
    const inp = lab.querySelector('input'), out = lab.querySelector('output');
    inp.min = o.min; inp.max = o.max; inp.step = o.step || 'any'; inp.value = o.value;
    const toVal = o.toVal || (x => +x);
    const fromVal = o.fromVal || (x => x);
    if (o.toVal) inp.value = fromVal(o.value);
    const fmt = o.fmt || (x => String(x));
    const api = {
      el: lab, input: inp,
      get: () => toVal(+inp.value),
      set: v => { inp.value = fromVal(v); out.textContent = fmt(api.get()); }
    };
    out.textContent = fmt(api.get());
    inp.addEventListener('input', () => { out.textContent = fmt(api.get()); if (o.onInput) o.onInput(api.get()); });
    parent.appendChild(lab);
    return api;
  };

  K.select = function (parent, o) {
    const id = K.id('sel');
    const lab = document.createElement('label');
    lab.className = 'ctl';
    lab.setAttribute('for', id);
    lab.innerHTML = '<span class="ctl-top"><span>' + o.label + '</span></span><select id="' + id + '"></select>';
    const sel = lab.querySelector('select');
    o.options.forEach(([v, t]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; sel.appendChild(op); });
    sel.value = o.value;
    sel.addEventListener('change', () => o.onChange && o.onChange(sel.value));
    parent.appendChild(lab);
    return { el: lab, input: sel, get: () => sel.value, set: v => { sel.value = v; } };
  };

  K.check = function (parent, o) {
    const id = K.id('chk');
    const lab = document.createElement('label');
    lab.className = 'ctl-check';
    lab.setAttribute('for', id);
    lab.innerHTML = '<input type="checkbox" id="' + id + '"><span>' + o.label + '</span>';
    const inp = lab.querySelector('input');
    inp.checked = !!o.value;
    inp.addEventListener('change', () => o.onChange && o.onChange(inp.checked));
    parent.appendChild(lab);
    return { el: lab, input: inp, get: () => inp.checked, set: v => { inp.checked = !!v; } };
  };

  K.buttons = function (parent, list) {
    const d = document.createElement('div'); d.className = 'sim-btns';
    list.forEach(b => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label; el.addEventListener('click', b.onClick); d.appendChild(el);
    });
    parent.appendChild(d);
    return d;
  };

  K.readout = function (parent, items) {
    const d = document.createElement('div'); d.className = 'sim-readout';
    const map = {};
    items.forEach(([k, label]) => {
      const r = document.createElement('div'); r.className = 'ro';
      r.innerHTML = '<span>' + label + '</span><b>–</b>';
      d.appendChild(r); map[k] = r;
    });
    parent.appendChild(d);
    return {
      el: d,
      set(k, text, cls) { const r = map[k]; if (!r) return; r.querySelector('b').textContent = text; r.className = 'ro' + (cls ? ' ' + cls : ''); }
    };
  };

  K.note = function (parent) { const p = document.createElement('p'); p.className = 'sim-note'; p.setAttribute('aria-live', 'polite'); parent.appendChild(p); return p; };

  K.onTheme = function (fn) { window.addEventListener('guide:theme', fn); return () => window.removeEventListener('guide:theme', fn); };

  K.reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Animation loop with dt in seconds; pauses automatically when the canvas is off-screen.
  K.loop = function (fn, target) {
    let raf = 0, last = 0, visible = true, stopped = false, io = null;
    const tick = t => {
      if (stopped) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (visible) fn(dt);
      raf = requestAnimationFrame(tick);
    };
    if (target && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) last = 0; });
      io.observe(target);
    }
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); if (io) io.disconnect(); };
  };

  // Number formatting
  K.sig = function (x, s) {
    s = s || 3;
    if (!isFinite(x)) return '∞';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e5 || a < 1e-3) {
      const e = Math.floor(Math.log10(a));
      const m = x / Math.pow(10, e);
      return m.toFixed(Math.max(0, s - 1)) + ' × 10' + K.sup(e);
    }
    const d = Math.max(0, s - 1 - Math.floor(Math.log10(a)));
    return x.toFixed(Math.min(d, 6));
  };
  K.sup = function (n) {
    const m = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(n).split('').map(c => m[c] || c).join('');
  };
  K.clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Drawing helpers
  K.arrow = function (ctx, x1, y1, x2, y2, color, width, head) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    if (len < 1) return;
    head = head || Math.min(10, Math.max(6, len * 0.35));
    const ux = dx / len, uy = dy / len;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width || 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.8, y2 - uy * head * 0.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * head - uy * head * 0.5, y2 - uy * head + ux * head * 0.5);
    ctx.lineTo(x2 - ux * head + uy * head * 0.5, y2 - uy * head - ux * head * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  K.text = function (ctx, str, x, y, o) {
    o = o || {};
    const c = o.c || K._c;
    ctx.save();
    ctx.fillStyle = o.color || (c ? c.ink : '#000');
    ctx.font = (o.bold ? '700 ' : '') + (o.size || 12.5) + 'px ' + (o.mono ? (c ? c.mono : 'monospace') : (c ? c.font : 'sans-serif'));
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.restore();
  };
  K.clear = function (ctx, W, H, c) { ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H); };
  K.grid = function (ctx, W, H, step, c) {
    ctx.save(); ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    for (let x = step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.restore();
  };
  // nice tick step for an axis range
  K.niceStep = function (range, target) {
    const raw = range / (target || 5);
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  };
  // Axes box: returns mapping functions
  K.axes = function (ctx, box, xr, yr, c, labels) {
    const { x, y, w, h } = box;
    const X = v => x + (v - xr[0]) / (xr[1] - xr[0]) * w;
    const Y = v => y + h - (v - yr[0]) / (yr[1] - yr[0]) * h;
    ctx.save();
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    const xs = K.niceStep(xr[1] - xr[0], 5), ys = K.niceStep(yr[1] - yr[0], 4);
    ctx.font = '11px ' + c.mono; ctx.fillStyle = c.muted;
    for (let v = Math.ceil(xr[0] / xs) * xs; v <= xr[1] + 1e-9; v += xs) {
      const px = X(v); ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(labels && labels.xfmt ? labels.xfmt(v) : +v.toPrecision(3), px, y + h + 14);
    }
    for (let v = Math.ceil(yr[0] / ys) * ys; v <= yr[1] + 1e-9; v += ys) {
      const py = Y(v); ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(labels && labels.yfmt ? labels.yfmt(v) : +v.toPrecision(3), x - 5, py + 4);
    }
    ctx.strokeStyle = c.line2; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
    if (yr[0] < 0 && yr[1] > 0) { ctx.strokeStyle = c.muted; ctx.beginPath(); ctx.moveTo(x, Y(0)); ctx.lineTo(x + w, Y(0)); ctx.stroke(); }
    if (labels) {
      ctx.fillStyle = c.ink2; ctx.font = '12px ' + c.font;
      if (labels.x) { ctx.textAlign = 'right'; ctx.fillText(labels.x, x + w, y + h + 28); }
      if (labels.y) { ctx.textAlign = 'left'; ctx.fillText(labels.y, x + 2, y - 6); }
    }
    ctx.restore();
    return { X, Y };
  };
  // wavelength (nm) -> css colour
  K.waveColor = function (nm, alpha) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm <= 780) { r = 1; }
    let f = 1;
    if (nm < 380 || nm > 780) f = 0;
    else if (nm < 420) f = 0.35 + 0.65 * (nm - 380) / 40;
    else if (nm > 700) f = 0.35 + 0.65 * (780 - nm) / 80;
    const cvt = x => Math.round(255 * Math.pow(x * f, 0.8));
    return 'rgba(' + cvt(r) + ',' + cvt(g) + ',' + cvt(b) + ',' + (alpha == null ? 1 : alpha) + ')';
  };
  K.band = function (nm) {
    if (nm < 10) return 'X-ray';
    if (nm < 380) return 'ultraviolet';
    if (nm <= 750) return 'visible';
    if (nm < 1e6) return 'infrared';
    return 'microwave/radio';
  };

  // Standard "mount" wrapper: builds panel, calls setup, wires theme + cleanup.
  K.mount = function (el, title, desc, setup) {
    const body = K.panel(el, title, desc);
    const cleanups = [];
    const ctx = {
      body,
      add: fn => cleanups.push(fn)
    };
    setup(ctx);
    return () => cleanups.forEach(f => { try { f(); } catch (e) { /* noop */ } });
  };
})();
