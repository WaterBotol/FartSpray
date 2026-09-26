/* Chemistry interactives: hero reaction box, galvanic cell builder, Maxwell–Boltzmann,
   equilibrium (N2O4/NO2) disturbances, NMR spectrum explorer. */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const f = (x, d) => (!isFinite(x) ? '–' : (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d));
  const box = (W, H, l, r, t, b) => ({ x: l, y: t, w: W - l - r, h: H - t - b });

  /* ------------------------------------------------------------------ hero: A + B → C */
  S.heroChem = function (el) {
    el.innerHTML = '';
    const cvs = K.canvas(el, 0.8, { maxH: 440, minH: 260, label: 'Particles A and B colliding; energetic collisions form product C. Tap to heat or cool.' });
    cvs.wrap.style.border = '0'; cvs.wrap.style.borderRadius = '0';
    const cap = document.createElement('div'); cap.className = 'cap'; el.appendChild(cap);
    let hot = false, P = [], made = 0;
    const R = 7, EA = 0.9;
    function reset() {
      P = []; made = 0;
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 0.8;
        P.push({ x: Math.random(), y: Math.random(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: i % 2 ? 'A' : 'B' });
      }
    }
    reset();
    const { ctx } = cvs;
    function step(dt) {
      const W = cvs.W, H = cvs.H, scale = hot ? 2.0 : 0.85;
      for (const p of P) {
        p.x += p.vx * dt * scale * 120 / W; p.y += p.vy * dt * scale * 120 / H;
        if (p.x < R / W) { p.x = R / W; p.vx = Math.abs(p.vx); } if (p.x > 1 - R / W) { p.x = 1 - R / W; p.vx = -Math.abs(p.vx); }
        if (p.y < R / H) { p.y = R / H; p.vy = Math.abs(p.vy); } if (p.y > 1 - R / H) { p.y = 1 - R / H; p.vy = -Math.abs(p.vy); }
      }
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j]; if (a.dead || b.dead) continue;
        const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H, d = Math.hypot(dx, dy);
        if (d < 2 * R && d > 0) {
          const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy) * scale;
          if (((a.t === 'A' && b.t === 'B') || (a.t === 'B' && b.t === 'A')) && rel > EA * 1.6) {
            a.t = 'C'; a.flash = 1; a.vx = (a.vx + b.vx) / 2; a.vy = (a.vy + b.vy) / 2; b.dead = true; made++;
          } else { const tx = a.vx; a.vx = b.vx; b.vx = tx; const ty = a.vy; a.vy = b.vy; b.vy = ty; const nx = dx / d, ny = dy / d, o = (2 * R - d) / 2; a.x += nx * o / W; a.y += ny * o / H; b.x -= nx * o / W; b.y -= ny * o / H; }
        }
      }
      P = P.filter(p => !p.dead);
      if (!P.some(p => p.t === 'A') || !P.some(p => p.t === 'B')) { if (!step.wait) step.wait = 2.5; step.wait -= dt; if (step.wait <= 0) { step.wait = 0; reset(); } }
    }
    function draw() {
      const W = cvs.W, H = cvs.H, c = K.col();
      ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      if (hot) { ctx.fillStyle = c.w; ctx.globalAlpha = 0.1; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      K.grid(ctx, W, H, 28, c);
      for (const p of P) {
        const col = p.t === 'A' ? c.n : p.t === 'B' ? c.w : c.acc, r = p.t === 'C' ? R * 1.35 : R;
        if (p.flash) { ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r + 10 * p.flash, 0, 7); ctx.fillStyle = c.warn; ctx.globalAlpha = 0.35 * p.flash; ctx.fill(); ctx.globalAlpha = 1; p.flash = Math.max(0, p.flash - 0.04); }
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r, 0, 7); ctx.fillStyle = col; ctx.fill();
      }
      cap.textContent = (hot ? 'Hot' : 'Cool') + ' · A + B → C · formed ' + made + ' · tap to ' + (hot ? 'cool' : 'heat');
    }
    cvs.draw = draw;
    cvs.cv.addEventListener('pointerdown', () => { hot = !hot; draw(); });
    let stop = null;
    if (K.reduced()) draw(); else stop = K.loop(dt => { step(dt); draw(); }, cvs.cv);
    const off = K.onTheme(draw);
    return () => { if (stop) stop(); off(); cvs.destroy(); };
  };

  /* ------------------------------------------------------------------ galvanic cell builder */
  const HC = [
    { id: 'cl', ox: [[1, 'Cl₂']], red: [[2, 'Cl⁻']], n: 2, E: 1.36, el: 'Pt', sol: 'Cl₂/Cl⁻' },
    { id: 'br', ox: [[1, 'Br₂']], red: [[2, 'Br⁻']], n: 2, E: 1.09, el: 'Pt', sol: 'Br₂/Br⁻' },
    { id: 'ag', ox: [[1, 'Ag⁺']], red: [[1, 'Ag']], n: 1, E: 0.80, el: 'Ag', sol: 'Ag⁺' },
    { id: 'fe3', ox: [[1, 'Fe³⁺']], red: [[1, 'Fe²⁺']], n: 1, E: 0.77, el: 'Pt', sol: 'Fe³⁺/Fe²⁺' },
    { id: 'i', ox: [[1, 'I₂']], red: [[2, 'I⁻']], n: 2, E: 0.54, el: 'Pt', sol: 'I₂/I⁻' },
    { id: 'cu', ox: [[1, 'Cu²⁺']], red: [[1, 'Cu']], n: 2, E: 0.34, el: 'Cu', sol: 'Cu²⁺' },
    { id: 'h', ox: [[2, 'H⁺']], red: [[1, 'H₂']], n: 2, E: 0.00, el: 'Pt', sol: 'H⁺/H₂' },
    { id: 'pb', ox: [[1, 'Pb²⁺']], red: [[1, 'Pb']], n: 2, E: -0.13, el: 'Pb', sol: 'Pb²⁺' },
    { id: 'ni', ox: [[1, 'Ni²⁺']], red: [[1, 'Ni']], n: 2, E: -0.25, el: 'Ni', sol: 'Ni²⁺' },
    { id: 'fe', ox: [[1, 'Fe²⁺']], red: [[1, 'Fe']], n: 2, E: -0.44, el: 'Fe', sol: 'Fe²⁺' },
    { id: 'zn', ox: [[1, 'Zn²⁺']], red: [[1, 'Zn']], n: 2, E: -0.76, el: 'Zn', sol: 'Zn²⁺' },
    { id: 'al', ox: [[1, 'Al³⁺']], red: [[1, 'Al']], n: 3, E: -1.66, el: 'Al', sol: 'Al³⁺' },
    { id: 'mg', ox: [[1, 'Mg²⁺']], red: [[1, 'Mg']], n: 2, E: -2.37, el: 'Mg', sol: 'Mg²⁺' }
  ];
  const side = (arr, k) => arr.map(([c, s]) => ((c * k) === 1 ? '' : (c * k)) + s).join(' + ');
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  function overall(cat, an) {
    const L = cat.n * an.n / gcd(cat.n, an.n), kc = L / cat.n, ka = L / an.n;
    const left = {}, right = {};
    cat.ox.forEach(([c, s]) => left[s] = (left[s] || 0) + c * kc);
    an.red.forEach(([c, s]) => left[s] = (left[s] || 0) + c * ka);
    cat.red.forEach(([c, s]) => right[s] = (right[s] || 0) + c * kc);
    an.ox.forEach(([c, s]) => right[s] = (right[s] || 0) + c * ka);
    for (const s of Object.keys(left)) if (right[s]) { const m = Math.min(left[s], right[s]); left[s] -= m; right[s] -= m; }
    const fmt = o => Object.entries(o).filter(([, v]) => v > 0).map(([s, v]) => (v === 1 ? '' : v) + s).join(' + ');
    return fmt(left) + ' → ' + fmt(right);
  }
  S.galvanic = function (el) {
    return K.mount(el, 'Galvanic cell builder', 'Choose two half-cells. The simulation works out which is the anode and cathode, the direction of electron and ion flow, the half-equations and the theoretical cell voltage under standard conditions.', ({ body, add }) => {
      const cv = K.canvas(body, 0.56, { maxH: 400, label: 'Diagram of a galvanic cell with electron flow' });
      const ctl = K.controls(body);
      const opts = HC.map(h => [h.id, side(h.ox, 1) + ' / ' + side(h.red, 1) + '  (' + (h.E >= 0 ? '+' : '') + h.E.toFixed(2) + ' V)']);
      const Lh = K.select(ctl, { label: 'Left half-cell', value: 'zn', options: opts, onChange: upd });
      const Rh = K.select(ctl, { label: 'Right half-cell', value: 'cu', options: opts, onChange: upd });
      const ro = K.readout(body, [['E', 'E°cell (standard, theoretical)'], ['an', 'Anode (−): oxidation'], ['ca', 'Cathode (+): reduction'], ['ov', 'Overall equation']]);
      let st = null, t0 = 0;
      function upd() {
        const a = HC.find(h => h.id === Lh.get()), b = HC.find(h => h.id === Rh.get());
        if (a.id === b.id) { st = { same: true, a, b }; ro.set('E', '0.00 V: identical half-cells'); ro.set('an', '–'); ro.set('ca', '–'); ro.set('ov', 'no net reaction'); draw(); return; }
        const cat = a.E > b.E ? a : b, an = cat === a ? b : a;
        st = { a, b, cat, an, leftIsCat: cat === a };
        ro.set('E', f(cat.E - an.E) + ' V', 'good');
        ro.set('an', side(an.red, 1) + ' → ' + side(an.ox, 1) + ' + ' + (an.n === 1 ? '' : an.n) + 'e⁻  (' + an.el + (an.el === 'Pt' ? ', inert' : '') + ' electrode)');
        ro.set('ca', side(cat.ox, 1) + ' + ' + (cat.n === 1 ? '' : cat.n) + 'e⁻ → ' + side(cat.red, 1) + '  (' + cat.el + (cat.el === 'Pt' ? ', inert' : '') + ' electrode)');
        ro.set('ov', overall(cat, an));
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const bw = W * 0.26, bh = H * 0.38, by = H * 0.42, lx = W * 0.12, rx = W - W * 0.12 - bw;
        const beaker = (x, hc, isCat) => {
          ctx.fillStyle = c.accSoft; ctx.fillRect(x, by + bh * 0.25, bw, bh * 0.75);
          ctx.strokeStyle = c.line2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.lineTo(x + bw, by + bh); ctx.lineTo(x + bw, by); ctx.stroke();
          const ex = x + bw * 0.5 - 9;
          ctx.fillStyle = hc.el === 'Pt' ? c.muted : c.ink2; ctx.fillRect(ex, by - bh * 0.35, 18, bh * 0.95);
          K.text(ctx, hc.el, ex + 9, by + bh * 0.62, { align: 'center', color: c.surface, bold: true, size: 12, c });
          K.text(ctx, hc.sol + '(aq)', x + bw / 2, by + bh + 18, { align: 'center', size: 12, c });
          if (!st.same) {
            K.text(ctx, isCat ? 'CATHODE (+)' : 'ANODE (−)', x + bw / 2, by + bh + 36, { align: 'center', bold: true, size: 12, color: isCat ? c.good : c.bad, c });
            K.text(ctx, isCat ? 'reduction' : 'oxidation', x + bw / 2, by + bh + 52, { align: 'center', size: 11.5, color: c.muted, c });
          }
          return ex + 9;
        };
        const lL = beaker(lx, st.a, !st.same && st.leftIsCat), rL = beaker(rx, st.b, !st.same && !st.leftIsCat);
        // wire + voltmeter
        const wy = H * 0.12;
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lL, by - bh * 0.35); ctx.lineTo(lL, wy); ctx.lineTo(rL, wy); ctx.lineTo(rL, by - bh * 0.35); ctx.stroke();
        ctx.beginPath(); ctx.arc(W / 2, wy, 26, 0, 7); ctx.fillStyle = c.surface; ctx.fill(); ctx.stroke();
        K.text(ctx, st.same ? '0.00 V' : f(st.cat.E - st.an.E) + ' V', W / 2, wy + 4.5, { align: 'center', bold: true, size: 11, mono: true, c });
        // salt bridge
        const sy = by + bh * 0.1;
        ctx.strokeStyle = c.w; ctx.lineWidth = 10; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(lx + bw * 0.8, by + bh * 0.55); ctx.lineTo(lx + bw * 0.8, sy - 18); ctx.lineTo(rx + bw * 0.2, sy - 18); ctx.lineTo(rx + bw * 0.2, by + bh * 0.55); ctx.stroke(); ctx.globalAlpha = 1;
        K.text(ctx, 'salt bridge (KNO₃)', W / 2, sy - 28, { align: 'center', size: 11.5, color: c.muted, c });
        if (!st.same) {
          const dir = st.leftIsCat ? -1 : 1; // electrons from anode to cathode
          const x1 = W / 2 - 70, x2 = W / 2 + 70;
          K.arrow(ctx, dir > 0 ? x1 - 40 : x2 + 40, wy - 16, dir > 0 ? x1 + 10 : x2 - 10, wy - 16, c.n, 2);
          K.text(ctx, 'e⁻ flow', dir > 0 ? x1 - 40 : x2 + 40, wy - 24, { align: dir > 0 ? 'left' : 'right', size: 12, color: c.n, bold: true, c });
          // moving electrons
          const tt = (performance.now() / 1000) % 1;
          ctx.fillStyle = c.n;
          for (let k = 0; k < 6; k++) {
            const u = (k / 6 + tt) % 1, x = dir > 0 ? lL + (rL - lL) * u : rL - (rL - lL) * u;
            if (Math.abs(x - W / 2) > 30) { ctx.beginPath(); ctx.arc(x, wy, 3.2, 0, 7); ctx.fill(); }
          }
          // ion flow in bridge
          const anX = st.leftIsCat ? rx + bw * 0.2 : lx + bw * 0.8, caX = st.leftIsCat ? lx + bw * 0.8 : rx + bw * 0.2;
          K.text(ctx, 'NO₃⁻ → anode', anX + (st.leftIsCat ? -8 : 8), sy + 10, { align: st.leftIsCat ? 'right' : 'left', size: 11, color: c.bad, c });
          K.text(ctx, 'K⁺ → cathode', caX + (st.leftIsCat ? 8 : -8), sy + 10, { align: st.leftIsCat ? 'left' : 'right', size: 11, color: c.good, c });
        }
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      if (!K.reduced()) add(K.loop(() => { if (st && !st.same) draw(); }, cv.cv));
      upd();
    });
  };

  /* ------------------------------------------------------------------ Maxwell–Boltzmann */
  function erfc(x) { // Numerical Recipes erfc approximation
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const fracAbove = x => erfc(Math.sqrt(x)) + 2 * Math.sqrt(x / Math.PI) * Math.exp(-x); // 3D kinetic energy distribution
  S.maxwell = function (el) {
    return K.mount(el, 'Maxwell–Boltzmann distribution', 'Compare the distribution of particle energies at 300 K (dashed) with a temperature you choose. The shaded area is the fraction of particles with at least the activation energy. Turn on the catalyst to lower Eₐ.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Maxwell–Boltzmann energy distribution curves' });
      const ctl = K.controls(body);
      const T = K.slider(ctl, { label: 'Temperature', min: 200, max: 900, step: 10, value: 400, fmt: v => v + ' K', onInput: upd });
      const Ea = K.slider(ctl, { label: 'Activation energy (relative units)', min: 3, max: 12, step: 0.1, value: 7, fmt: v => v.toFixed(1), onInput: upd });
      const Cat = K.check(ctl, { label: 'Add a catalyst (Eₐ lowered by 40%)', value: false, onChange: upd });
      const ro = K.readout(body, [['fr', 'Fraction with E ≥ Eₐ'], ['ref', 'Same fraction at 300 K'], ['x', 'Rate factor vs 300 K (≈)'], ['real', 'Real reaction, Eₐ = 50 kJ mol⁻¹: 300 K → T']]);
      let st = null;
      function upd() {
        const t = T.get(), ea = Ea.get() * (Cat.get() ? 0.6 : 1), kT = t / 300, kT0 = 1;
        const fr = fracAbove(ea / kT), f0 = fracAbove(Ea.get() / kT0);
        st = { t, ea, kT };
        ro.set('fr', (fr * 100).toPrecision(3) + ' %');
        ro.set('ref', (f0 * 100).toPrecision(3) + ' % (no catalyst)');
        ro.set('x', '× ' + (fr / f0).toPrecision(3), fr > f0 ? 'good' : '');
        const x1 = 50000 / (8.314 * 300), x2 = 50000 / (8.314 * t);
        ro.set('real', '× ' + K.sig(fracAbove(x2) / fracAbove(x1), 3) + (t === 310 ? ' (≈ doubling for +10 K)' : ''));
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const b = box(W, H, 20, 14, 18, 30);
        const xr = [0, 14], pdf = (E, kT) => 2 * Math.sqrt(E / Math.PI) * Math.pow(kT, -1.5) * Math.exp(-E / kT);
        const ymax = pdf(0.5, 1) * 1.25;
        const M = K.axes(ctx, b, xr, [0, ymax], c, { x: 'kinetic energy', y: 'fraction of particles', yfmt: () => '' });
        const X = M.X, Y = M.Y;
        // shade
        ctx.beginPath(); ctx.moveTo(X(st.ea), Y(0));
        for (let E = st.ea; E <= xr[1]; E += 0.05) ctx.lineTo(X(E), Y(pdf(E, st.kT)));
        ctx.lineTo(X(xr[1]), Y(0)); ctx.closePath(); ctx.fillStyle = c.acc; ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1;
        const line = (kT, col, dash, w) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let E = 0; E <= xr[1]; E += 0.04) { const y = pdf(E, kT); E ? ctx.lineTo(X(E), Y(y)) : ctx.moveTo(X(E), Y(y)); } ctx.stroke(); ctx.restore(); };
        line(1, c.muted, [6, 5], 1.8);
        line(st.kT, c.acc, null, 2.6);
        ctx.strokeStyle = c.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(st.ea), b.y); ctx.lineTo(X(st.ea), b.y + b.h); ctx.stroke();
        K.text(ctx, 'Eₐ' + (Cat.get() ? ' (catalysed)' : ''), X(st.ea) + 5, b.y + 14, { color: c.bad, bold: true, size: 12, c });
        K.text(ctx, '300 K', X(1.2), Y(pdf(1.2, 1)) - 8, { color: c.muted, size: 12, c });
        K.text(ctx, st.t + ' K', X(st.kT * 1.8) + 6, Y(pdf(st.kT * 1.8, st.kT)) - 6, { color: c.acc, bold: true, size: 12, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ equilibrium: N2O4 ⇌ 2NO2 */
  S.equilibrium = function (el) {
    return K.mount(el, 'Disturb an equilibrium: N₂O₄(g) ⇌ 2NO₂(g), ΔH = +57 kJ mol⁻¹', 'Press a button to disturb the system, then watch the concentration–time graph as it re-establishes equilibrium. The box shows the brown colour of NO₂.', ({ body, add }) => {
      const cv = K.canvas(body, 0.52, { maxH: 380, label: 'Concentration–time graph for N2O4 and NO2' });
      const ro = K.readout(body, [['a', '[N₂O₄]'], ['b', '[NO₂]'], ['q', 'Q = [NO₂]²/[N₂O₄]'], ['k', 'K at this temperature'], ['s', 'What is happening']]);
      let A = 1.0, B = 0.6, T = 298, cat = 1, t = 0, hist = [], note = 'at equilibrium';
      const K0 = 0.36, dH = 57000;
      const Keq = () => K0 * Math.exp(-dH / 8.314 * (1 / T - 1 / 298));
      const mark = [];
      const act = (label, fn) => ({ label, onClick: () => { fn(); mark.push({ t, label }); } });
      K.buttons(body, [
        act('Add NO₂', () => { B += 0.4; }), act('Add N₂O₄', () => { A += 0.5; }), act('Remove some NO₂', () => { B *= 0.5; }),
        act('Halve volume', () => { A *= 2; B *= 2; }), act('Double volume', () => { A /= 2; B /= 2; }),
        act('Heat (+20 K)', () => { T = Math.min(378, T + 20); }), act('Cool (−20 K)', () => { T = Math.max(238, T - 20); }),
        act('Add catalyst', () => { cat = 4; })
      ]);
      K.buttons(body, [{ label: 'Reset', onClick: () => { A = 1.0; B = 0.6; T = 298; cat = 1; t = 0; hist = []; mark.length = 0; } }]);
      function step(dt) {
        const Kc = Keq(), s = 0.22 * cat * Math.exp(-2500 * (1 / T - 1 / 298)), n = 10;
        for (let i = 0; i < n; i++) {
          const h = dt / n, r = s * (Kc * A - B * B);
          A = Math.max(1e-6, A - r * h); B = Math.max(1e-6, B + 2 * r * h);
        }
        t += dt;
        hist.push([t, A, B]);
        while (hist.length && hist[0][0] < t - 24) hist.shift();
        while (mark.length && mark[0].t < t - 24) mark.shift();
        const Q = B * B / A, Kc2 = Keq();
        note = Math.abs(Q - Kc2) / Kc2 < 0.02 ? 'at equilibrium (Q = K)' : Q < Kc2 ? 'Q < K: net forward reaction (more NO₂)' : 'Q > K: net reverse reaction (more N₂O₄)';
      }
      function report() {
        ro.set('a', f(A, 3) + ' M'); ro.set('b', f(B, 3) + ' M'); ro.set('q', f(B * B / A, 3) + ' M'); ro.set('k', f(Keq(), 3) + ' M  (T = ' + T + ' K)');
        ro.set('s', note, note.startsWith('at') ? 'good' : '');
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const b = box(W, H, 44, 100, 16, 28);
        const ymax = Math.max(1.5, ...hist.map(h => Math.max(h[1], h[2]))) * 1.1;
        const t1 = Math.max(24, t), t0 = t1 - 24;
        const M = K.axes(ctx, b, [t0, t1], [0, ymax], c, { x: 'time', y: 'concentration (M)', xfmt: () => '' });
        ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
        mark.forEach((m, k) => { ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(M.X(m.t), b.y); ctx.lineTo(M.X(m.t), b.y + b.h); ctx.stroke(); ctx.setLineDash([]); K.text(ctx, m.label, M.X(m.t) + 3, b.y + 12 + (k % 3) * 13, { size: 10.5, color: c.muted, c }); });
        [[1, c.acc, 'N₂O₄'], [2, c.w, 'NO₂']].forEach(([i, col]) => { ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); hist.forEach((h, j) => j ? ctx.lineTo(M.X(h[0]), M.Y(h[i])) : ctx.moveTo(M.X(h[0]), M.Y(h[i]))); ctx.stroke(); });
        ctx.restore();
        if (hist.length) { const l = hist[hist.length - 1]; K.text(ctx, '[N₂O₄]', b.x + b.w + 6, M.Y(l[1]) + 4, { color: c.acc, bold: true, size: 12, c }); K.text(ctx, '[NO₂]', b.x + b.w + 6, M.Y(l[2]) + 4, { color: c.w, bold: true, size: 12, c }); }
        // colour box
        const bx = W - 82, by = b.y + b.h - 64;
        ctx.fillStyle = 'rgba(150, 70, 20,' + K.clamp(B / 2.2, 0.03, 0.95) + ')'; ctx.fillRect(bx, by, 60, 50);
        ctx.strokeStyle = c.line2; ctx.strokeRect(bx, by, 60, 50);
        K.text(ctx, 'colour', bx + 30, by + 64, { align: 'center', size: 11, color: c.muted, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      for (let i = 0; i < 40; i++) step(0.05);
      report(); draw();
      if (K.reduced()) add(K.loop(dt => { step(dt); report(); draw(); }, cv.cv));
      else add(K.loop(dt => { step(dt); report(); draw(); }, cv.cv));
    });
  };

  /* ------------------------------------------------------------------ NMR explorer */
  const MOL = {
    ethanol: { name: 'ethanol, CH₃CH₂OH', H: [[1.2, 3, 2, 'CH₃'], [3.7, 2, 3, 'CH₂'], [2.6, 1, 0, 'OH']], C: [58, 18] },
    etac: { name: 'ethyl ethanoate, CH₃COOCH₂CH₃', H: [[2.0, 3, 0, 'CH₃CO'], [4.1, 2, 3, 'OCH₂'], [1.3, 3, 2, 'CH₃']], C: [171, 60, 21, 14] },
    mepr: { name: 'methyl propanoate, CH₃CH₂COOCH₃', H: [[3.7, 3, 0, 'OCH₃'], [2.3, 2, 3, 'CH₂'], [1.1, 3, 2, 'CH₃']], C: [175, 51, 27, 9] },
    butanone: { name: 'butanone, CH₃COCH₂CH₃', H: [[2.1, 3, 0, 'CH₃CO'], [2.4, 2, 3, 'CH₂'], [1.1, 3, 2, 'CH₃']], C: [209, 37, 29, 8] },
    cp2: { name: '2-chloropropane, CH₃CHClCH₃', H: [[1.5, 6, 1, '2 × CH₃'], [4.1, 1, 6, 'CHCl']], C: [54, 27] },
    cp1: { name: '1-chloropropane, CH₃CH₂CH₂Cl', H: [[3.5, 2, 2, 'CH₂Cl'], [1.8, 2, 5, 'CH₂'], [1.0, 3, 2, 'CH₃']], C: [47, 26, 11] },
    pracid: { name: 'propanoic acid, CH₃CH₂COOH', H: [[11.7, 1, 0, 'COOH'], [2.4, 2, 3, 'CH₂'], [1.2, 3, 2, 'CH₃']], C: [181, 28, 9] },
    ipa: { name: 'propan-2-ol, (CH₃)₂CHOH', H: [[1.2, 6, 1, '2 × CH₃'], [4.0, 1, 6, 'CH'], [2.2, 1, 0, 'OH']], C: [64, 25] },
    acetone: { name: 'propanone, CH₃COCH₃', H: [[2.1, 6, 0, '2 × CH₃']], C: [206, 31] },
    propanal: { name: 'propanal, CH₃CH₂CHO', H: [[9.8, 1, 2, 'CHO'], [2.5, 2, 4, 'CH₂'], [1.1, 3, 2, 'CH₃']], C: [203, 37, 6] }
  };
  const NAMES = ['singlet', 'doublet', 'triplet', 'quartet', 'quintet', 'sextet', 'septet'];
  const pascal = n => { let r = [1]; for (let i = 0; i < n; i++) { const s = [1]; for (let j = 1; j < r.length; j++) s.push(r[j - 1] + r[j]); s.push(1); r = s; } return r; };
  S.nmr = function (el) {
    return K.mount(el, 'NMR spectrum explorer', 'Pick a molecule to see its predicted high-resolution ¹H NMR spectrum (shift, splitting and integration) and ¹³C peaks, or switch to the splitting explorer to see the n + 1 rule.', ({ body, add }) => {
      const cv = K.canvas(body, 0.48, { maxH: 360, label: 'Predicted NMR spectrum' });
      const ctl = K.controls(body);
      const Mode = K.select(ctl, { label: 'Mode', value: 'mol', options: [['mol', '¹H spectrum of a molecule'], ['c13', '¹³C spectrum of a molecule'], ['split', 'Splitting explorer (n + 1 rule)']], onChange: upd });
      const Mol = K.select(ctl, { label: 'Molecule', value: 'ethanol', options: Object.entries(MOL).map(([k, v]) => [k, v.name]), onChange: upd });
      const Nn = K.slider(ctl, { label: 'Neighbouring H (n)', min: 0, max: 6, step: 1, value: 2, onInput: upd });
      const ro = K.readout(body, [['env', 'Environments'], ['sig', 'Signals (δ, integration, splitting)']]);
      function upd() {
        const m = MOL[Mol.get()], mode = Mode.get();
        Mol.el.style.display = mode === 'split' ? 'none' : ''; Nn.el.style.display = mode === 'split' ? '' : 'none';
        if (mode === 'split') { const n = Nn.get(); ro.set('env', n + ' neighbouring H → ' + (n + 1) + ' peaks'); ro.set('sig', NAMES[n] + ': intensities ' + pascal(n).join(' : ')); }
        else if (mode === 'c13') { ro.set('env', m.C.length + ' carbon environments'); ro.set('sig', m.C.map(d => d + ' ppm').join(', ')); }
        else { ro.set('env', m.H.length + ' hydrogen environments (ratio ' + m.H.map(h => h[1]).join(' : ') + ')'); ro.set('sig', m.H.map(h => h[0].toFixed(1) + ' ' + h[3] + ' ' + h[1] + 'H ' + NAMES[h[2]]).join('; ')); }
        draw();
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const mode = Mode.get(), m = MOL[Mol.get()];
        const b = box(W, H, 20, 20, 30, 34);
        if (mode === 'split') {
          const n = Nn.get(), p = pascal(n), mx = Math.max(...p), gap = Math.min(40, b.w / (n + 3));
          const cx = b.x + b.w / 2, base = b.y + b.h;
          ctx.strokeStyle = c.line2; ctx.beginPath(); ctx.moveTo(b.x, base); ctx.lineTo(b.x + b.w, base); ctx.stroke();
          p.forEach((v, i) => { const x = cx + (i - n / 2) * gap, h = (b.h - 30) * v / mx; ctx.strokeStyle = c.acc; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - h); ctx.stroke(); K.text(ctx, String(v), x, base - h - 6, { align: 'center', size: 12, mono: true, c }); });
          K.text(ctx, NAMES[n] + ' (' + (n + 1) + ' peaks)', cx, b.y + 4, { align: 'center', bold: true, size: 13, c });
          return;
        }
        const c13 = mode === 'c13', xmax = c13 ? 220 : 12;
        const X = d => b.x + (1 - d / xmax) * b.w, base = b.y + b.h;
        ctx.strokeStyle = c.line2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x, base); ctx.lineTo(b.x + b.w, base); ctx.stroke();
        ctx.fillStyle = c.muted; ctx.font = '11px ' + c.mono; ctx.textAlign = 'center';
        for (let d = 0; d <= xmax; d += c13 ? 20 : 1) { ctx.fillText(String(d), X(d), base + 14); ctx.beginPath(); ctx.moveTo(X(d), base); ctx.lineTo(X(d), base + 3); ctx.stroke(); }
        K.text(ctx, 'δ (ppm)', b.x + b.w, base + 28, { align: 'right', size: 12, color: c.ink2, c });
        // TMS
        ctx.strokeStyle = c.muted; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), base); ctx.lineTo(X(0), base - b.h * 0.35); ctx.stroke();
        K.text(ctx, 'TMS', X(0) - 4, base - b.h * 0.35 - 6, { align: 'right', size: 11, color: c.muted, c });
        if (c13) {
          m.C.forEach(d => { ctx.strokeStyle = c.acc; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(d), base); ctx.lineTo(X(d), base - b.h * 0.8); ctx.stroke(); K.text(ctx, String(d), X(d), base - b.h * 0.8 - 6, { align: 'center', size: 11.5, mono: true, c }); });
          return;
        }
        const maxI = Math.max(...m.H.map(h => h[1]));
        const SHORT = ['s', 'd', 't', 'q', 'quint', 'sext', 'sept'];
        [...m.H].sort((u, v) => u[0] - v[0]).forEach(([d, I, n], k) => {
          const p = pascal(n), pm = Math.max(...p), sp = 0.07;
          p.forEach((v, i) => { const x = X(d + (i - n / 2) * sp), hgt = (b.h - 40) * (I / maxI) * (v / pm); ctx.strokeStyle = c.acc; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - hgt); ctx.stroke(); });
          K.text(ctx, d.toFixed(1) + ': ' + I + 'H ' + SHORT[n], X(d), b.y - 10 + (k % 2) * 15, { align: 'center', size: 11.5, bold: true, c });
        });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };
})();
