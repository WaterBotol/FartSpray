/* Unit 3 AoS 2 simulations: orbits, DC motor, charged particle in a magnetic field */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const G = 6.67e-11;
  const f2 = (x, d) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d);
  function fmtTime(s) {
    if (s < 120) return f2(s, 1) + ' s';
    if (s < 7200) return f2(s / 60, 1) + ' min';
    if (s < 3 * 86400) return f2(s / 3600, 2) + ' h';
    if (s < 3 * 365.25 * 86400) return f2(s / 86400, 2) + ' days';
    return f2(s / (365.25 * 86400), 2) + ' years';
  }
  function fmtDist(m) {
    if (m < 1e6) return f2(m / 1000, 0) + ' km';
    return K.sig(m, 3) + ' m';
  }

  /* ------------------------------------------------------------------ orbits */
  S.orbit = function (el) {
    return K.mount(el, 'Orbit calculator', 'Pick a central body and drag the orbital radius. Speed and period come from GMm/r² = mv²/r = 4π²mr/T². (Animation speed is not to scale, but higher orbits are drawn slower.)', ({ body, add }) => {
      const bodies = {
        earth: { name: 'Earth', M: 5.98e24, R: 6.37e6 },
        moon: { name: 'Moon', M: 7.35e22, R: 1.74e6 },
        mars: { name: 'Mars', M: 6.42e23, R: 3.39e6 },
        jupiter: { name: 'Jupiter', M: 1.90e27, R: 6.99e7 },
        sun: { name: 'Sun', M: 1.99e30, R: 6.96e8 }
      };
      const cv = K.canvas(body, 0.55, { maxH: 400, label: 'Satellite orbiting a planet' });
      const ctl = K.controls(body);
      const B = K.select(ctl, { label: 'Central body', value: 'earth', options: Object.entries(bodies).map(([k, b]) => [k, b.name]), onChange: upd });
      const Rr = K.slider(ctl, { label: 'Orbital radius (× body radius)', min: Math.log10(1.02), max: Math.log10(100), step: 0.001, value: 1.063, toVal: x => Math.pow(10, x), fromVal: v => Math.log10(v), fmt: v => v.toFixed(v < 10 ? 3 : 1) + ' R', onInput: upd });
      const pre = K.buttons(ctl, [
        { label: 'ISS (400 km)', onClick: () => setAlt(4.0e5) },
        { label: 'GPS (20 200 km)', onClick: () => setAlt(2.02e7) },
        { label: 'Geostationary', onClick: () => { const T = 86400; setR(Math.cbrt(G * bodies.earth.M * T * T / (4 * Math.PI * Math.PI))); } },
        { label: 'The Moon', onClick: () => setR(3.84e8) }
      ]);
      const ro = K.readout(body, [['r', 'Orbital radius'], ['alt', 'Altitude'], ['v', 'Orbital speed'], ['T', 'Period'], ['g', 'g at orbit (= centripetal accel.)']]);
      let P = null, ang = 0;
      function setR(r) { B.set('earth'); Rr.set(r / bodies.earth.R); upd(); }
      function setAlt(a) { setR(bodies.earth.R + a); }
      function upd() {
        const b = bodies[B.get()];
        pre.hidden = B.get() !== 'earth';
        const r = Rr.get() * b.R;
        const v = Math.sqrt(G * b.M / r), T = 2 * Math.PI * r / v, gg = G * b.M / (r * r);
        P = { b, r, v, T, gg, k: Rr.get() };
        ro.set('r', K.sig(r, 3) + ' m');
        ro.set('alt', fmtDist(r - b.R));
        ro.set('v', K.sig(v / 1000, 3) + ' km s⁻¹');
        ro.set('T', fmtTime(T), Math.abs(T - 86400) < 900 && B.get() === 'earth' ? 'good' : '');
        ro.set('g', K.sig(gg, 3) + ' m s⁻²');
        draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const cx = W * 0.5, cy = H * 0.5, orb = Math.min(W, H) * 0.42;
        const pr = Math.max(5, orb / P.k);
        ctx.strokeStyle = c.line2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(cx, cy, orb, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        const grd = ctx.createRadialGradient(cx - pr * 0.3, cy - pr * 0.3, pr * 0.1, cx, cy, pr);
        const col = { earth: c.n, moon: c.muted, mars: c.w, jupiter: c.f, sun: c.warn }[B.get()];
        grd.addColorStop(0, col); grd.addColorStop(1, c.ink2);
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.fill();
        K.text(ctx, P.b.name, cx, cy + pr + 16, { align: 'center', size: 12, bold: true, c });
        const sx = cx + orb * Math.cos(ang), sy = cy - orb * Math.sin(ang);
        K.arrow(ctx, sx, sy, sx - Math.sin(ang) * 46, sy - Math.cos(ang) * 46, c.v, 2.2);
        K.arrow(ctx, sx, sy, sx + (cx - sx) * 0.22, sy + (cy - sy) * 0.22, c.net, 2.2);
        ctx.fillStyle = c.acc; ctx.fillRect(sx - 5, sy - 5, 10, 10);
        K.text(ctx, 'v', sx - Math.sin(ang) * 46 + 6, sy - Math.cos(ang) * 46, { color: c.v, bold: true, c });
        K.text(ctx, 'F (gravity)', sx + (cx - sx) * 0.22 + 6, sy + (cy - sy) * 0.22 + 12, { color: c.net, bold: true, size: 11.5, c });
        K.text(ctx, 'r = ' + P.k.toFixed(2) + ' R', 12, 20, { mono: true, size: 12, color: c.muted, c });
      }
      add(K.loop(dt => { if (!P) return; const Td = 2.5 * Math.pow(P.k / 1.06, 0.55); ang += dt * 2 * Math.PI / Td; draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ DC motor */
  S.motor = function (el) {
    return K.mount(el, 'DC motor: commutator vs slip rings', 'End view of a coil between magnet poles. Watch the torque graph: with the split-ring commutator the torque never reverses. Switch to slip rings and the coil just rocks and stops.', ({ body, add }) => {
      const cv = K.canvas(body, 0.55, { maxH: 400, label: 'Rotating motor coil with torque graph' });
      const ctl = K.controls(body);
      const I = K.slider(ctl, { label: 'Current', min: -5, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' A', onInput: upd });
      const Bf = K.slider(ctl, { label: 'Magnetic field', min: 0.05, max: 1, step: 0.01, value: 0.3, fmt: v => v.toFixed(2) + ' T', onInput: upd });
      const N = K.slider(ctl, { label: 'Turns on coil', min: 1, max: 200, step: 1, value: 50, fmt: v => v + ' turns', onInput: upd });
      const C = K.check(ctl, { label: 'Split-ring commutator (off = slip rings)', value: true, onChange: upd });
      K.buttons(ctl, [{ label: 'Give it a spin', onClick: () => { w += 6 * Math.sign(I.get() || 1); } }, { label: 'Stop & reset', onClick: () => { w = 0; phi = Math.PI / 6; trace.length = 0; } }]);
      const ro = K.readout(body, [['F', 'Force on each side (nIlB)'], ['tmax', 'Max torque (plane ∥ B)'], ['tnow', 'Torque now'], ['rpm', 'Rotation rate']]);
      const l = 0.05, wd = 0.05;
      let phi = Math.PI / 6, w = 0, tNow = 0, P = null;
      const trace = [];
      function upd() {
        const F = N.get() * Math.abs(I.get()) * l * Bf.get();
        P = { F, tmax: F * wd };
        ro.set('F', K.sig(F, 3) + ' N');
        ro.set('tmax', K.sig(P.tmax, 3) + ' N m');
      }
      function currentSign() {
        const s0 = Math.sign(I.get());
        if (!C.get()) return s0;
        return s0 * (Math.cos(phi) >= 0 ? 1 : -1);
      }
      function step(dt) {
        const n = 10, d = dt / n;
        for (let i = 0; i < n; i++) {
          const s = currentSign();
          tNow = P.F * wd * s * Math.cos(phi); // counterclockwise positive
          const alpha = 240 * tNow - 1.1 * w;
          w += alpha * d; phi += w * d;
        }
        trace.push(tNow); if (trace.length > 240) trace.shift();
        ro.set('tnow', K.sig(tNow, 2) + ' N m');
        ro.set('rpm', Math.round(Math.abs(w) / (2 * Math.PI) * 60) + ' rpm');
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const sceneH = H * 0.62, cx = W * 0.5, cy = sceneH * 0.52, rho = Math.min(W * 0.18, sceneH * 0.36);
        const pw = Math.max(24, W * 0.06);
        ctx.fillStyle = c.w; ctx.fillRect(cx - rho - 60 - pw, cy - rho - 10, pw, rho * 2 + 20);
        ctx.fillStyle = c.n; ctx.fillRect(cx + rho + 60, cy - rho - 10, pw, rho * 2 + 20);
        K.text(ctx, 'N', cx - rho - 60 - pw / 2, cy + 5, { align: 'center', color: '#fff', bold: true, size: 15, c });
        K.text(ctx, 'S', cx + rho + 60 + pw / 2, cy + 5, { align: 'center', color: '#fff', bold: true, size: 15, c });
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx - rho - 58, cy + k * rho * 0.45); ctx.lineTo(cx + rho + 58, cy + k * rho * 0.45); ctx.stroke(); }
        K.text(ctx, 'B →', cx - rho - 52, cy - rho - 16, { color: c.muted, size: 11.5, c });
        const ax = cx + rho * Math.cos(phi), ay = cy - rho * Math.sin(phi);
        const bx = cx - rho * Math.cos(phi), by = cy + rho * Math.sin(phi);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.fillStyle = c.muted; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
        const s = currentSign();
        const drawSide = (x, y, out) => {
          ctx.fillStyle = c.surface; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.stroke();
          if (s === 0) return;
          if (out) { ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
        };
        drawSide(ax, ay, s > 0); drawSide(bx, by, s < 0);
        if (s !== 0) {
          const L = 22 + 60 * Math.min(1, P.F / 2);
          K.arrow(ctx, ax, ay - 12 * s, ax, ay - (12 + L) * s, c.net, 2.4);
          K.arrow(ctx, bx, by + 12 * s, bx, by + (12 + L) * s, c.net, 2.4);
        }
        // torque graph
        const gy = sceneH + 8, gh = H - gy - 14, gx = 50, gw = W - 64;
        ctx.strokeStyle = c.line2; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
        ctx.strokeStyle = c.muted; ctx.beginPath(); ctx.moveTo(gx, gy + gh / 2); ctx.lineTo(gx + gw, gy + gh / 2); ctx.stroke();
        const tm = Math.max(P.tmax, 1e-6);
        ctx.strokeStyle = c.v; ctx.lineWidth = 2; ctx.beginPath();
        trace.forEach((tq, i) => { const x = gx + gw * i / 240, y = gy + gh / 2 - (tq / tm) * (gh / 2 - 4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        K.text(ctx, 'torque', gx - 6, gy + 12, { align: 'right', size: 11, color: c.muted, c });
        K.text(ctx, '0', gx - 6, gy + gh / 2 + 4, { align: 'right', size: 11, mono: true, color: c.muted, c });
        K.text(ctx, C.get() ? 'commutator: torque stays one sign' : 'slip rings: torque reverses every half turn', gx + gw - 4, gy + 14, { align: 'right', size: 11.5, color: c.ink2, c });
      }
      add(K.loop(dt => { if (!P) return; step(dt); draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ charged particle in B */
  S.bfield = function (el) {
    return K.mount(el, 'Charged particle in a magnetic field', 'A particle enters a uniform field at right angles. The magnetic force is always towards the centre of the circle, so speed never changes. Try an electron and a proton at the same speed.', ({ body, add }) => {
      const parts = {
        electron: { name: 'electron', m: 9.1e-31, q: -1.6e-19 },
        positron: { name: 'positron', m: 9.1e-31, q: 1.6e-19 },
        proton: { name: 'proton', m: 1.67e-27, q: 1.6e-19 },
        alpha: { name: 'alpha particle', m: 6.64e-27, q: 3.2e-19 }
      };
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Circular path of a charged particle in a magnetic field' });
      const ctl = K.controls(body);
      const Pt = K.select(ctl, { label: 'Particle', value: 'electron', options: Object.entries(parts).map(([k, p]) => [k, p.name[0].toUpperCase() + p.name.slice(1)]), onChange: upd });
      const V = K.slider(ctl, { label: 'Speed', min: 5, max: 7.3, step: 0.01, value: 7, toVal: x => Math.pow(10, x), fromVal: v => Math.log10(v), fmt: v => K.sig(v, 2) + ' m s⁻¹', onInput: upd });
      const Bm = K.slider(ctl, { label: 'Field strength', min: 0.5, max: 100, step: 0.5, value: 5, fmt: v => v.toFixed(1) + ' mT', onInput: upd });
      const D = K.select(ctl, { label: 'Field direction', value: 'in', options: [['in', 'Into the page (×)'], ['out', 'Out of the page (•)']], onChange: upd });
      const ro = K.readout(body, [['F', 'Magnetic force qvB'], ['r', 'Radius mv/(qB)'], ['T', 'Period 2πm/(qB)'], ['E', 'Kinetic energy'], ['dir', 'Initial force direction']]);
      let P = null, th = 0;
      function upd() {
        const p = parts[Pt.get()], v = V.get(), B = Bm.get() / 1000;
        const q = Math.abs(p.q), r = p.m * v / (q * B), F = q * v * B, T = 2 * Math.PI * p.m / (q * B), Ek = 0.5 * p.m * v * v;
        // force direction: v = +x, B into page (−z): v×B = +y (up) for +q
        const up = (D.get() === 'in' ? 1 : -1) * Math.sign(p.q);
        P = { p, v, B, r, F, T, up };
        ro.set('F', K.sig(F, 3) + ' N');
        ro.set('r', r < 0.01 ? K.sig(r * 1000, 3) + ' mm' : r < 1 ? K.sig(r * 100, 3) + ' cm' : K.sig(r, 3) + ' m');
        ro.set('T', K.sig(T, 3) + ' s (independent of speed)');
        ro.set('E', K.sig(Ek / 1.6e-19, 3) + ' eV');
        ro.set('dir', up > 0 ? 'towards top of page' : 'towards bottom of page');
        th = 0; draw();
      }
      function niceLen(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const n = x / p; return (n < 2 ? 1 : n < 5 ? 2 : 5) * p; }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        ctx.fillStyle = c.muted; ctx.font = '13px ' + c.font; ctx.textAlign = 'center';
        for (let x = 24; x < W; x += 44) for (let y = 24; y < H; y += 44) {
          if (D.get() === 'in') { ctx.fillText('×', x, y + 4); } else { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
        }
        const rpx = H * 0.36, scale = rpx / P.r; // px per metre
        const x0 = W * 0.36, y0 = H * 0.5, ccy = y0 - P.up * rpx;
        ctx.strokeStyle = c.v; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(x0, ccy, rpx, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = c.v; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(x0, y0); ctx.stroke();
        // position after angle th (moving right at start)
        const a0 = P.up > 0 ? Math.PI / 2 : -Math.PI / 2; // angle of particle from centre at start (screen coords)
        const dirn = P.up > 0 ? -1 : 1;
        const a = a0 + dirn * th;
        const px = x0 + rpx * Math.cos(a), py = ccy + rpx * Math.sin(a);
        const tx = -Math.sin(a) * dirn, ty = Math.cos(a) * dirn;
        K.arrow(ctx, px, py, px + tx * 44, py + ty * 44, c.n, 2.2);
        K.arrow(ctx, px, py, px + (x0 - px) * 0.3, py + (ccy - py) * 0.3, c.net, 2.4);
        ctx.fillStyle = P.p.q < 0 ? c.n : c.w; ctx.beginPath(); ctx.arc(px, py, 7, 0, 7); ctx.fill();
        K.text(ctx, P.p.q < 0 ? '−' : '+', px, py + 4, { align: 'center', color: '#fff', bold: true, size: 12, c });
        K.text(ctx, 'v', px + tx * 44 + 5, py + ty * 44, { color: c.n, bold: true, c });
        K.text(ctx, 'F', px + (x0 - px) * 0.3 + 6, py + (ccy - py) * 0.3, { color: c.net, bold: true, c });
        // scale bar
        const Lm = niceLen(80 / scale), Lpx = Lm * scale;
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 20 - Lpx, H - 18); ctx.lineTo(W - 20, H - 18); ctx.stroke();
        const lab = Lm >= 1 ? Lm + ' m' : Lm >= 0.01 ? +(Lm * 100).toPrecision(2) + ' cm' : Lm >= 1e-5 ? +(Lm * 1000).toPrecision(2) + ' mm' : K.sig(Lm, 1) + ' m';
        K.text(ctx, lab, W - 20 - Lpx / 2, H - 24, { align: 'center', size: 11.5, mono: true, c });
      }
      add(K.loop(dt => { if (!P) return; th += dt * 2 * Math.PI / 3; draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };
})();
