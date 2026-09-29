/* Unit 4 simulations: double slit, photoelectric effect, energy levels, relativity */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const f2 = (x, d) => (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d);
  const HC = 1240; // eV nm

  /* ------------------------------------------------------------------ double slit */
  S.doubleslit = function (el) {
    return K.mount(el, 'Double slit & diffraction', 'Change the wavelength, slit separation, slit width and screen distance. Tap or click the intensity graph to measure the path difference at that point.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Interference pattern and intensity graph' });
      const ctl = K.controls(body);
      const Lm = K.slider(ctl, { label: 'Wavelength', min: 380, max: 750, step: 1, value: 633, fmt: v => v + ' nm', onInput: upd });
      const D = K.slider(ctl, { label: 'Slit separation d', min: 0.05, max: 1, step: 0.01, value: 0.25, fmt: v => v.toFixed(2) + ' mm', onInput: upd });
      const Aw = K.slider(ctl, { label: 'Slit width a', min: 0.01, max: 0.2, step: 0.005, value: 0.05, fmt: v => v.toFixed(3) + ' mm', onInput: upd });
      const L = K.slider(ctl, { label: 'Screen distance L', min: 0.5, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' m', onInput: upd });
      const single = K.check(ctl, { label: 'Single slit only (block one slit)', value: false, onChange: upd });
      const ro = K.readout(body, [['dx', 'Fringe spacing λL/d'], ['env', 'Central max width 2λL/a'], ['y', 'Marker position'], ['pd', 'Path difference at marker'], ['band', 'At the marker']]);
      let P = null, marker = null;
      const Y = 0.025; // half-width of screen window (m)
      function I(y) {
        const b = Math.PI * P.a * y / (P.lam * P.L), dd = Math.PI * P.d * y / (P.lam * P.L);
        const env = b === 0 ? 1 : Math.pow(Math.sin(b) / b, 2);
        return single.get() ? env : env * Math.pow(Math.cos(dd), 2);
      }
      function upd() {
        P = { lam: Lm.get() * 1e-9, d: D.get() * 1e-3, a: Aw.get() * 1e-3, L: L.get() };
        D.el.style.opacity = single.get() ? 0.5 : 1;
        const dx = P.lam * P.L / P.d, env = 2 * P.lam * P.L / P.a;
        ro.set('dx', single.get() ? 'n/a (single slit)' : f2(dx * 1000, 2) + ' mm');
        ro.set('env', f2(env * 1000, 1) + ' mm');
        mark(); draw();
      }
      function mark() {
        if (marker == null) { ro.set('y', 'tap the graph'); ro.set('pd', '–'); ro.set('band', '–'); return; }
        const y = marker;
        ro.set('y', f2(y * 1000, 2) + ' mm from centre');
        if (single.get()) { ro.set('pd', 'n/a'); ro.set('band', I(y) > 0.5 ? 'bright (central max)' : I(y) < 0.02 ? 'dark' : 'partly bright'); return; }
        const n = P.d * Math.abs(y) / P.L / P.lam;
        ro.set('pd', f2(n, 2) + ' λ');
        const fr = n - Math.floor(n);
        let band = 'in between';
        if (fr < 0.08 || fr > 0.92) { const k = Math.round(n); band = k === 0 ? 'central bright band' : 'bright band ' + k + ' (path diff ' + k + 'λ)'; }
        else if (Math.abs(fr - 0.5) < 0.08) { const k = Math.floor(n) + 1; band = 'dark band ' + k + ' (path diff ' + (k - 0.5) + 'λ)'; }
        ro.set('band', band, band.startsWith('dark') ? 'bad' : band.includes('bright') ? 'good' : '');
      }
      function geom() { const { W, H } = cv; return { x: 44, w: W - 60, sy: 26, sh: H * 0.22, gy: H * 0.22 + 52, gh: H - (H * 0.22 + 52) - 30 }; }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const G = geom();
        const nm = P.lam * 1e9;
        ctx.fillStyle = '#05070a'; ctx.fillRect(G.x, G.sy, G.w, G.sh);
        for (let i = 0; i < G.w; i++) {
          const y = (i / G.w * 2 - 1) * Y, v = I(y);
          ctx.fillStyle = K.waveColor(nm, Math.min(1, v * 1.2)); ctx.fillRect(G.x + i, G.sy, 1.2, G.sh);
        }
        K.text(ctx, 'screen (±' + Y * 1000 + ' mm)', G.x, G.sy - 8, { size: 11.5, color: c.muted, c });
        // intensity graph
        ctx.strokeStyle = c.line2; ctx.strokeRect(G.x, G.gy, G.w, G.gh);
        ctx.strokeStyle = c.grid; ctx.beginPath(); for (let k = -20; k <= 20; k += 5) { const px = G.x + (k / 1000 / Y + 1) / 2 * G.w; ctx.moveTo(px, G.gy); ctx.lineTo(px, G.gy + G.gh); } ctx.stroke();
        ctx.fillStyle = c.muted; ctx.font = '11px ' + c.mono; ctx.textAlign = 'center';
        for (let k = -20; k <= 20; k += 10) { const px = G.x + (k / 1000 / Y + 1) / 2 * G.w; ctx.fillText(k + '', px, G.gy + G.gh + 14); }
        K.text(ctx, 'position on screen (mm)', G.x + G.w, G.gy + G.gh + 28, { align: 'right', size: 11.5, color: c.ink2, c });
        K.text(ctx, 'intensity', G.x, G.gy - 6, { size: 11.5, color: c.ink2, c });
        if (!single.get()) {
          ctx.setLineDash([4, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.beginPath();
          for (let i = 0; i <= G.w; i += 2) { const y = (i / G.w * 2 - 1) * Y; const b = Math.PI * P.a * y / (P.lam * P.L); const e = b === 0 ? 1 : Math.pow(Math.sin(b) / b, 2); const py = G.gy + G.gh - e * (G.gh - 6); i ? ctx.lineTo(G.x + i, py) : ctx.moveTo(G.x + i, py); }
          ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.strokeStyle = c.acc; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i <= G.w; i++) { const y = (i / G.w * 2 - 1) * Y; const py = G.gy + G.gh - I(y) * (G.gh - 6); i ? ctx.lineTo(G.x + i, py) : ctx.moveTo(G.x + i, py); }
        ctx.stroke();
        if (marker != null) {
          const px = G.x + (marker / Y + 1) / 2 * G.w;
          ctx.strokeStyle = c.v; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, G.sy); ctx.lineTo(px, G.gy + G.gh); ctx.stroke();
        }
      }
      cv.cv.addEventListener('pointerdown', e => {
        const r = cv.cv.getBoundingClientRect(), G = geom();
        const x = (e.clientX - r.left) * cv.W / r.width;
        if (x < G.x || x > G.x + G.w) return;
        marker = ((x - G.x) / G.w * 2 - 1) * Y;
        mark(); draw();
      });
      cv.cv.style.cursor = 'crosshair';
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ photoelectric */
  S.photoelectric = function (el) {
    return K.mount(el, 'Photoelectric effect lab', 'Shine light on a metal. Change the wavelength (photon energy), the intensity (number of photons) and the collector voltage. Electrons leave with kinetic energies from 0 up to E<sub>k max</sub>.', ({ body, add }) => {
      const metals = { cs: ['Caesium', 2.1], na: ['Sodium', 2.3], ca: ['Calcium', 2.9], mg: ['Magnesium', 3.7], zn: ['Zinc', 4.3], cu: ['Copper', 4.7] };
      const cv = K.canvas(body, 0.56, { maxH: 420, label: 'Photoelectric tube with current-voltage and kinetic-energy graphs' });
      const ctl = K.controls(body);
      const Mt = K.select(ctl, { label: 'Metal (work function)', value: 'na', options: Object.entries(metals).map(([k, [n, w]]) => [k, n + ' (' + w + ' eV)']), onChange: upd });
      const Lm = K.slider(ctl, { label: 'Wavelength', min: 100, max: 800, step: 1, value: 400, fmt: v => v + ' nm', onInput: upd });
      const In = K.slider(ctl, { label: 'Intensity', min: 0, max: 100, step: 1, value: 60, fmt: v => v + '%', onInput: upd });
      const Vc = K.slider(ctl, { label: 'Collector voltage', min: -5, max: 5, step: 0.05, value: 0, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' V', onInput: upd });
      const ro = K.readout(body, [['E', 'Photon energy'], ['ek', 'E_k max = hf − φ'], ['v0', 'Stopping voltage'], ['f0', 'Threshold frequency / wavelength'], ['I', 'Photocurrent']]);
      const note = K.note(body);
      let P = null; const electrons = []; let spawn = 0;
      function current(V) {
        if (!P.emits) return 0;
        const fr = K.clamp((V + P.ek) / (P.ek + 1), 0, 1);
        return P.isat * (1 - Math.pow(1 - fr, 2));
      }
      function upd() {
        const [name, phi] = metals[Mt.get()]; const lam = Lm.get(); const E = HC / lam;
        P = { name, phi, lam, E, emits: E > phi, ek: Math.max(0, E - phi), isat: In.get() / 100 * 10, V: Vc.get() };
        ro.set('E', f2(E, 2) + ' eV (' + K.sig(E * 1.6e-19, 3) + ' J)');
        ro.set('ek', P.emits ? f2(P.ek, 2) + ' eV' : 'no emission', P.emits ? 'good' : 'bad');
        ro.set('v0', P.emits ? f2(P.ek, 2) + ' V' : '–');
        ro.set('f0', K.sig(phi / 4.14e-15, 3) + ' Hz / ' + Math.round(HC / phi) + ' nm');
        ro.set('I', f2(current(P.V), 2) + ' μA');
        note.className = 'sim-note' + (P.emits ? '' : ' bad');
        note.textContent = !P.emits ? 'Each photon (' + f2(E, 2) + ' eV) has less energy than the work function (' + phi + ' eV). No electrons are emitted, however bright the light. Try a shorter wavelength.'
          : In.get() === 0 ? 'No light, no photons, no photoelectrons.'
            : P.V <= -P.ek ? 'The collector is so negative that even the fastest electrons (' + f2(P.ek, 2) + ' eV) are turned back: zero current. This is at or beyond the stopping voltage.'
              : 'Electrons are emitted. Intensity changes how many (the current); wavelength changes how fast (E_k max and stopping voltage).';
        draw();
      }
      function step(dt) {
        if (!P) return;
        const rate = P.emits ? In.get() / 100 * 30 : 0;
        spawn += rate * dt;
        while (spawn > 1) { spawn -= 1; electrons.push({ x: 0, v: 0, ke: Math.random() * P.ek, done: false, y: 0.2 + Math.random() * 0.6 }); }
        electrons.forEach(e => {
          // x from 0 (plate) to 1 (collector); energy lost to retarding field: ke - eV*x
          const keNow = e.ke + P.V * e.x; // V > 0 accelerates, V < 0 decelerates (in eV)
          if (e.dirBack) { e.x -= dt * 0.5; if (e.x <= 0) e.done = true; return; }
          if (keNow <= 0.001 && P.V < 0) { e.dirBack = true; return; }
          const sp = 0.25 + 0.6 * Math.sqrt(Math.max(0, keNow));
          e.x += sp * dt; if (e.x >= 1) e.done = true;
        });
        for (let i = electrons.length - 1; i >= 0; i--) if (electrons[i].done) electrons.splice(i, 1);
        if (electrons.length > 120) electrons.splice(0, electrons.length - 120);
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const tw = W * 0.42, tx = 16, ty = 30, th = H - 70;
        ctx.fillStyle = c.s2; ctx.strokeStyle = c.line2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx, ty, tw, th, 30) : ctx.rect(tx, ty, tw, th); ctx.fill(); ctx.stroke();
        const plateX = tx + 26, colX = tx + tw - 30;
        ctx.fillStyle = c.muted; ctx.fillRect(plateX - 6, ty + 30, 10, th - 60); ctx.fillRect(colX, ty + 30, 10, th - 60);
        K.text(ctx, P.name, plateX, ty + th + 18, { align: 'center', size: 11.5, c });
        K.text(ctx, 'collector ' + (P.V > 0 ? '+' : '') + f2(P.V, 1) + ' V', colX + 4, ty + th + 18, { align: 'center', size: 11.5, c });
        // photons
        const vis = P.lam >= 380 && P.lam <= 750;
        const pc = vis ? K.waveColor(P.lam) : c.muted;
        if (In.get() > 0) {
          ctx.strokeStyle = pc; ctx.lineWidth = 2;
          const nph = 1 + Math.round(In.get() / 25);
          for (let k = 0; k < nph; k++) {
            const y0 = ty + 40 + k * (th - 80) / Math.max(1, nph - 1 || 1);
            ctx.beginPath();
            for (let s = 0; s <= 30; s++) { const x = tx - 4 + s * 0.9, y = y0 - 22 + s * 0.7 + Math.sin(s * (14 / Math.max(3, P.lam / 60))) * 3; s ? ctx.lineTo(x + 6, y) : ctx.moveTo(x + 6, y); }
            ctx.stroke();
          }
          K.text(ctx, vis ? 'light' : (P.lam < 380 ? 'UV' : 'IR'), tx + 4, ty + 18, { size: 11, color: c.ink2, bold: true, c });
        }
        ctx.fillStyle = c.n;
        electrons.forEach(e => { const x = plateX + 6 + e.x * (colX - plateX - 8), y = ty + 30 + e.y * (th - 60); ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); });
        // I-V graph
        const gx = tx + tw + 50, gw = W - gx - 16, gh = (H - 90) / 2, gy1 = 24, gy2 = gy1 + gh + 44;
        const ax1 = K.axes(ctx, { x: gx, y: gy1, w: gw, h: gh }, [-5, 5], [0, 10.5], c, { x: 'collector voltage (V)', y: 'photocurrent (μA)' });
        ctx.strokeStyle = c.acc; ctx.lineWidth = 2.2; ctx.beginPath();
        for (let i = 0; i <= 100; i++) { const V = -5 + i / 10; const px = ax1.X(V), py = ax1.Y(current(V)); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.fillStyle = c.v; ctx.beginPath(); ctx.arc(ax1.X(P.V), ax1.Y(current(P.V)), 5, 0, 7); ctx.fill();
        if (P.emits && P.ek <= 5) { ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(ax1.X(-P.ek), ax1.Y(0), 3.5, 0, 7); ctx.fill(); K.text(ctx, '−V₀', ax1.X(-P.ek), ax1.Y(0) - 8, { align: 'center', size: 11, bold: true, c }); }
        // Ek vs f graph
        const ax2 = K.axes(ctx, { x: gx, y: gy2, w: gw, h: gh - 10 }, [0, 30], [0, 8], c, { x: 'frequency (×10¹⁴ Hz)', y: 'E_k max (eV)' });
        const f0 = P.phi / 4.14e-15 / 1e14;
        ctx.strokeStyle = c.t; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ax2.X(f0), ax2.Y(0)); ctx.lineTo(ax2.X(30), ax2.Y(Math.min(8, 4.14e-15 * 30e14 - P.phi))); ctx.stroke();
        const fnow = 3e8 / (P.lam * 1e-9) / 1e14;
        if (fnow <= 30) { ctx.fillStyle = c.v; ctx.beginPath(); ctx.arc(ax2.X(fnow), ax2.Y(Math.min(8, P.ek)), 5, 0, 7); ctx.fill(); }
        K.text(ctx, 'f₀', ax2.X(f0), ax2.Y(0) - 6, { align: 'center', size: 11, bold: true, color: c.t, c });
        K.text(ctx, 'gradient = h', ax2.X(20), ax2.Y(1), { size: 11, color: c.muted, c });
      }
      add(K.loop(dt => { step(dt); draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ energy levels */
  S.levels = function (el) {
    return K.mount(el, 'Energy levels & spectral lines', 'Pick an atom and a transition. The photon energy is the difference between the levels; its wavelength appears on the spectrum strip. Tick the box to see every line possible from the upper level.', ({ body, add }) => {
      const atoms = {
        h: { name: 'Hydrogen', unit: 'eV', levels: [1, 2, 3, 4, 5, 6].map(n => ({ label: 'n = ' + n, E: -13.6 / (n * n) })), ion: 0 },
        hg: { name: 'Mercury', unit: 'eV above ground', levels: [0, 4.67, 4.89, 5.46, 6.70, 7.73, 8.84].map((E, i) => ({ label: i === 0 ? 'ground' : E.toFixed(2) + ' eV', E })), ion: 10.44 }
      };
      const cv = K.canvas(body, 0.55, { maxH: 420, label: 'Energy level diagram and spectrum' });
      const ctl = K.controls(body);
      const At = K.select(ctl, { label: 'Atom', value: 'h', options: [['h', 'Hydrogen'], ['hg', 'Mercury']], onChange: () => { fill(); upd(); } });
      const Up = K.select(ctl, { label: 'Upper level', value: '2', options: [['0', '']], onChange: upd });
      const Lo = K.select(ctl, { label: 'Lower level', value: '1', options: [['0', '']], onChange: upd });
      const Mode = K.select(ctl, { label: 'Process', value: 'em', options: [['em', 'Emission (drop down)'], ['ab', 'Absorption (jump up)']], onChange: upd });
      const All = K.check(ctl, { label: 'Show all lines from the upper level', value: false, onChange: upd });
      const ro = K.readout(body, [['dE', 'Photon energy ΔE'], ['f', 'Frequency'], ['lam', 'Wavelength'], ['band', 'Region'], ['n', 'Lines possible from upper level']]);
      let P = null;
      function fill() {
        const a = atoms[At.get()];
        const opts = a.levels.map((l, i) => '<option value="' + i + '">' + l.label + '</option>').join('');
        Up.input.innerHTML = opts; Lo.input.innerHTML = opts;
        if (At.get() === 'h') { Up.set('2'); Lo.set('1'); } else { Up.set('5'); Lo.set('3'); }
      }
      function upd() {
        const a = atoms[At.get()];
        let u = +Up.get(), l = +Lo.get();
        if (u === l) { u = Math.min(a.levels.length - 1, l + 1); if (u === l) l = u - 1; Up.set(String(u)); Lo.set(String(l)); }
        if (u < l) { [u, l] = [l, u]; Up.set(String(u)); Lo.set(String(l)); }
        const dE = a.levels[u].E - a.levels[l].E, lam = HC / dE;
        P = { a, u, l, dE, lam };
        ro.set('dE', f2(dE, 2) + ' eV (' + K.sig(dE * 1.6e-19, 3) + ' J)');
        ro.set('f', K.sig(dE / 4.14e-15, 3) + ' Hz');
        ro.set('lam', lam > 2000 ? K.sig(lam / 1000, 3) + ' μm' : f2(lam, 0) + ' nm');
        ro.set('band', K.band(lam));
        ro.set('n', String(u * (u + 1) / 2));
        draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const a = P.a, dw = W * 0.55, top = 26, bot = H - 30;
        const Es = a.levels.map(l => l.E);
        const Emax = At.get() === 'h' ? 0 : a.ion, Emin = Es[0];
        const Yv = E => bot - (E - Emin) / (Emax - Emin) * (bot - top);
        // ionisation
        ctx.setLineDash([5, 4]); ctx.strokeStyle = c.muted; ctx.beginPath(); ctx.moveTo(60, Yv(Emax)); ctx.lineTo(dw, Yv(Emax)); ctx.stroke(); ctx.setLineDash([]);
        K.text(ctx, At.get() === 'h' ? '0 eV (ionised)' : f2(a.ion, 2) + ' eV (ionised)', dw - 4, Yv(Emax) - 5, { align: 'right', size: 11, color: c.muted, c });
        a.levels.forEach((l, i) => {
          const y = Yv(l.E);
          ctx.strokeStyle = (i === P.u || i === P.l) ? c.ink : c.line2; ctx.lineWidth = (i === P.u || i === P.l) ? 2.4 : 1.4;
          ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(dw, y); ctx.stroke();
          const lab = At.get() === 'h' ? f2(l.E, 2) : f2(l.E, 2);
          K.text(ctx, lab, 54, y + 4, { align: 'right', size: 10.5, mono: true, color: c.muted, c });
        });
        const pairs = [];
        if (All.get()) { for (let u = 1; u <= P.u; u++) for (let l = 0; l < u; l++) pairs.push([u, l]); }
        else pairs.push([P.u, P.l]);
        const em = Mode.get() === 'em';
        pairs.forEach(([u, l], k) => {
          const x = 80 + (k + 0.5) * (dw - 100) / pairs.length;
          const lam = HC / (a.levels[u].E - a.levels[l].E);
          const col = lam >= 380 && lam <= 750 ? K.waveColor(lam) : (lam < 380 ? c.t : c.w);
          const y1 = Yv(em ? a.levels[u].E : a.levels[l].E), y2 = Yv(em ? a.levels[l].E : a.levels[u].E);
          K.arrow(ctx, x, y1, x, y2, col, pairs.length > 6 ? 1.8 : 2.6);
        });
        // spectrum strip
        const sx = dw + 30, sw = W - sx - 14, sy = H * 0.36, sh = 46;
        const lamToX = lam => sx + (lam - 350) / (800 - 350) * sw;
        for (let i = 0; i < sw; i++) {
          const lam = 350 + i / sw * 450;
          ctx.fillStyle = em ? '#05070a' : K.waveColor(lam, 1);
          ctx.fillRect(sx + i, sy, 1.2, sh);
        }
        K.text(ctx, em ? 'emission spectrum' : 'absorption spectrum', sx, sy - 10, { size: 11.5, bold: true, c });
        const outside = [];
        pairs.forEach(([u, l]) => {
          const lam = HC / (a.levels[u].E - a.levels[l].E);
          if (lam < 350 || lam > 800) { outside.push(lam); return; }
          const x = lamToX(lam);
          ctx.fillStyle = em ? K.waveColor(lam) : '#05070a';
          ctx.fillRect(x - 1.5, sy, 3, sh);
          K.text(ctx, Math.round(lam) + '', x, sy + sh + 14, { align: 'center', size: 10.5, mono: true, c });
        });
        K.text(ctx, '350 nm', sx, sy + sh + 30, { size: 10.5, mono: true, color: c.muted, c });
        K.text(ctx, '800 nm', sx + sw, sy + sh + 30, { align: 'right', size: 10.5, mono: true, color: c.muted, c });
        if (outside.length) K.text(ctx, outside.length + ' line' + (outside.length > 1 ? 's' : '') + ' outside this strip (UV or IR)', sx, sy + sh + 50, { size: 11, color: c.muted, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      fill(); upd();
    });
  };

  /* ------------------------------------------------------------------ relativity */
  S.relativity = function (el) {
    return K.mount(el, 'Relativity calculator', 'Drag the speed towards c and watch γ explode. Pick a scenario to see time dilation and length contraction worked out in both frames.', ({ body, add }) => {
      const cv = K.canvas(body, 0.46, { maxH: 340, label: 'Graph of gamma against speed with a contracted spaceship' });
      const ctl = K.controls(body);
      const B = K.slider(ctl, { label: 'Speed v', min: 0, max: 0.999, step: 0.001, value: 0.8, fmt: v => v.toFixed(3) + ' c', onInput: upd });
      const Sc = K.select(ctl, { label: 'Scenario', value: 'star', options: [['star', 'Trip to a star 12 ly away'], ['muon', 'Muon crossing 10 km of atmosphere'], ['ship', '100 m spaceship, 1 h on board']], onChange: v => { if (v === 'muon') B.set(0.998); if (v === 'star') B.set(0.8); if (v === 'ship') B.set(0.6); upd(); } });
      const ro = K.readout(body, [['g', 'Lorentz factor γ'], ['a', ''], ['b', ''], ['c', ''], ['d', '']]);
      const labels = ro.el.querySelectorAll('.ro span');
      const note = K.note(body);
      let P = null;
      function upd() {
        const b = B.get(), gm = 1 / Math.sqrt(1 - b * b), sc = Sc.get();
        P = { b, gm, sc };
        ro.set('g', gm.toFixed(3));
        const L = (i, t) => { labels[i].textContent = t; };
        if (sc === 'star') {
          const L0 = 12, tE = b > 0 ? L0 / b : Infinity, t0 = tE / gm;
          L(1, 'Earth time (dilated)'); ro.set('a', b > 0 ? f2(tE, 2) + ' years' : '∞');
          L(2, 'Astronaut time (proper)'); ro.set('b', b > 0 ? f2(t0, 2) + ' years' : '∞', 'good');
          L(3, 'Distance, Earth frame (proper)'); ro.set('c', '12.00 ly');
          L(4, 'Distance, astronaut frame'); ro.set('d', f2(L0 / gm, 2) + ' ly', 'good');
          note.textContent = 'Earth measures proper length (12 ly) and dilated time; the astronaut measures proper time and a contracted distance. Both get speed = ' + f2(b, 3) + 'c.';
        } else if (sc === 'muon') {
          const t0 = 2.2e-6, L0 = 10000, t = gm * t0, d = b * 3e8 * t;
          L(1, 'Lifetime in Earth frame (γt₀)'); ro.set('a', K.sig(t * 1e6, 3) + ' μs');
          L(2, 'Distance in that time'); ro.set('b', f2(d / 1000, 2) + ' km', d >= L0 ? 'good' : 'bad');
          L(3, 'Classical distance (no dilation)'); ro.set('c', f2(b * 3e8 * t0, 0) + ' m');
          L(4, 'Atmosphere in muon frame (L₀/γ)'); ro.set('d', f2(L0 / gm, 0) + ' m', L0 / gm <= b * 3e8 * t0 ? 'good' : 'bad');
          note.textContent = d >= L0 ? 'The typical muon survives to the ground: time dilation (Earth frame) and length contraction (muon frame) give the same answer.' : 'At this speed a typical muon decays before reaching the ground. Push v closer to c.';
        } else {
          L(1, 'Ship length seen from Earth'); ro.set('a', f2(100 / gm, 1) + ' m');
          L(2, 'Ship length seen by crew (proper)'); ro.set('b', '100.0 m');
          L(3, '1 h on board, seen from Earth'); ro.set('c', f2(gm, 3) + ' h');
          L(4, 'Kinetic energy per kg (γ − 1)c²'); ro.set('d', K.sig((gm - 1) * 9e16, 3) + ' J');
          note.textContent = 'Only the length along the motion contracts. The crew notice nothing: in their frame the ship is 100 m and their clocks tick normally.';
        }
        draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const gw = W * 0.55;
        const ax = K.axes(ctx, { x: 44, y: 22, w: gw - 60, h: H - 64 }, [0, 1], [1, 8], c, { x: 'v / c', y: 'γ' });
        ctx.strokeStyle = c.acc; ctx.lineWidth = 2.2; ctx.beginPath();
        let first = true;
        for (let i = 0; i <= 400; i++) { const b = i / 400 * 0.995; const gm = 1 / Math.sqrt(1 - b * b); if (gm > 8) break; const px = ax.X(b), py = ax.Y(gm); first ? ctx.moveTo(px, py) : ctx.lineTo(px, py); first = false; }
        ctx.stroke();
        const gy = Math.min(8, P.gm);
        ctx.fillStyle = c.v; ctx.beginPath(); ctx.arc(ax.X(P.b), ax.Y(gy), 6, 0, 7); ctx.fill();
        if (P.gm > 8) K.text(ctx, 'γ = ' + P.gm.toFixed(1) + ' (off scale)', ax.X(P.b) - 6, ax.Y(8) + 16, { align: 'right', size: 11.5, color: c.v, bold: true, c });
        // spaceship
        const sx = gw + 16, sw = W - sx - 16, len = sw * 0.9 / P.gm, cy = H * 0.34;
        K.text(ctx, 'at rest (proper length)', sx, cy - 30, { size: 11, color: c.muted, c });
        const ship = (x, y, l) => { ctx.fillStyle = c.acc; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + l * 0.85, y - 10); ctx.lineTo(x + l, y); ctx.lineTo(x + l * 0.85, y + 10); ctx.lineTo(x, y + 10); ctx.closePath(); ctx.fill(); };
        ship(sx, cy - 12, sw * 0.9);
        K.text(ctx, 'moving at ' + P.b.toFixed(3) + 'c (measured from outside)', sx, cy + 30, { size: 11, color: c.muted, c });
        ship(sx, cy + 46, len);
        K.arrow(ctx, sx + len + 8, cy + 46, sx + len + 40, cy + 46, c.v, 2);
        K.text(ctx, 'height unchanged, length ÷ γ', sx, cy + 80, { size: 11, color: c.ink2, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };
  S.standing = function (el) {
    return K.mount(el, 'Standing waves on a string', 'A wave travels along a string fixed at both ends and reflects. The incident and reflected waves superpose to make a standing wave. Pick a harmonic, slow it down, and show the two travelling waves that add to give it.', ({ body, add }) => {
      const cv = K.canvas(body, 0.42, { maxH: 300, minH: 200, label: 'Animated standing wave on a string fixed at both ends' });
      const ctl = K.controls(body);
      const N = K.slider(ctl, { label: 'Harmonic n', min: 1, max: 6, step: 1, value: 3, fmt: v => 'n = ' + v, onInput: upd });
      const L = K.slider(ctl, { label: 'String length L', min: 0.5, max: 2.0, step: 0.05, value: 1.2, fmt: v => v.toFixed(2) + ' m', onInput: upd });
      const V = K.slider(ctl, { label: 'Wave speed v', min: 20, max: 200, step: 5, value: 60, fmt: v => v + ' m/s', onInput: upd });
      const Sp = K.slider(ctl, { label: 'Animation speed', min: 0, max: 1, step: 0.05, value: 0.35, fmt: v => v === 0 ? 'paused' : Math.round(v * 100) + '%' });
      const Tr = K.check(ctl, { label: 'Show the two travelling waves', value: false, onChange: () => draw() });
      const ro = K.readout(body, [['lam', 'Wavelength λ = 2L/n'], ['f', 'Frequency f = nv/2L'], ['nodes', 'Nodes (incl. ends)'], ['anti', 'Antinodes']]);
      const note = K.note(body);
      let ph = 0;
      function upd() {
        const n = N.get(), l = L.get(), v = V.get(), lam = 2 * l / n;
        ro.set('lam', lam.toFixed(3) + ' m'); ro.set('f', (v / lam).toFixed(1) + ' Hz');
        ro.set('nodes', String(n + 1)); ro.set('anti', String(n));
        note.textContent = 'Node spacing = λ/2 = ' + (lam / 2).toFixed(3) + ' m. Points between neighbouring nodes move together; points on either side of a node move in opposite directions.';
        draw();
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const n = N.get(), x0 = 36, x1 = W - 36, y0 = H / 2, A = H * 0.3;
        ctx.fillStyle = c.muted; ctx.fillRect(x0 - 8, y0 - A - 16, 8, 2 * A + 32); ctx.fillRect(x1, y0 - A - 16, 8, 2 * A + 32);
        ctx.strokeStyle = c.line2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke(); ctx.setLineDash([]);
        const k = n * Math.PI, cw = Math.cos(ph);
        const curve = (fn, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); for (let i = 0; i <= 300; i++) { const u = i / 300, y = fn(u); const px = x0 + u * (x1 - x0), py = y0 - y * A; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); };
        // envelope
        ctx.globalAlpha = 0.35; curve(u => Math.sin(k * u), c.line2, 1); curve(u => -Math.sin(k * u), c.line2, 1); ctx.globalAlpha = 1;
        if (Tr.get()) {
          curve(u => 0.5 * Math.sin(k * u - ph), c.n, 1.6);
          curve(u => 0.5 * Math.sin(k * u + ph), c.t, 1.6);
        }
        curve(u => Math.sin(k * u) * cw, c.acc, 3);
        for (let j = 0; j <= n; j++) { const px = x0 + j / n * (x1 - x0); ctx.fillStyle = c.bad; ctx.beginPath(); ctx.arc(px, y0, 4.5, 0, 7); ctx.fill(); }
        for (let j = 0; j < n; j++) { const px = x0 + (j + 0.5) / n * (x1 - x0); K.text(ctx, 'A', px, y0 + A + 16, { align: 'center', size: 11, color: c.muted, bold: true, c }); }
        K.text(ctx, '● node', x0, 16, { size: 11, color: c.bad, bold: true, c });
        K.text(ctx, 'A = antinode', x0 + 64, 16, { size: 11, color: c.muted, c });
        if (Tr.get()) { K.text(ctx, 'incident →', x1 - 150, 16, { size: 11, color: c.n, bold: true, c }); K.text(ctx, '← reflected', x1 - 70, 16, { size: 11, color: c.t, bold: true, c }); }
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      if (!K.reduced()) add(K.loop(dt => { const sp = Sp.get(); if (!sp) return; ph += dt * 6 * sp; draw(); }, cv.wrap));
      upd();
    });
  };
})();
