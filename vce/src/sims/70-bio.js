/* Biology interactives: DNA helix hero, gene-to-protein translator with mutations, gel electrophoresis,
   enzyme kinetics with inhibitors, photosynthesis limiting factors, genetic drift. */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const f = (x, d) => (!isFinite(x) ? '–' : (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d == null ? 2 : d));
  const box = (W, H, l, r, t, b) => ({ x: l, y: t, w: W - l - r, h: H - t - b });

  /* ------------------------------------------------------------------ hero: DNA helix */
  S.heroBio = function (el) {
    el.innerHTML = '';
    const cvs = K.canvas(el, 0.8, { maxH: 440, minH: 260, label: 'A rotating DNA double helix with complementary base pairs. Tap to pause.' });
    cvs.wrap.style.border = '0'; cvs.wrap.style.borderRadius = '0';
    const cap = document.createElement('div'); cap.className = 'cap'; el.appendChild(cap);
    const seq = 'ATGCGTACCGATTGCAGTCAATGGCTAGCTTAAGC';
    const comp = { A: 'T', T: 'A', G: 'C', C: 'G' };
    let ph = 0, paused = false;
    const { ctx } = cvs;
    function draw() {
      const W = cvs.W, H = cvs.H, c = K.col();
      ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      K.grid(ctx, W, H, 28, c);
      const n = seq.length, x0 = W * 0.06, x1 = W * 0.94, amp = H * 0.22, cy = H * 0.46;
      const col = { A: c.w, T: c.n, G: c.acc, C: c.v };
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = x0 + (x1 - x0) * i / (n - 1), a = i * 0.55 + ph;
        pts.push({ x, y1: cy + amp * Math.sin(a), y2: cy + amp * Math.sin(a + Math.PI), z: Math.cos(a), b: seq[i] });
      }
      // rungs (behind first)
      pts.slice().sort((p, q) => p.z - q.z).forEach(p => {
        const my = (p.y1 + p.y2) / 2;
        ctx.lineWidth = 5; ctx.globalAlpha = 0.45 + 0.4 * Math.abs(p.z);
        ctx.strokeStyle = col[p.b]; ctx.beginPath(); ctx.moveTo(p.x, p.y1); ctx.lineTo(p.x, my); ctx.stroke();
        ctx.strokeStyle = col[comp[p.b]]; ctx.beginPath(); ctx.moveTo(p.x, my); ctx.lineTo(p.x, p.y2); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      [['y1', c.ink2], ['y2', c.muted]].forEach(([k, s]) => { ctx.strokeStyle = s; ctx.lineWidth = 3.2; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p[k]) : ctx.moveTo(p.x, p[k])); ctx.stroke(); });
      cap.textContent = 'A–T · G–C · sugar–phosphate backbones · tap to ' + (paused ? 'play' : 'pause');
    }
    cvs.draw = draw;
    cvs.cv.addEventListener('pointerdown', () => { paused = !paused; draw(); });
    let stop = null;
    if (K.reduced()) draw(); else stop = K.loop(dt => { if (!paused) ph += dt * 0.9; draw(); }, cvs.cv);
    const off = K.onTheme(draw);
    return () => { if (stop) stop(); off(); cvs.destroy(); };
  };

  /* ------------------------------------------------------------------ translation + mutations */
  const AA1 = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const B = 'UCAG';
  const THREE = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'STOP' };
  const codonAA = c => AA1[B.indexOf(c[0]) * 16 + B.indexOf(c[1]) * 4 + B.indexOf(c[2])];
  function translate(mrna) {
    const start = mrna.indexOf('AUG');
    if (start < 0) return { start: -1, codons: [], aa: [] };
    const codons = [], aa = [];
    for (let i = start; i + 3 <= mrna.length; i += 3) { const cd = mrna.slice(i, i + 3), a = codonAA(cd); codons.push(cd); aa.push(a); if (a === '*') break; }
    return { start, codons, aa };
  }
  S.translation = function (el) {
    return K.mount(el, 'Gene-to-protein translator', 'Type or edit a DNA or mRNA sequence. The tool finds the first AUG start codon, reads codons in frame and stops at a stop codon. Then apply a mutation to see whether it is silent, missense, nonsense or a frameshift.', ({ body }) => {
      const ctl = K.controls(body);
      const Mode = K.select(ctl, { label: 'Sequence type', value: 'coding', options: [['coding', 'DNA coding strand (5′→3′)'], ['template', 'DNA template strand (3′→5′)'], ['mrna', 'mRNA (5′→3′)']], onChange: upd });
      const lab = document.createElement('label'); lab.className = 'ctl'; lab.style.gridColumn = '1 / -1';
      lab.innerHTML = '<span class="ctl-top"><span>Sequence</span></span><input type="text" spellcheck="false" autocomplete="off" style="font-family:var(--font-mono);font-size:15px;padding:8px 10px;border:1px solid var(--line-2);border-radius:8px;background:var(--surface);color:var(--ink);width:100%;letter-spacing:0.06em">';
      const inp = lab.querySelector('input'); inp.value = 'CCATGGCTGAAGTTCGATGGTAAGC';
      ctl.appendChild(lab);
      inp.addEventListener('input', upd);
      const mctl = K.controls(body);
      const Mt = K.select(mctl, { label: 'Mutation type', value: 'none', options: [['none', 'No mutation'], ['sub', 'Substitution'], ['ins', 'Insertion (one base)'], ['del', 'Deletion (one base)']], onChange: upd });
      const Pos = K.slider(mctl, { label: 'Position in mRNA (from start codon)', min: 1, max: 30, step: 1, value: 6, onInput: upd });
      const Base = K.select(mctl, { label: 'New base', value: 'A', options: [['A', 'A'], ['U', 'U'], ['G', 'G'], ['C', 'C']], onChange: upd });
      const out = document.createElement('div'); out.className = 'codon-out'; body.appendChild(out);
      const ro = K.readout(body, [['mrna', 'mRNA'], ['prot', 'Polypeptide'], ['mut', 'Effect of mutation']]);
      function toMRNA() {
        const raw = inp.value.toUpperCase().replace(/[^ACGTU]/g, '');
        const m = Mode.get();
        if (m === 'mrna') return raw.replace(/T/g, 'U');
        if (m === 'coding') return raw.replace(/T/g, 'U');
        const cmp = { A: 'U', T: 'A', U: 'A', G: 'C', C: 'G' }; // template read 3'->5' as typed
        return raw.split('').map(b => cmp[b]).join('');
      }
      const chips = (tr, mutIdx) => tr.codons.map((cd, i) => {
        const a = tr.aa[i], cls = a === '*' ? 'cd stop' : i === 0 ? 'cd start' : 'cd';
        const hit = mutIdx != null && Math.floor(mutIdx / 3) === i ? ' mut' : '';
        return '<span class="' + cls + hit + '"><b>' + cd + '</b><i>' + THREE[a] + '</i></span>';
      }).join('');
      function upd() {
        const mrna = toMRNA();
        const tr = translate(mrna);
        Pos.input.max = Math.max(3, tr.codons.length * 3);
        ro.set('mrna', mrna ? "5′ " + mrna + " 3′" : '–');
        if (tr.start < 0) { out.innerHTML = '<p class="sim-note">No AUG start codon found.</p>'; ro.set('prot', 'none (no start codon)'); ro.set('mut', '–'); return; }
        const prot = tr.aa.filter(a => a !== '*').map(a => THREE[a]).join('–');
        ro.set('prot', prot + (tr.aa[tr.aa.length - 1] === '*' ? ' (stop)' : ' (no stop codon reached)'));
        const mt = Mt.get();
        Pos.el.style.display = Base.el.style.display = mt === 'none' ? 'none' : '';
        if (mt === 'del') Base.el.style.display = 'none';
        if (mt === 'none') { out.innerHTML = '<div class="codon-strip">' + chips(tr) + '</div>'; ro.set('mut', 'no mutation applied'); return; }
        const p = tr.start + Math.min(Pos.get(), tr.codons.length * 3) - 1;
        let m2 = mrna;
        if (mt === 'sub') m2 = mrna.slice(0, p) + Base.get() + mrna.slice(p + 1);
        if (mt === 'ins') m2 = mrna.slice(0, p) + Base.get() + mrna.slice(p);
        if (mt === 'del') m2 = mrna.slice(0, p) + mrna.slice(p + 1);
        const t2 = translate(m2.slice(tr.start)); // keep the same start
        const rel = p - tr.start;
        out.innerHTML = '<p class="ln">Original</p><div class="codon-strip">' + chips(tr, rel) + '</div><p class="ln">Mutant</p><div class="codon-strip">' + chips(t2, rel) + '</div>';
        let eff;
        if (mt !== 'sub') eff = 'frameshift: every codon after position ' + (rel + 1) + ' is read in a new frame, changing the amino acids downstream' + (t2.aa.indexOf('*') >= 0 && t2.aa.length < tr.aa.length ? ' and creating an early stop codon' : '');
        else {
          const i = Math.floor(rel / 3), a0 = tr.aa[i], a1 = t2.aa[i];
          if (a0 === a1) eff = 'silent: ' + tr.codons[i] + ' → ' + t2.codons[i] + ' still codes for ' + THREE[a0] + ' (degenerate code)';
          else if (a1 === '*') eff = 'nonsense: ' + tr.codons[i] + ' → ' + t2.codons[i] + ' is a stop codon, so the polypeptide is cut short';
          else if (a0 === '*') eff = 'stop codon lost: translation continues past the original end';
          else eff = 'missense: ' + THREE[a0] + ' → ' + THREE[a1] + ' (one amino acid changed)';
        }
        ro.set('mut', eff, /silent/.test(eff) ? 'good' : 'bad');
      }
      upd();
    });
  };

  /* ------------------------------------------------------------------ gel electrophoresis */
  const GEL = {
    crime: { name: 'DNA profiling: crime scene', ladder: [1000, 800, 600, 500, 400, 300, 200, 100], lanes: [['Crime scene', [520, 350, 240, 180]], ['Suspect 1', [610, 350, 270, 180]], ['Suspect 2', [520, 350, 240, 180]], ['Suspect 3', [520, 420, 240, 130]]], note: 'Suspect 2 matches the crime-scene sample at every band. Suspects 1 and 3 each have bands that don\'t match, so they are excluded.' },
    paternity: { name: 'Paternity test', ladder: [1000, 800, 600, 500, 400, 300, 200, 100], lanes: [['Mother', [700, 450, 300, 160]], ['Child', [700, 520, 300, 220]], ['Man A', [640, 520, 380, 220]], ['Man B', [560, 410, 250, 120]]], note: 'Every child band not from the mother (520 and 220 bp) is present in Man A, so he could be the father; Man B has neither, so he is excluded.' },
    plasmid: { name: 'Restriction digest of a 3000 bp plasmid', ladder: [3000, 2000, 1500, 1000, 700, 500, 300, 100], lanes: [['EcoRI (1 site)', [3000]], ['BamHI (2 sites)', [1800, 1200]], ['EcoRI + BamHI', [1800, 700, 500]]], note: 'A circular plasmid cut once gives one linear fragment (3000 bp); cut at n sites it gives n fragments. The fragments in each lane add up to 3000 bp.' }
  };
  S.gel = function (el) {
    return K.mount(el, 'Gel electrophoresis', 'Choose a scenario and run the gel. DNA is negatively charged and moves towards the positive electrode; smaller fragments move further. Tap a band to read its size.', ({ body, add }) => {
      const cv = K.canvas(body, 0.62, { maxH: 440, label: 'Agarose gel with DNA bands' });
      const ctl = K.controls(body);
      const Sc = K.select(ctl, { label: 'Scenario', value: 'crime', options: Object.entries(GEL).map(([k, v]) => [k, v.name]), onChange: () => { prog = 0; run(); } });
      const Sz = K.check(ctl, { label: 'Show ladder sizes', value: true, onChange: draw });
      K.buttons(body, [{ label: 'Run gel', primary: true, onClick: () => { prog = 0; run(); } }]);
      const ro = K.readout(body, [['band', 'Selected band'], ['int', 'Interpretation']]);
      let prog = 0, stop = null, bands = [];
      function run() {
        if (stop) stop();
        ro.set('int', 'running…');
        if (K.reduced()) { prog = 1; draw(); ro.set('int', GEL[Sc.get()].note); return; }
        stop = K.loop(dt => { prog = Math.min(1, prog + dt / 2.2); draw(); if (prog >= 1) { stop(); stop = null; ro.set('int', GEL[Sc.get()].note); } }, cv.cv);
      }
      add(() => stop && stop());
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const g = GEL[Sc.get()], lanes = [['Ladder', g.ladder]].concat(g.lanes);
        const b = box(W, H, 58, 16, 34, 26);
        ctx.fillStyle = c.s2; ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = c.line2; ctx.strokeRect(b.x, b.y, b.w, b.h);
        K.text(ctx, '− (wells)', b.x - 6, b.y + 4, { align: 'right', size: 11.5, color: c.bad, bold: true, c });
        K.text(ctx, '+', b.x - 6, b.y + b.h, { align: 'right', size: 14, color: c.good, bold: true, c });
        const lw = b.w / lanes.length, lmin = Math.log10(g.ladder[g.ladder.length - 1]), lmax = Math.log10(g.ladder[0]);
        const yOf = s => b.y + 14 + prog * (b.h - 30) * (1 - (Math.log10(s) - lmin) / (lmax - lmin) * 0.92 - 0.02);
        bands = [];
        lanes.forEach(([name, sizes], i) => {
          const x = b.x + lw * i + lw * 0.18, w = lw * 0.64;
          ctx.fillStyle = c.line2; ctx.fillRect(x, b.y + 4, w, 6);
          K.text(ctx, name, x + w / 2, b.y - 8, { align: 'center', size: 11, bold: i === 0, c });
          sizes.forEach(s => {
            const y = yOf(s);
            ctx.fillStyle = i === 0 ? c.muted : c.acc; ctx.globalAlpha = 0.9; ctx.fillRect(x, y - 3, w, 6); ctx.globalAlpha = 1;
            bands.push({ x, w, y, s, name });
            if (i === 0 && Sz.get() && prog > 0.95) K.text(ctx, String(s), b.x - 6, y + 4, { align: 'right', size: 10.5, mono: true, color: c.muted, c });
          });
        });
      }
      cv.cv.addEventListener('pointerdown', e => {
        const r = cv.cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.W / r.width, y = (e.clientY - r.top) * cv.H / r.height;
        const hit = bands.find(bd => x >= bd.x && x <= bd.x + bd.w && Math.abs(y - bd.y) < 7);
        ro.set('band', hit ? hit.name + ': ' + hit.s + ' bp' : 'tap on a band');
      });
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      ro.set('band', 'tap on a band');
      run();
    });
  };

  /* ------------------------------------------------------------------ enzyme kinetics */
  const ENZ = { amylase: { name: 'Salivary amylase (optimum pH 7)', pH: 7, w: 1.6 }, pepsin: { name: 'Pepsin (optimum pH 2)', pH: 2, w: 1.1 }, trypsin: { name: 'Trypsin (optimum pH 8)', pH: 8, w: 1.4 } };
  S.enzyme = function (el) {
    return K.mount(el, 'Enzyme activity and inhibitors', 'Reaction rate against substrate concentration. Change temperature and pH, or add a competitive or non-competitive inhibitor. The dashed curve shows the same enzyme without inhibitor.', ({ body, add }) => {
      const cv = K.canvas(body, 0.52, { maxH: 380, label: 'Graph of reaction rate against substrate concentration' });
      const ctl = K.controls(body);
      const E = K.select(ctl, { label: 'Enzyme', value: 'amylase', options: Object.entries(ENZ).map(([k, v]) => [k, v.name]), onChange: upd });
      const T = K.slider(ctl, { label: 'Temperature', min: 0, max: 70, step: 1, value: 37, fmt: v => v + ' °C', onInput: upd });
      const P = K.slider(ctl, { label: 'pH', min: 1, max: 13, step: 0.5, value: 7, fmt: v => v.toFixed(1), onInput: upd });
      const I = K.select(ctl, { label: 'Inhibitor', value: 'none', options: [['none', 'None'], ['comp', 'Competitive'], ['non', 'Non-competitive']], onChange: upd });
      const Ic = K.slider(ctl, { label: 'Inhibitor concentration', min: 0, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1), onInput: upd });
      const ro = K.readout(body, [['vmax', 'Maximum rate (relative)'], ['state', 'What is happening']]);
      let st = null;
      function tempF(t) { const act = Math.exp(0.07 * (t - 37)); const den = 1 / (1 + Math.exp((t - 45) / 2.2)); return act * den / (1 / (1 + Math.exp(-8 / 2.2))); }
      function upd() {
        const e = ENZ[E.get()], t = T.get(), p = P.get();
        const vmax0 = 100 * tempF(t) * Math.exp(-Math.pow((p - e.pH) / e.w, 2)), Km = 2;
        const i = I.get(), ic = Ic.get(), Ki = 1;
        const Kapp = i === 'comp' ? Km * (1 + ic / Ki) : Km, Vapp = i === 'non' ? vmax0 / (1 + ic / Ki) : vmax0;
        st = { vmax0, Km, Kapp, Vapp, i };
        Ic.el.style.display = i === 'none' ? 'none' : '';
        ro.set('vmax', f(Vapp, 1) + (i !== 'none' ? '  (uninhibited ' + f(vmax0, 1) + ')' : ''));
        let s = [];
        if (t > 45) s.push('above ~45 °C the enzyme is denaturing: its active site is losing its shape');
        else if (t < 15) s.push('low temperature: fewer, less energetic collisions (not denatured)');
        if (Math.abs(p - e.pH) > 1.5) s.push('pH far from optimum: R-group charges change, distorting the active site');
        if (i === 'comp') s.push('competitive: inhibitor blocks the active site; at very high substrate the rate approaches the normal maximum');
        if (i === 'non') s.push('non-competitive: inhibitor binds elsewhere; the maximum rate is lowered at every substrate concentration');
        ro.set('state', s.length ? s.join('; ') : 'near optimal conditions');
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const b = box(W, H, 46, 14, 16, 30), xr = [0, 30], yr = [0, 110];
        const M = K.axes(ctx, b, xr, yr, c, { x: 'substrate concentration', y: 'rate' });
        const plot = (V, Km, col, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.6; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let s = 0; s <= 30; s += 0.2) { const v = V * s / (Km + s); s ? ctx.lineTo(M.X(s), M.Y(v)) : ctx.moveTo(M.X(s), M.Y(v)); } ctx.stroke(); ctx.restore(); };
        if (st.i !== 'none') plot(st.vmax0, st.Km, c.muted, [6, 5]);
        plot(st.Vapp, st.Kapp, c.acc);
        ctx.setLineDash([3, 4]); ctx.strokeStyle = c.warn; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x, M.Y(st.Vapp)); ctx.lineTo(b.x + b.w, M.Y(st.Vapp)); ctx.stroke(); ctx.setLineDash([]);
        K.text(ctx, 'max rate', b.x + b.w - 4, M.Y(st.Vapp) - 5, { align: 'right', size: 11, color: c.warn, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ photosynthesis limiting factors */
  S.photo = function (el) {
    return K.mount(el, 'Limiting factors in photosynthesis', 'The rate of photosynthesis (C3 plant) against light intensity at the CO₂ concentration and temperature you choose. The marker shows your chosen light intensity; the readout says which factor is limiting there.', ({ body, add }) => {
      const cv = K.canvas(body, 0.52, { maxH: 380, label: 'Graph of photosynthesis rate against light intensity' });
      const ctl = K.controls(body);
      const L = K.slider(ctl, { label: 'Light intensity', min: 0, max: 100, step: 1, value: 30, fmt: v => v + ' %', onInput: upd });
      const C = K.slider(ctl, { label: 'CO₂ concentration', min: 0.01, max: 0.15, step: 0.005, value: 0.04, fmt: v => v.toFixed(3) + ' %', onInput: upd });
      const T = K.slider(ctl, { label: 'Temperature', min: 0, max: 50, step: 1, value: 20, fmt: v => v + ' °C', onInput: upd });
      const ro = K.readout(body, [['rate', 'Rate (relative)'], ['lim', 'Limiting factor at this point']]);
      let st = null;
      const tf = t => Math.exp(-Math.pow((t - 28) / 11, 2)) * (t > 40 ? Math.max(0, 1 - (t - 40) / 10) : 1);
      const cf = co => co / (co + 0.04);
      const pmax = (co, t) => 100 * cf(co) * tf(t) / cf(0.15);
      const rate = (l, co, t) => { const pm = pmax(co, t); return pm * (1 - Math.exp(-l / 18 * (100 / Math.max(pm, 1)) * 0.9)); };
      function upd() {
        const l = L.get(), co = C.get(), t = T.get();
        const r = rate(l, co, t);
        const dl = rate(Math.min(100, l + 10), co, t) - r, dc = rate(l, Math.min(0.15, co + 0.02), t) - r, dt = rate(l, co, Math.min(28, t + 5)) - r;
        const best = [['light intensity', dl], ['CO₂ concentration', dc], ['temperature', t < 28 ? dt : -1]].sort((a, b) => b[1] - a[1])[0];
        st = { l, co, t, r };
        ro.set('rate', f(r, 1));
        ro.set('lim', best[1] < 0.5 ? (t > 38 ? 'temperature is too high (enzymes such as Rubisco denaturing)' : 'near the maximum for these conditions') : best[0] + ' (increasing it raises the rate the most)', best[1] < 0.5 ? '' : 'good');
        draw();
      }
      function draw() {
        if (!st) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const b = box(W, H, 46, 14, 16, 30);
        const M = K.axes(ctx, b, [0, 100], [0, 110], c, { x: 'light intensity (%)', y: 'rate of photosynthesis' });
        const line = (co, t, col, w, dash) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.beginPath(); for (let l = 0; l <= 100; l += 1) { const y = rate(l, co, t); l ? ctx.lineTo(M.X(l), M.Y(y)) : ctx.moveTo(M.X(l), M.Y(y)); } ctx.stroke(); ctx.restore(); };
        line(0.15, st.t, c.muted, 1.6, [6, 5]);
        line(st.co, st.t, c.acc, 2.8);
        K.text(ctx, 'high CO₂ (0.15%)', M.X(98), M.Y(rate(98, 0.15, st.t)) - 6, { align: 'right', size: 11, color: c.muted, c });
        ctx.beginPath(); ctx.arc(M.X(st.l), M.Y(st.r), 6, 0, 7); ctx.fillStyle = c.v; ctx.fill();
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ genetic drift */
  S.drift = function (el) {
    return K.mount(el, 'Genetic drift and selection simulator', 'Each line is one population followed for 100 generations. Allele A starts at the chosen frequency; each generation, alleles are sampled at random (drift), optionally with a fitness advantage for A (selection). Try a population of 10 vs 1000.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Allele frequency over generations for several populations' });
      const ctl = K.controls(body);
      const N = K.slider(ctl, { label: 'Population size (N)', min: 1, max: 3, step: 0.01, value: 20, toVal: v => Math.round(Math.pow(10, v)), fromVal: v => Math.log10(v), fmt: v => String(v), onInput: go });
      const P0 = K.slider(ctl, { label: 'Starting frequency of A', min: 0.05, max: 0.95, step: 0.05, value: 0.5, fmt: v => v.toFixed(2), onInput: go });
      const Sel = K.slider(ctl, { label: 'Selection advantage of A (s)', min: -0.1, max: 0.1, step: 0.01, value: 0, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2), onInput: go });
      const R = K.slider(ctl, { label: 'Number of populations', min: 1, max: 10, step: 1, value: 6, onInput: go });
      K.buttons(body, [{ label: 'Run again', primary: true, onClick: go }]);
      const ro = K.readout(body, [['fix', 'A fixed (frequency 1)'], ['lost', 'A lost (frequency 0)'], ['mean', 'Average final frequency of A']]);
      let runs = [];
      function sim(n, p, s) {
        const out = [p], m = 2 * n;
        for (let g = 0; g < 100; g++) {
          const pw = p * (1 + s) / (1 + p * s);
          let k = 0;
          if (m > 600) { const sd = Math.sqrt(m * pw * (1 - pw)); let u = 0, v = 0; while (u === 0) u = Math.random(); v = Math.random(); k = Math.round(m * pw + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); k = Math.max(0, Math.min(m, k)); }
          else for (let i = 0; i < m; i++) if (Math.random() < pw) k++;
          p = k / m; out.push(p);
        }
        return out;
      }
      function go() {
        const n = N.get(), p = P0.get(), s = Sel.get(), r = R.get();
        runs = []; for (let i = 0; i < r; i++) runs.push(sim(n, p, s));
        const fin = runs.map(x => x[x.length - 1]);
        ro.set('fix', fin.filter(v => v === 1).length + ' of ' + r); ro.set('lost', fin.filter(v => v === 0).length + ' of ' + r);
        ro.set('mean', f(fin.reduce((a, v) => a + v, 0) / r, 2));
        draw();
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const b = box(W, H, 44, 14, 14, 30);
        const M = K.axes(ctx, b, [0, 100], [0, 1], c, { x: 'generation', y: 'frequency of A' });
        const cols = [c.acc, c.w, c.n, c.v, c.t, c.f, c.good, c.bad, c.warn, c.ink2];
        runs.forEach((run, i) => { ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = 2; ctx.beginPath(); run.forEach((p, g) => g ? ctx.lineTo(M.X(g), M.Y(p)) : ctx.moveTo(M.X(g), M.Y(p))); ctx.stroke(); });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      go();
    });
  };
})();
