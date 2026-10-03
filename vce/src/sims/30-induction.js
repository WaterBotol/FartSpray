/* Unit 3 AoS 3 simulations: generator (flux & emf graphs) and transmission lines */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const f2 = (x, d) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d);

  /* ------------------------------------------------------------------ generator */
  S.generator = function (el) {
    return K.mount(el, 'Generator: flux and emf', 'A coil rotates in a uniform field (slowed down so you can watch). Compare the flux graph with the emf graph: the emf peaks when the flux passes through zero. Switch to a commutator for pulsating DC.', ({ body, add }) => {
      const cv = K.canvas(body, 0.62, { maxH: 460, label: 'Rotating generator coil with flux and emf graphs' });
      const ctl = K.controls(body);
      const Fq = K.slider(ctl, { label: 'Rotation frequency', min: 0.2, max: 2, step: 0.05, value: 0.5, fmt: v => v.toFixed(2) + ' Hz', onInput: upd });
      const N = K.slider(ctl, { label: 'Turns', min: 10, max: 500, step: 10, value: 100, fmt: v => v + ' turns', onInput: upd });
      const B = K.slider(ctl, { label: 'Magnetic field', min: 0.05, max: 1, step: 0.01, value: 0.2, fmt: v => v.toFixed(2) + ' T', onInput: upd });
      const A = K.slider(ctl, { label: 'Coil area', min: 10, max: 400, step: 10, value: 100, fmt: v => v + ' cm²', onInput: upd });
      const C = K.check(ctl, { label: 'Split-ring commutator (DC generator)', value: false, onChange: upd });
      const ro = K.readout(body, [['pk', 'Peak emf (2πfNBA)'], ['rms', 'RMS emf'], ['avg', 'Average emf over ¼ turn'], ['T', 'Period'], ['phi', 'Max flux per turn (BA)']]);
      let P = null, t = 0;
      const hist = [];
      function upd() {
        const f = Fq.get(), n = N.get(), b = B.get(), a = A.get() * 1e-4;
        const pk = 2 * Math.PI * f * n * b * a;
        P = { f, n, b, a, pk, phiMax: b * a };
        ro.set('pk', K.sig(pk, 3) + ' V');
        ro.set('rms', C.get() ? 'n/a (pulsating DC)' : K.sig(pk / Math.SQRT2, 3) + ' V');
        ro.set('avg', K.sig(4 * n * b * a * f, 3) + ' V');
        ro.set('T', f2(1 / f, 2) + ' s');
        ro.set('phi', K.sig(b * a, 3) + ' Wb');
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const sw = Math.min(W * 0.36, H * 0.9);
        const cx = sw * 0.5 + 8, cy = H * 0.48, rho = sw * 0.28;
        const phase = 2 * Math.PI * P.f * t;
        // magnets
        const pw = 16;
        ctx.fillStyle = c.w; ctx.fillRect(cx - rho - 34 - pw, cy - rho - 12, pw, 2 * rho + 24);
        ctx.fillStyle = c.n; ctx.fillRect(cx + rho + 34, cy - rho - 12, pw, 2 * rho + 24);
        K.text(ctx, 'N', cx - rho - 34 - pw / 2, cy + 5, { align: 'center', color: '#fff', bold: true, c });
        K.text(ctx, 'S', cx + rho + 34 + pw / 2, cy + 5, { align: 'center', color: '#fff', bold: true, c });
        ctx.strokeStyle = c.grid; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(cx - rho - 32, cy + k * rho * 0.45); ctx.lineTo(cx + rho + 32, cy + k * rho * 0.45); ctx.stroke(); }
        // coil: plane angle = phase + 90° so flux (plane ⊥ B) is max at t = 0
        const ang = phase + Math.PI / 2;
        const ax = cx + rho * Math.cos(ang), ay = cy - rho * Math.sin(ang);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(2 * cx - ax, 2 * cy - ay); ctx.stroke();
        ctx.fillStyle = c.acc; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, 7); ctx.fill();
        K.text(ctx, 'end view of coil', cx, H - 10, { align: 'center', size: 11, color: c.muted, c });
        // graphs
        const gx = sw + 50, gw = W - gx - 14, gh = (H - 60) / 2;
        const phi = Math.cos(phase), emfRaw = Math.sin(phase), emf = C.get() ? Math.abs(emfRaw) : emfRaw;
        hist.push([t, phi, emf]);
        while (hist.length && t - hist[0][0] > 2 / P.f) hist.shift();
        const span = 2 / P.f;
        [[gy => 20, 1, 'flux Φ (per turn)', c.net, 1], [gy => 40 + gh, 2, 'induced emf', c.v, 2]].forEach(([yf, idx, lab, col]) => {
          const gy = yf(), mid = gy + gh / 2;
          ctx.strokeStyle = c.line2; ctx.lineWidth = 1; ctx.strokeRect(gx, gy, gw, gh);
          ctx.strokeStyle = c.muted; ctx.beginPath(); ctx.moveTo(gx, mid); ctx.lineTo(gx + gw, mid); ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.beginPath();
          hist.forEach((h, i) => { const x = gx + gw * (1 - (t - h[0]) / span), y = mid - h[idx] * (gh / 2 - 6); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.stroke();
          K.text(ctx, lab, gx + 6, gy + 14, { size: 11.5, bold: true, c });
          const val = idx === 1 ? K.sig(P.phiMax * hist[hist.length - 1][1], 2) + ' Wb' : K.sig(P.pk * hist[hist.length - 1][2], 2) + ' V';
          K.text(ctx, val, gx + gw - 6, gy + 14, { align: 'right', size: 11.5, mono: true, c });
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(gx + gw, mid - hist[hist.length - 1][idx] * (gh / 2 - 6), 4, 0, 7); ctx.fill();
        });
        K.text(ctx, 'last ' + f2(span, 1) + ' s →', gx + gw, H - 6, { align: 'right', size: 11, color: c.muted, c });
      }
      add(K.loop(dt => { if (!P) return; t += dt; draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ transmission */
  S.transmission = function (el) {
    return K.mount(el, 'Transmission line calculator', 'Send power down a line with resistance. Switch transformers on and increase the step-up ratio to see the losses collapse (step-down ratio matches, so the load gets its voltage back).', ({ body, add }) => {
      const cv = K.canvas(body, 0.32, { maxH: 240, minH: 170, label: 'Power delivered versus power lost' });
      const ctl = K.controls(body);
      const Pw = K.slider(ctl, { label: 'Power sent', min: 1, max: 500, step: 1, value: 50, fmt: v => v + ' kW', onInput: upd });
      const Vg = K.slider(ctl, { label: 'Generator voltage (rms)', min: 200, max: 2000, step: 10, value: 400, fmt: v => v + ' V', onInput: upd });
      const R = K.slider(ctl, { label: 'Total line resistance', min: 0.1, max: 10, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' Ω', onInput: upd });
      const T = K.check(ctl, { label: 'Use step-up / step-down transformers', value: true, onChange: upd });
      const Nr = K.slider(ctl, { label: 'Step-up ratio (1 : n)', min: 2, max: 100, step: 1, value: 20, fmt: v => '1 : ' + v, onInput: upd });
      const ro = K.readout(body, [['Vt', 'Transmission voltage'], ['I', 'Line current'], ['drop', 'Voltage drop (IR)'], ['loss', 'Power lost (I²R)'], ['Vl', 'Voltage at load'], ['eff', 'Power delivered']]);
      const note = K.note(body);
      let P = null;
      function upd() {
        const p = Pw.get() * 1000, vg = Vg.get(), r = R.get(), tx = T.get(), n = tx ? Nr.get() : 1;
        Nr.el.hidden = !tx;
        const Vt = vg * n, I = p / Vt, drop = I * r, loss = I * I * r, Vend = Vt - drop, Vl = Vend / n, del = p - loss;
        P = { p, loss, del, ok: Vend > 0 };
        ro.set('Vt', K.sig(Vt, 3) + ' V');
        ro.set('I', K.sig(I, 3) + ' A');
        ro.set('drop', K.sig(drop, 3) + ' V');
        ro.set('loss', P.ok ? K.sig(loss / 1000, 3) + ' kW (' + f2(100 * loss / p, 1) + '%)' : 'more than the power sent!', loss / p > 0.2 ? 'bad' : loss / p > 0.05 ? 'warn' : 'good');
        ro.set('Vl', P.ok ? K.sig(Vl, 3) + ' V' : 'collapses', P.ok ? '' : 'bad');
        ro.set('eff', P.ok ? K.sig(del / 1000, 3) + ' kW' : '0', P.ok && loss / p < 0.05 ? 'good' : '');
        note.className = 'sim-note' + (P.ok ? '' : ' bad');
        note.textContent = P.ok
          ? 'I = P/V = ' + K.sig(I, 3) + ' A, so P_loss = I²R = ' + K.sig(loss, 3) + ' W. Trap: V²/R with the transmission voltage would give ' + K.sig(Vt * Vt / r, 3) + ' W, which is nonsense (more than the power sent).'
          : 'The current is so large that the voltage drop along the line exceeds the supply voltage: this system cannot deliver the power. Raise the voltage.';
        draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const x = 20, w = W - 40, y = H * 0.38, h = H * 0.26;
        const fLoss = P.ok ? Math.min(1, P.loss / P.p) : 1;
        const wd = w * (1 - fLoss), wl = w * fLoss;
        ctx.fillStyle = c.net; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, Math.max(0, wd - 2), h, [4, 0, 0, 4]) : ctx.rect(x, y, wd - 2, h); ctx.fill();
        ctx.fillStyle = c.w; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + wd, y, Math.max(0, wl), h, [0, 4, 4, 0]) : ctx.rect(x + wd, y, wl, h); ctx.fill();
        K.text(ctx, 'delivered to load', x, y - 10, { size: 12, bold: true, c });
        K.text(ctx, 'lost as heat in the lines', x + w, y - 10, { align: 'right', size: 12, bold: true, c });
        K.text(ctx, P.ok ? f2(100 * (1 - fLoss), 1) + '%' : '0%', x + 6, y + h / 2 + 5, { size: 13, bold: true, color: '#fff', mono: true, c });
        if (wl > 50) K.text(ctx, f2(100 * fLoss, 1) + '%', x + w - 6, y + h / 2 + 5, { align: 'right', size: 13, bold: true, color: '#fff', mono: true, c });
        K.text(ctx, 'Power sent: ' + K.sig(P.p / 1000, 3) + ' kW', x, y + h + 26, { size: 12, color: c.ink2, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };
})();
