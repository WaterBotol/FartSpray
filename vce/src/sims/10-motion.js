/* Unit 3 AoS 1 simulations: pulley systems, banked track, rollercoaster loop,
   projectile launcher, collisions, bungee jump */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS, g = 9.8;
  const f2 = (x, d) => (Math.abs(x) < 1e-9 ? 0 : x).toFixed(d == null ? 2 : d);

  /* ------------------------------------------------------------------ connected bodies */
  S.pulley = function (el) {
    return K.mount(el, 'Connected bodies & tension', 'Choose a set-up, change the masses and friction, and watch the acceleration and tension respond. Arrows are drawn to scale.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Pulley system with force arrows' });
      const ctl = K.controls(body);
      const mode = K.select(ctl, { label: 'Set-up', value: 'table', options: [['table', 'Block on table + hanging mass'], ['atwood', 'Atwood machine'], ['incline', 'Block on slope + hanging mass']], onChange: upd });
      const m1 = K.slider(ctl, { label: 'Mass 1 (table / left / slope)', min: 0.5, max: 10, step: 0.1, value: 3, fmt: v => v.toFixed(1) + ' kg', onInput: upd });
      const m2 = K.slider(ctl, { label: 'Mass 2 (hanging / right)', min: 0.5, max: 10, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' kg', onInput: upd });
      const fr = K.slider(ctl, { label: 'Friction on mass 1', min: 0, max: 40, step: 0.5, value: 0, fmt: v => v.toFixed(1) + ' N', onInput: upd });
      const th = K.slider(ctl, { label: 'Slope angle', min: 5, max: 60, step: 1, value: 30, fmt: v => v + '°', onInput: upd });
      const ro = K.readout(body, [['a', 'Acceleration'], ['T', 'Tension'], ['w2', 'Weight of mass 2'], ['cmp', 'Tension vs hanging weight']]);
      const note = K.note(body);
      let sol = null, t = 0;

      function solve() {
        const M1 = m1.get(), M2 = m2.get(), F = fr.get(), md = mode.get(), a0 = th.get() * Math.PI / 180;
        let a = 0, T = 0, dir = 0, fric = 0, msg = '';
        if (md === 'table') {
          const drive = M2 * g;
          if (drive <= F) { a = 0; T = drive; fric = drive; msg = 'Static friction (' + f2(drive, 1) + ' N) holds the system at rest, so the tension equals the hanging weight.'; }
          else { a = (drive - F) / (M1 + M2); T = M2 * (g - a); dir = 1; fric = F; msg = 'System: a = (m₂g − friction) ÷ (m₁ + m₂). Then isolate the hanging mass: T = m₂(g − a), which is less than m₂g.'; }
        } else if (md === 'atwood') {
          a = Math.abs(M1 - M2) * g / (M1 + M2); T = 2 * M1 * M2 * g / (M1 + M2); dir = Math.sign(M1 - M2);
          msg = dir === 0 ? 'Equal masses: no acceleration, T = mg on both sides.' : 'a = (m_heavy − m_light)g ÷ (m₁ + m₂). The tension lies between the two weights.';
        } else {
          const d1 = M1 * g * Math.sin(a0), d2 = M2 * g;
          if (d2 - d1 > F) { a = (d2 - d1 - F) / (M1 + M2); T = M2 * (g - a); dir = 1; fric = F; msg = 'Hanging weight (' + f2(d2, 1) + ' N) beats m₁g sin θ (' + f2(d1, 1) + ' N) + friction: block moves up the slope.'; }
          else if (d1 - d2 > F) { a = (d1 - d2 - F) / (M1 + M2); T = M2 * (g + a); dir = -1; fric = F; msg = 'm₁g sin θ (' + f2(d1, 1) + ' N) beats the hanging weight + friction: block slides down, hanging mass rises, so T > m₂g.'; }
          else { a = 0; T = d2; fric = Math.abs(d2 - d1); msg = 'Forces along the slope are balanced by friction: at rest.'; }
        }
        return { M1, M2, F, md, th: a0, a, T, dir, fric, msg };
      }
      function upd() {
        const md = mode.get();
        fr.el.hidden = md === 'atwood';
        th.el.hidden = md !== 'incline';
        sol = solve(); t = 0;
        ro.set('a', f2(sol.a) + ' m s⁻²');
        ro.set('T', f2(sol.T) + ' N');
        ro.set('w2', f2(sol.M2 * g) + ' N');
        const d = sol.T - sol.M2 * g;
        ro.set('cmp', Math.abs(d) < 0.005 ? 'T = m₂g' : d < 0 ? 'T < m₂g' : 'T > m₂g', Math.abs(d) < 0.005 ? '' : 'warn');
        note.textContent = sol.msg;
        draw();
      }
      function block(ctx, x, y, w, h, label, c, ang) {
        ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang);
        ctx.fillStyle = c.s3; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
        K.text(ctx, label, 0, 4, { align: 'center', bold: true, size: 12, c });
        ctx.restore();
      }
      function draw() {
        if (!sol) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c); K.grid(ctx, W, H, 30, c);
        const tp = Math.max(0, t); const s = sol.dir === 0 ? 0 : (0.5 * sol.a * tp * tp) * 60 * sol.dir; // px displacement
        const maxF = Math.max(sol.M1 * g, sol.M2 * g, sol.T, 1);
        const sc = Math.min(W, H) * 0.3 / maxF;
        const bw = Math.min(70, W * 0.13), bh = bw * 0.62;
        if (sol.md === 'table') {
          const ty = H * 0.42, px = W * 0.66, r = 12;
          ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.04, ty); ctx.lineTo(px, ty); ctx.stroke();
          ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W * 0.08, ty); ctx.lineTo(W * 0.08, H * 0.95); ctx.moveTo(px - 20, ty); ctx.lineTo(px - 20, H * 0.95); ctx.stroke();
          const ax = K.clamp(W * 0.22 + s, W * 0.1, px - bw); const bx = px + r, by = K.clamp(ty + H * 0.18 + s, ty + 20, H * 0.9);
          ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ax + bw / 2, ty - bh / 2); ctx.lineTo(px, ty - bh / 2); ctx.arc(px, ty - bh / 2 + r, r, -Math.PI / 2, 0); ctx.lineTo(bx, by - bh / 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, ty - bh / 2 + r, r, 0, Math.PI * 2); ctx.fillStyle = c.s2; ctx.fill(); ctx.strokeStyle = c.ink; ctx.stroke();
          block(ctx, ax, ty - bh / 2, bw, bh, f2(sol.M1, 1) + ' kg', c);
          block(ctx, bx, by, bw * 0.8, bh, f2(sol.M2, 1) + ' kg', c);
          K.arrow(ctx, ax + bw / 2, ty - bh * 0.8, ax + bw / 2 + sol.T * sc, ty - bh * 0.8, c.t, 2.4);
          K.text(ctx, 'T', ax + bw / 2 + sol.T * sc + 4, ty - bh * 0.8 + 4, { color: c.t, bold: true, c });
          if (sol.fric > 0) { K.arrow(ctx, ax - bw / 2, ty - 6, ax - bw / 2 - sol.fric * sc, ty - 6, c.f, 2.4); K.text(ctx, 'friction', ax - bw / 2 - sol.fric * sc - 4, ty - 12, { color: c.f, align: 'right', size: 11, c }); }
          K.arrow(ctx, bx + bw * 0.55, by - bh / 2, bx + bw * 0.55, by - bh / 2 - sol.T * sc, c.t, 2.4);
          K.text(ctx, 'T', bx + bw * 0.55 + 6, by - bh / 2 - sol.T * sc + 10, { color: c.t, bold: true, c });
          K.arrow(ctx, bx, by + bh / 2, bx, by + bh / 2 + sol.M2 * g * sc, c.w, 2.4);
          K.text(ctx, 'm₂g', bx + 6, by + bh / 2 + sol.M2 * g * sc, { color: c.w, bold: true, c });
          if (sol.dir) { K.arrow(ctx, ax - 20, ty - bh - 14, ax + 20, ty - bh - 14, c.net, 2); K.text(ctx, 'a', ax + 24, ty - bh - 10, { color: c.net, bold: true, c }); }
          if (by + bh / 2 >= H * 0.9 - 1 || ax >= px - bw - 1) t = -0.6;
        } else if (sol.md === 'atwood') {
          const px = W * 0.5, py = H * 0.14, r = Math.min(40, W * 0.07);
          ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(px - 60, py - r - 6); ctx.lineTo(px + 60, py - r - 6); ctx.stroke();
          const l0 = H * 0.42;
          const yL = K.clamp(py + l0 + s, py + r + 20, H * 0.88), yR = K.clamp(py + l0 - s, py + r + 20, H * 0.88);
          ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px - r, py); ctx.lineTo(px - r, yL - bh / 2); ctx.moveTo(px + r, py); ctx.lineTo(px + r, yR - bh / 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = c.s2; ctx.fill(); ctx.strokeStyle = c.ink; ctx.stroke();
          block(ctx, px - r, yL, bw * 0.8, bh, f2(sol.M1, 1) + ' kg', c);
          block(ctx, px + r, yR, bw * 0.8, bh, f2(sol.M2, 1) + ' kg', c);
          [[px - r, yL, sol.M1], [px + r, yR, sol.M2]].forEach(([x, y, m], i) => {
            const off = i ? bw * 0.55 : -bw * 0.55;
            K.arrow(ctx, x + off, y - bh / 2, x + off, y - bh / 2 - sol.T * sc, c.t, 2.4);
            K.arrow(ctx, x, y + bh / 2, x, y + bh / 2 + m * g * sc, c.w, 2.4);
            K.text(ctx, (i ? 'm₂g' : 'm₁g'), x + 6, y + bh / 2 + m * g * sc, { color: c.w, bold: true, c });
          });
          K.text(ctx, 'T', px - r - bw * 0.55 - 14, yL - bh / 2 - sol.T * sc + 12, { color: c.t, bold: true, c });
          if (sol.dir) {
            const xh = sol.dir > 0 ? px - r - bw : px + r + bw;
            K.arrow(ctx, xh, H * 0.5 - 20, xh, H * 0.5 + 20, c.net, 2); K.text(ctx, 'a', xh + 6, H * 0.5 + 24, { color: c.net, bold: true, c });
          }
          if (Math.max(yL, yR) >= H * 0.88 - 1 || Math.min(yL, yR) <= py + r + 21) t = -0.6;
        } else {
          const ang = sol.th, baseY = H * 0.86, x0 = W * 0.06;
          let L = Math.min(W * 0.6, (H * 0.7) / Math.max(Math.sin(ang), 0.1));
          const topX = x0 + L * Math.cos(ang), topY = baseY - L * Math.sin(ang);
          ctx.fillStyle = c.s2; ctx.beginPath(); ctx.moveTo(x0, baseY); ctx.lineTo(topX, baseY); ctx.lineTo(topX, topY); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = c.ink; ctx.lineWidth = 1.6; ctx.stroke();
          const r = 11, pxx = topX + 4, pyy = topY - 6;
          const d = K.clamp(L * 0.5 - s, bw, L - bw * 0.8); // distance from bottom along slope
          const cx = x0 + d * Math.cos(ang) - Math.sin(ang) * bh / 2, cy = baseY - d * Math.sin(ang) - Math.cos(ang) * bh / 2;
          const hy = K.clamp(topY + H * 0.25 + s, topY + 30, baseY - bh / 2);
          const ux = Math.cos(ang), uy = -Math.sin(ang); // up-slope unit (screen)
          ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(cx + ux * bw / 2, cy + uy * bw / 2); ctx.lineTo(pxx - 2, pyy - r + 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(pxx + r, pyy); ctx.lineTo(pxx + r, hy - bh / 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(pxx, pyy, r, 0, Math.PI * 2); ctx.fillStyle = c.s2; ctx.fill(); ctx.strokeStyle = c.ink; ctx.stroke();
          block(ctx, cx, cy, bw, bh, f2(sol.M1, 1) + ' kg', c, -ang);
          block(ctx, pxx + r, hy, bw * 0.75, bh, f2(sol.M2, 1) + ' kg', c);
          K.arrow(ctx, cx, cy, cx + ux * sol.T * sc, cy + uy * sol.T * sc, c.t, 2.4);
          K.text(ctx, 'T', cx + ux * sol.T * sc + 4, cy + uy * sol.T * sc - 4, { color: c.t, bold: true, c });
          K.arrow(ctx, cx, cy, cx, cy + sol.M1 * g * sc, c.w, 2.4);
          K.text(ctx, 'm₁g', cx + 5, cy + sol.M1 * g * sc, { color: c.w, bold: true, c });
          if (sol.fric > 0) {
            const fd = sol.dir >= 0 ? -1 : 1;
            K.arrow(ctx, cx - Math.sin(ang) * 10, cy - Math.cos(ang) * 10, cx - Math.sin(ang) * 10 + fd * ux * sol.fric * sc, cy - Math.cos(ang) * 10 + fd * uy * sol.fric * sc, c.f, 2.2);
          }
          const hx = pxx + r;
          K.arrow(ctx, hx + bw * 0.5, hy - bh / 2, hx + bw * 0.5, hy - bh / 2 - sol.T * sc, c.t, 2.4);
          K.arrow(ctx, hx, hy + bh / 2, hx, hy + bh / 2 + sol.M2 * g * sc * 0.7, c.w, 2.4);
          K.text(ctx, 'm₂g', hx + 6, hy + bh / 2 + sol.M2 * g * sc * 0.7, { color: c.w, bold: true, c });
          if (hy >= baseY - bh / 2 - 1 || hy <= topY + 31 || d <= bw + 1 || d >= L - bw * 0.8 - 1) t = -0.6;
        }
      }
      add(K.loop(dt => { if (!sol) return; t += dt; if (t > 4) t = 0; draw(); }, cv.wrap));
      cv.draw = draw;
      add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ banked track */
  S.banked = function (el) {
    return K.mount(el, 'Banked track explorer', 'A 1000 kg car on a banked curve. Change the speed and see which way friction must act. At the design speed the friction arrow disappears.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 360, label: 'Banked track cross-section with force diagram' });
      const ctl = K.controls(body);
      const R = K.slider(ctl, { label: 'Radius of curve', min: 20, max: 300, step: 5, value: 80, fmt: v => v + ' m', onInput: upd });
      const A = K.slider(ctl, { label: 'Bank angle', min: 0, max: 45, step: 1, value: 15, fmt: v => v + '°', onInput: upd });
      const V = K.slider(ctl, { label: 'Speed', min: 0, max: 50, step: 0.5, value: 20, fmt: v => v.toFixed(1) + ' m s⁻¹ (' + Math.round(v * 3.6) + ' km h⁻¹)', onInput: upd });
      K.buttons(ctl, [{ label: 'Go to design speed', onClick: () => { const v = Math.sqrt(R.get() * g * Math.tan(A.get() * Math.PI / 180)); V.set(Math.round(v * 2) / 2); upd(); } }]);
      const ro = K.readout(body, [['vd', 'Design speed'], ['fc', 'Net force needed (mv²/r)'], ['N', 'Normal force'], ['f', 'Friction needed'], ['mu', 'Min. friction coefficient']]);
      const note = K.note(body);
      const m = 1000;
      let st = {};
      function upd() {
        const r = R.get(), th = A.get() * Math.PI / 180, v = V.get();
        const fc = m * v * v / r;
        const N = m * g * Math.cos(th) + fc * Math.sin(th);
        const f = fc * Math.cos(th) - m * g * Math.sin(th); // + = down the slope
        const vd = Math.sqrt(r * g * Math.tan(th));
        st = { r, th, v, fc, N, f, vd };
        ro.set('vd', f2(vd, 1) + ' m s⁻¹');
        ro.set('fc', K.sig(fc, 3) + ' N');
        ro.set('N', K.sig(N, 3) + ' N');
        const af = Math.abs(f);
        ro.set('f', af < 1 ? '0 N' : K.sig(af, 3) + ' N ' + (f > 0 ? 'down slope' : 'up slope'), af < 1 ? 'good' : 'warn');
        ro.set('mu', N > 0 ? f2(af / N, 2) : '–');
        if (af < 1) note.textContent = 'At the design speed the horizontal component of the normal force supplies all of the centripetal force: no friction needed.';
        else if (f > 0) note.textContent = 'Faster than the design speed: the car tends to slide up and out, so friction acts DOWN the slope to add to the inward force.';
        else note.textContent = v < 0.5 ? 'Parked: friction up the slope stops the car sliding down.' : 'Slower than the design speed: the car tends to slide down the bank, so friction acts UP the slope.';
        draw();
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const th = st.th;
        // scene (left half)
        const x0 = W * 0.04, y0 = H * 0.8, len = W * 0.44;
        const x1 = x0 + len * Math.cos(th), y1 = y0 - len * Math.sin(th);
        ctx.fillStyle = c.s2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        const mx = x0 + len * 0.5 * Math.cos(th), my = y0 - len * 0.5 * Math.sin(th);
        ctx.save(); ctx.translate(mx, my); ctx.rotate(-th);
        ctx.fillStyle = c.acc; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-30, -22, 60, 18, 5) : ctx.rect(-30, -22, 60, 18); ctx.fill();
        ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(-17, -3, 5, 0, 7); ctx.arc(17, -3, 5, 0, 7); ctx.fill();
        ctx.restore();
        K.arrow(ctx, x0 + 80, H * 0.93, x0 + 10, H * 0.93, c.acc, 2);
        K.text(ctx, 'centre of curve', x0 + 86, H * 0.93 + 4, { color: c.acc, size: 11.5, bold: true, c });
        K.text(ctx, 'θ = ' + A.get() + '°', x0 + 34, y0 - 6, { color: c.muted, size: 11.5, c });
        // FBD (right half)
        const cx = W * 0.74, cy = H * 0.5;
        const maxF = Math.max(m * g, st.N, Math.abs(st.f), st.fc, 1);
        const sc = Math.min(W * 0.22, H * 0.4) / maxF;
        ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
        const nx = -Math.sin(th), ny = -Math.cos(th);
        K.arrow(ctx, cx, cy, cx + nx * st.N * sc, cy + ny * st.N * sc, c.n, 2.6);
        K.text(ctx, 'N', cx + nx * st.N * sc - 14, cy + ny * st.N * sc, { color: c.n, bold: true, c });
        K.arrow(ctx, cx, cy, cx, cy + m * g * sc, c.w, 2.6);
        K.text(ctx, 'mg', cx + 6, cy + m * g * sc, { color: c.w, bold: true, c });
        if (Math.abs(st.f) >= 1) {
          const dx = -Math.cos(th), dy = Math.sin(th); // down-slope direction
          const sgn = st.f > 0 ? 1 : -1;
          K.arrow(ctx, cx, cy, cx + dx * sgn * Math.abs(st.f) * sc, cy + dy * sgn * Math.abs(st.f) * sc, c.f, 2.6);
          K.text(ctx, 'friction', cx + dx * sgn * Math.abs(st.f) * sc + (sgn > 0 ? -50 : 6), cy + dy * sgn * Math.abs(st.f) * sc + 14, { color: c.f, bold: true, size: 11.5, c });
        }
        ctx.setLineDash([6, 4]);
        K.arrow(ctx, cx, cy + 3, cx - st.fc * sc, cy + 3, c.net, 2.2);
        ctx.setLineDash([]);
        if (st.fc * sc > 20) K.text(ctx, 'F net (horizontal)', cx - st.fc * sc, cy + 20, { color: c.net, bold: true, size: 11.5, c });
        K.text(ctx, 'Free-body diagram (to scale)', cx, H * 0.08, { align: 'center', color: c.muted, size: 11.5, c });
      }
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ rollercoaster loop */
  S.loop = function (el) {
    return K.mount(el, 'Rollercoaster loop simulator', 'A frictionless cart starts from rest at height h, runs along a flat section and enters a circular loop of radius r. Find the release height where it just makes it (hint: 2.5r).', ({ body, add }) => {
      const cv = K.canvas(body, 0.52, { maxH: 400, label: 'Rollercoaster ramp and loop with a moving cart' });
      const ctl = K.controls(body);
      const Hh = K.slider(ctl, { label: 'Release height h', min: 4, max: 60, step: 0.5, value: 30, fmt: v => v.toFixed(1) + ' m', onInput: upd });
      const Rr = K.slider(ctl, { label: 'Loop radius r', min: 3, max: 20, step: 0.5, value: 10, fmt: v => v.toFixed(1) + ' m', onInput: upd });
      const Mm = K.slider(ctl, { label: 'Rider mass', min: 30, max: 120, step: 1, value: 60, fmt: v => v + ' kg', onInput: upd });
      K.buttons(ctl, [{ label: 'Set h = 2.5r (minimum)', onClick: () => { Hh.set(Math.min(60, Rr.get() * 2.5)); upd(); } }, { label: 'Replay', onClick: () => restart() }]);
      const ro = K.readout(body, [['vb', 'Speed at bottom'], ['vt', 'Speed at top'], ['vmin', 'Min. speed at top √(gr)'], ['hmin', 'Min. release height'], ['Nb', 'Seat force at bottom'], ['Nt', 'Seat force at top']]);
      const note = K.note(body);
      let P = null, st = null;

      function analyse() {
        const h = Hh.get(), r = Rr.get(), m = Mm.get();
        let outcome = 'complete', thEnd = 2 * Math.PI;
        for (let th = 0; th <= Math.PI; th += 0.002) {
          const y = r * (1 - Math.cos(th));
          const vv = 2 * g * (h - y);
          if (vv <= 0) { outcome = 'rollback'; thEnd = th; break; }
          if (vv / r + g * Math.cos(th) <= 0) { outcome = 'leaves'; thEnd = th; break; }
        }
        const xr = Math.max(h * 0.9, 6), Lf = r + 4;
        return { h, r, m, outcome, thEnd, xr, Lf, Lr: Math.hypot(xr, h), xb: xr + Lf };
      }
      function upd() {
        P = analyse();
        const { h, r, m } = P;
        const vb = Math.sqrt(2 * g * h), vt2 = 2 * g * (h - 2 * r), vmin = Math.sqrt(g * r);
        ro.set('vb', f2(vb, 1) + ' m s⁻¹');
        ro.set('vmin', f2(vmin, 1) + ' m s⁻¹');
        ro.set('hmin', f2(2.5 * r, 1) + ' m');
        const Nb = m * (g + vb * vb / r);
        ro.set('Nb', K.sig(Nb, 3) + ' N (' + f2(Nb / (m * g), 1) + ' g)');
        if (P.outcome === 'complete') {
          const Nt = m * (vt2 / r - g);
          ro.set('vt', f2(Math.sqrt(vt2), 1) + ' m s⁻¹', 'good');
          ro.set('Nt', K.sig(Nt, 3) + ' N (' + f2(Nt / (m * g), 2) + ' g)', 'good');
          note.className = 'sim-note';
          note.textContent = Math.abs(h - 2.5 * r) < 0.3 ? 'Just makes it: at the top the seat force is (almost) zero and the rider feels weightless. Gravity alone provides the centripetal force.' : 'Completes the loop. At the top: N + mg = mv²/r. At the bottom: N − mg = mv²/r. Energy conservation gives both speeds (the top is 2r high).';
        } else {
          ro.set('vt', 'never reaches top', 'bad');
          ro.set('Nt', '–', 'bad');
          note.className = 'sim-note bad';
          const deg = Math.round(P.thEnd * 180 / Math.PI);
          note.textContent = P.outcome === 'leaves'
            ? 'Fails: the normal force drops to zero ' + deg + '° around the loop (measured from the bottom), so the cart leaves the track and falls. It needs h ≥ 2.5r = ' + f2(2.5 * r, 1) + ' m.'
            : 'Fails: the cart runs out of speed in the lower half of the loop and rolls back. It needs h ≥ 2.5r = ' + f2(2.5 * r, 1) + ' m.';
        }
        restart();
      }
      function restart() { st = { phase: 'ramp', s: 0, dir: 1, th: 0, x: 0, y: P.h, vx: 0, vy: 0, t: 0, pause: 0 }; }
      function pathPoint() {
        const { h, r, xr, xb, Lr } = P;
        if (st.phase === 'ramp') { const f = st.s / Lr; return { x: xr * f, y: h * (1 - f), ang: -Math.atan2(h, xr) }; }
        if (st.phase === 'flat') return { x: xr + st.s, y: 0, ang: 0 };
        if (st.phase === 'loop') return { x: xb + r * Math.sin(st.th), y: r - r * Math.cos(st.th), ang: st.th };
        if (st.phase === 'exit') return { x: xb + st.s, y: 0, ang: 0 };
        return { x: st.x, y: st.y, ang: Math.atan2(st.vy, st.vx) };
      }
      function step(dt) {
        if (!P) return;
        const { h, r, xb, Lr, Lf } = P;
        if (st.pause > 0) { st.pause -= dt; if (st.pause <= 0) restart(); return; }
        const speed = y => Math.sqrt(Math.max(0.25, 2 * g * (h - y)));
        const n = 8, d = dt / n;
        for (let i = 0; i < n; i++) {
          if (st.phase === 'ramp') {
            st.s += st.dir * speed(h * (1 - st.s / Lr)) * d;
            if (st.dir < 0 && st.s <= 0) { st.pause = 1.2; st.s = 0; return; }
            if (st.dir > 0 && st.s >= Lr) { st.phase = 'flat'; st.s = 0; }
          } else if (st.phase === 'flat') {
            st.s += st.dir * speed(0) * d;
            if (st.dir > 0 && st.s >= Lf) { st.phase = 'loop'; st.th = 0; }
            if (st.dir < 0 && st.s <= 0) { st.phase = 'ramp'; st.s = Lr; }
          } else if (st.phase === 'loop') {
            const y = r - r * Math.cos(st.th);
            if (P.outcome === 'leaves' && st.th >= P.thEnd) {
              const v = Math.sqrt(Math.max(2 * g * (h - y), 0));
              st.phase = 'fly'; st.x = xb + r * Math.sin(st.th); st.y = y; st.vx = v * Math.cos(st.th); st.vy = v * Math.sin(st.th); st.t = 0;
              break;
            }
            if (P.outcome === 'rollback' && st.dir > 0 && st.th >= P.thEnd - 0.01) st.dir = -1;
            st.th += st.dir * speed(y) * d / r;
            if (st.dir < 0 && st.th <= 0) { st.phase = 'flat'; st.s = Lf; }
            if (st.th >= 2 * Math.PI) { st.phase = 'exit'; st.s = 0; }
          } else if (st.phase === 'exit') {
            st.s += speed(0) * d;
            if (st.s > r + 12) { st.pause = 0.8; return; }
          } else if (st.phase === 'fly') {
            st.vy -= g * d; st.x += st.vx * d; st.y += st.vy * d; st.t += d;
            if (st.y <= 0 || st.t > 4) { st.pause = 1.2; return; }
          }
        }
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const { h, r, xr, xb } = P;
        const minX = -2, maxX = xb + r + 14, maxY = Math.max(h, 2 * r) + 3;
        const sc = Math.min((W - 30) / (maxX - minX), (H - 40) / maxY);
        const X = x => 15 + (x - minX) * sc, Y = y => H - 22 - y * sc;
        ctx.strokeStyle = c.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = c.muted;
        ctx.beginPath(); ctx.moveTo(X(minX), Y(h)); ctx.lineTo(X(xb + r), Y(h)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X(xb - r - 1), Y(2 * r)); ctx.lineTo(X(xb + r + 6), Y(2 * r)); ctx.stroke();
        ctx.setLineDash([]);
        K.text(ctx, 'h = ' + f2(h, 1) + ' m', X(minX) + 4, Y(h) - 5, { color: c.muted, size: 11.5, c });
        K.text(ctx, 'top of loop = 2r = ' + f2(2 * r, 1) + ' m', X(xb + r + 1), Y(2 * r) - 5, { color: c.muted, size: 11.5, c });
        ctx.strokeStyle = c.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(X(0), Y(h)); ctx.lineTo(X(xr), Y(0)); ctx.lineTo(X(xb + r + 14), Y(0)); ctx.stroke();
        ctx.beginPath(); ctx.arc(X(xb), Y(r), r * sc, 0, Math.PI * 2); ctx.stroke();
        ctx.lineCap = 'butt';
        if (P.outcome === 'leaves') {
          const lx = X(xb + r * Math.sin(P.thEnd)), ly = Y(r - r * Math.cos(P.thEnd));
          ctx.fillStyle = c.bad; ctx.beginPath(); ctx.arc(lx, ly, 5, 0, 7); ctx.fill();
          K.text(ctx, 'leaves track', lx + 8, ly - 6, { color: c.bad, bold: true, size: 11.5, c });
        }
        const p = pathPoint();
        const px = X(p.x), py = Y(p.y);
        ctx.save(); ctx.translate(px, py); ctx.rotate(-p.ang);
        ctx.fillStyle = st.phase === 'fly' ? c.bad : c.acc;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-12, -14, 24, 12, 4) : ctx.rect(-12, -14, 24, 12); ctx.fill();
        ctx.restore();
        if (st.phase !== 'fly') {
          const v = Math.sqrt(Math.max(0, 2 * g * (h - p.y)));
          K.text(ctx, 'v = ' + f2(v, 1) + ' m s⁻¹', W - 12, 18, { align: 'right', mono: true, size: 12, c });
        }
      }
      add(K.loop(dt => { step(dt); draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ projectile launcher */
  S.projectile = function (el) {
    return K.mount(el, 'Projectile launcher', 'Set the launch speed, angle and height. Toggle air resistance to compare the real path (solid) with the ideal parabola (dashed). Arrows show the velocity components.', ({ body, add }) => {
      const cv = K.canvas(body, 0.5, { maxH: 380, label: 'Projectile trajectory with velocity components' });
      const ctl = K.controls(body);
      const U = K.slider(ctl, { label: 'Launch speed', min: 5, max: 40, step: 0.5, value: 20, fmt: v => v.toFixed(1) + ' m s⁻¹', onInput: upd });
      const A = K.slider(ctl, { label: 'Launch angle', min: 0, max: 90, step: 1, value: 40, fmt: v => v + '°', onInput: upd });
      const Hh = K.slider(ctl, { label: 'Launch height', min: 0, max: 50, step: 0.5, value: 0, fmt: v => v.toFixed(1) + ' m', onInput: upd });
      const D = K.check(ctl, { label: 'Air resistance', value: false, onChange: upd });
      K.buttons(ctl, [{ label: 'Launch again', primary: true, onClick: () => { tt = 0; } }]);
      const ro = K.readout(body, [['T', 'Time of flight'], ['R', 'Range'], ['Hm', 'Max height (above ground)'], ['vi', 'Impact velocity'], ['best', 'Best angle (no drag, this height)'], ['drag', 'Range with drag']]);
      let P = null, tt = 0;
      const kd = 0.006; // drag constant per metre (a = k v²)
      function ideal(u, th, h) {
        const ux = u * Math.cos(th), uy = u * Math.sin(th);
        const T = (uy + Math.sqrt(uy * uy + 2 * g * h)) / g;
        return { ux, uy, T, R: ux * T, Hm: h + uy * uy / (2 * g) * (uy > 0 ? 1 : 0), pos: t => [ux * t, h + uy * t - 0.5 * g * t * t], vel: t => [ux, uy - g * t] };
      }
      function dragPath(u, th, h) {
        let x = 0, y = h, vx = u * Math.cos(th), vy = u * Math.sin(th), t = 0; const pts = [[0, h, vx, vy]]; let Hm = h;
        const dt = 0.004;
        while (y >= 0 && t < 30) {
          const v = Math.hypot(vx, vy);
          vx += -kd * v * vx * dt; vy += (-g - kd * v * vy) * dt;
          x += vx * dt; y += vy * dt; t += dt; Hm = Math.max(Hm, y);
          pts.push([x, Math.max(y, 0), vx, vy]);
        }
        return { pts, T: t, R: x, Hm, dt };
      }
      function upd() {
        const u = U.get(), th = A.get() * Math.PI / 180, h = Hh.get();
        const I = ideal(u, th, h);
        let best = 0, bestR = -1;
        for (let a = 0; a <= 90; a += 0.5) { const r = ideal(u, a * Math.PI / 180, h).R; if (r > bestR) { bestR = r; best = a; } }
        const Dp = D.get() ? dragPath(u, th, h) : null;
        P = { u, th, h, I, Dp, best };
        const vf = I.vel(I.T), vmag = Math.hypot(vf[0], vf[1]);
        ro.set('T', f2(I.T) + ' s');
        ro.set('R', f2(I.R, 1) + ' m');
        ro.set('Hm', f2(I.Hm, 1) + ' m');
        ro.set('vi', f2(vmag, 1) + ' m s⁻¹ at ' + Math.round(Math.abs(Math.atan2(vf[1], vf[0]) * 180 / Math.PI)) + '° below');
        ro.set('best', best.toFixed(1) + '°');
        ro.set('drag', Dp ? f2(Dp.R, 1) + ' m (' + Math.round(100 * (1 - Dp.R / I.R)) + '% less)' : 'switch on to compare', Dp ? 'warn' : '');
        tt = 0; draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const xr = [0, Math.max(P.I.R, 5) * 1.08], yr = [0, Math.max(P.I.Hm, 2) * 1.15];
        // keep aspect roughly true to scale
        const box = { x: 46, y: 18, w: W - 60, h: H - 56 };
        const sx = box.w / (xr[1] - xr[0]), sy = box.h / (yr[1] - yr[0]);
        const s = Math.min(sx, sy);
        xr[1] = box.w / s; yr[1] = box.h / s;
        const { X, Y } = K.axes(ctx, box, xr, yr, c, { x: 'horizontal distance (m)', y: 'height (m)' });
        // ideal path
        ctx.setLineDash(P.Dp ? [6, 5] : []); ctx.strokeStyle = P.Dp ? c.muted : c.acc; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) { const t = P.I.T * i / 120; const [x, y] = P.I.pos(t); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }
        ctx.stroke(); ctx.setLineDash([]);
        if (P.Dp) {
          ctx.strokeStyle = c.acc; ctx.lineWidth = 2.2; ctx.beginPath();
          P.Dp.pts.forEach((p, i) => { if (i % 5) return; i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); });
          ctx.stroke();
        }
        // max height marker
        const tTop = Math.max(0, P.I.uy / g); const top = P.I.pos(tTop);
        if (P.I.uy > 0) { ctx.fillStyle = c.muted; ctx.beginPath(); ctx.arc(X(top[0]), Y(top[1]), 3, 0, 7); ctx.fill(); K.text(ctx, 'vy = 0', X(top[0]) + 6, Y(top[1]) - 6, { color: c.muted, size: 11, c }); }
        // ball
        let bx, by, vx, vy;
        if (P.Dp) {
          const i = Math.min(P.Dp.pts.length - 1, Math.floor(tt / P.Dp.dt)); const p = P.Dp.pts[i]; [bx, by, vx, vy] = p;
        } else { const t = Math.min(tt, P.I.T); [bx, by] = P.I.pos(t); [vx, vy] = P.I.vel(t); }
        const k = 2.2;
        K.arrow(ctx, X(bx), Y(by), X(bx) + vx * k, Y(by), c.v, 2.2);
        K.arrow(ctx, X(bx), Y(by), X(bx), Y(by) - vy * k, c.n, 2.2);
        ctx.fillStyle = c.w; ctx.beginPath(); ctx.arc(X(bx), Y(by), 6, 0, 7); ctx.fill();
        K.text(ctx, 'vx', X(bx) + vx * k + 4, Y(by) + 4, { color: c.v, bold: true, size: 11.5, c });
        K.text(ctx, 'vy', X(bx) + 6, Y(by) - vy * k, { color: c.n, bold: true, size: 11.5, c });
      }
      add(K.loop(dt => { if (!P) return; tt += dt; const T = P.Dp ? P.Dp.T : P.I.T; if (tt > T + 1.2) tt = 0; draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ 1D collisions */
  S.collision = function (el) {
    return K.mount(el, 'Collision lab', 'Two carts on a frictionless track. Set their masses and velocities (right is positive) and the elasticity. 1 = perfectly elastic, 0 = they stick together.', ({ body, add }) => {
      const cv = K.canvas(body, 0.28, { maxH: 220, minH: 150, label: 'Two carts colliding on a track' });
      const ctl = K.controls(body);
      const m1 = K.slider(ctl, { label: 'Mass of cart A', min: 0.5, max: 5, step: 0.1, value: 2, fmt: v => v.toFixed(1) + ' kg', onInput: upd });
      const u1 = K.slider(ctl, { label: 'Velocity of A', min: -6, max: 6, step: 0.1, value: 3, fmt: v => v.toFixed(1) + ' m s⁻¹', onInput: upd });
      const m2 = K.slider(ctl, { label: 'Mass of cart B', min: 0.5, max: 5, step: 0.1, value: 1, fmt: v => v.toFixed(1) + ' kg', onInput: upd });
      const u2 = K.slider(ctl, { label: 'Velocity of B', min: -6, max: 6, step: 0.1, value: 0, fmt: v => v.toFixed(1) + ' m s⁻¹', onInput: upd });
      const e = K.slider(ctl, { label: 'Elasticity (restitution)', min: 0, max: 1, step: 0.05, value: 0, fmt: v => v.toFixed(2), onInput: upd });
      const ro = K.readout(body, [['v', 'Velocities after'], ['p', 'Momentum before → after'], ['k', 'Kinetic energy before → after'], ['lost', 'Kinetic energy transformed'], ['type', 'Collision type']]);
      const note = K.note(body);
      let P = null, t = 0;
      function upd() {
        const M1 = m1.get(), M2 = m2.get(), U1 = u1.get(), U2 = u2.get(), E = e.get();
        const collide = U1 > U2;
        const pT = M1 * U1 + M2 * U2;
        let V1 = U1, V2 = U2;
        if (collide) { V1 = (pT - M2 * E * (U1 - U2)) / (M1 + M2); V2 = (pT + M1 * E * (U1 - U2)) / (M1 + M2); }
        const kb = 0.5 * M1 * U1 * U1 + 0.5 * M2 * U2 * U2, ka = 0.5 * M1 * V1 * V1 + 0.5 * M2 * V2 * V2;
        P = { M1, M2, U1, U2, V1, V2, collide, gap0: 3.0 };
        ro.set('v', 'A: ' + f2(V1) + ', B: ' + f2(V2) + ' m s⁻¹');
        ro.set('p', f2(pT) + ' → ' + f2(M1 * V1 + M2 * V2) + ' kg m s⁻¹', 'good');
        ro.set('k', f2(kb) + ' → ' + f2(ka) + ' J');
        ro.set('lost', f2(kb - ka) + ' J', kb - ka > 0.005 ? 'warn' : 'good');
        ro.set('type', !collide ? 'no collision' : E >= 0.999 ? 'elastic' : E <= 0.001 ? 'perfectly inelastic (stick)' : 'inelastic');
        note.textContent = !collide ? 'A is not catching B (A must be moving faster to the right than B), so they never collide. Change the velocities.' :
          'Momentum is conserved in every case (' + f2(pT) + ' kg m s⁻¹). Kinetic energy is only conserved when the elasticity is 1.';
        t = 0; draw();
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const ty = H * 0.72, sc = W / 12; // px per m, track 12 m
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
        const wA = 30 + P.M1 * 10, wB = 30 + P.M2 * 10, h = 34;
        // positions (m): A starts at 3, B at 3 + gap
        let xa = 4.5, xb = 4.5 + P.gap0 + (wA + wB) / 2 / sc;
        let tc = P.collide ? (xb - xa - (wA + wB) / 2 / sc) / (P.U1 - P.U2) : Infinity;
        let pa, pb;
        const tcl = Math.max(0, tc);
        if (t < tcl) { pa = xa + P.U1 * t; pb = xb + P.U2 * t; }
        else { pa = xa + P.U1 * tcl + P.V1 * (t - tcl); pb = xb + P.U2 * tcl + P.V2 * (t - tcl); }
        const wrap = x => ((x % 12) + 12) % 12;
        [[pa, wA, 'A', P.M1, t < tcl ? P.U1 : P.V1, c.acc], [pb, wB, 'B', P.M2, t < tcl ? P.U2 : P.V2, c.t]].forEach(([x, w, lab, m, v, col]) => {
          const px = wrap(x) * sc;
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px - w / 2, ty - h - 6, w, h, 5) : ctx.rect(px - w / 2, ty - h - 6, w, h); ctx.fill();
          ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(px - w / 3, ty - 4, 4, 0, 7); ctx.arc(px + w / 3, ty - 4, 4, 0, 7); ctx.fill();
          K.text(ctx, lab + ' ' + m.toFixed(1) + ' kg', px, ty - h / 2 - 2, { align: 'center', bold: true, size: 11.5, color: '#fff', c });
          if (Math.abs(v) > 0.05) K.arrow(ctx, px, ty - h - 16, px + v * 10, ty - h - 16, c.ink, 2);
          K.text(ctx, f2(v, 1) + ' m s⁻¹', px, ty - h - 24, { align: 'center', size: 11, mono: true, c });
        });
        K.text(ctx, t < tcl ? 'before' : 'after', 10, 18, { color: c.muted, size: 12, bold: true, c });
      }
      add(K.loop(dt => { if (!P) return; t += dt; if (t > 5) t = 0; draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ bungee jump */
  S.bungee = function (el) {
    return K.mount(el, 'Bungee jump energy', 'Watch the energy move between gravitational, kinetic and strain as the jumper falls. The bars always add to the same total (no losses).', ({ body, add }) => {
      const cv = K.canvas(body, 0.56, { maxH: 420, label: 'Bungee jumper with energy bar chart' });
      const ctl = K.controls(body);
      const M = K.slider(ctl, { label: 'Jumper mass', min: 40, max: 120, step: 1, value: 60, fmt: v => v + ' kg', onInput: upd });
      const L = K.slider(ctl, { label: 'Cord natural length', min: 5, max: 30, step: 0.5, value: 20, fmt: v => v.toFixed(1) + ' m', onInput: upd });
      const Kk = K.slider(ctl, { label: 'Cord spring constant', min: 40, max: 400, step: 5, value: 150, fmt: v => v + ' N m⁻¹', onInput: upd });
      const ro = K.readout(body, [['vt', 'Speed when cord goes taut'], ['x', 'Max extension'], ['D', 'Lowest point (below platform)'], ['vm', 'Max speed (at equilibrium)'], ['am', 'Max acceleration (at bottom)']]);
      let P = null, y = 0, v = 0, t = 0;
      function upd() {
        const m = M.get(), l = L.get(), k = Kk.get(), W = m * g;
        const a = k / 2, b = -W, cc = -W * l;
        const x = (-b + Math.sqrt(b * b - 4 * a * cc)) / (2 * a);
        const D = l + x, xe = W / k;
        const vm = Math.sqrt(2 * (W * (l + xe) - 0.5 * k * xe * xe) / m);
        P = { m, l, k, x, D, xe, vm, Etot: W * D };
        ro.set('vt', f2(Math.sqrt(2 * g * l), 1) + ' m s⁻¹');
        ro.set('x', f2(x, 1) + ' m');
        ro.set('D', f2(D, 1) + ' m');
        ro.set('vm', f2(vm, 1) + ' m s⁻¹ at ' + f2(l + xe, 1) + ' m');
        ro.set('am', f2((k * x - W) / m, 1) + ' m s⁻² up (' + f2((k * x - W) / (m * g), 1) + ' g)');
        y = 0; v = 0; t = 0; draw();
      }
      function stepPhys(dt) {
        const n = 20, d = dt / n;
        for (let i = 0; i < n; i++) {
          const ext = Math.max(0, y - P.l);
          const a = g - (P.k / P.m) * ext;
          v += a * d; y += v * d;
          if (y < 0) { y = 0; v = Math.abs(v) * 0; }
        }
      }
      function draw() {
        if (!P) return;
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const sceneW = W * 0.5, top = 26, sc = (H - top - 20) / (P.D * 1.05);
        const px = sceneW * 0.5;
        ctx.fillStyle = c.s3; ctx.fillRect(px - 50, top - 10, 60, 10);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.strokeRect(px - 50, top - 10, 60, 10);
        // markers
        const mk = (d, label, col) => { const yy = top + d * sc; ctx.setLineDash([4, 4]); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(px - 60, yy); ctx.lineTo(px + 70, yy); ctx.stroke(); ctx.setLineDash([]); K.text(ctx, label, px + 74, yy + 4, { color: col, size: 11, c }); };
        mk(P.l, 'taut (' + f2(P.l, 0) + ' m)', c.muted); mk(P.l + P.xe, 'equilibrium', c.v); mk(P.D, 'lowest (' + f2(P.D, 1) + ' m)', c.w);
        const jy = top + y * sc;
        // cord
        ctx.strokeStyle = y > P.l ? c.t : c.muted; ctx.lineWidth = y > P.l ? 2.4 : 1.4;
        ctx.beginPath(); ctx.moveTo(px - 20, top);
        if (y <= P.l) { ctx.quadraticCurveTo(px - 40, top + (P.l * sc) * 0.5 + (jy - top) * 0.2, px, jy); }
        else ctx.lineTo(px, jy);
        ctx.stroke();
        ctx.fillStyle = c.acc; ctx.beginPath(); ctx.arc(px, jy + 8, 8, 0, 7); ctx.fill();
        // bars
        const ext = Math.max(0, y - P.l);
        const Eg = P.m * g * (P.D - y), Ek = 0.5 * P.m * v * v, Es = 0.5 * P.k * ext * ext;
        const bx = sceneW + 20, bw = (W - bx - 20) / 3 - 14, bh = H - 70, by = H - 36;
        [[Eg, 'gravitational', c.w], [Ek, 'kinetic', c.v], [Es, 'strain', c.t]].forEach(([E, lab, col], i) => {
          const x = bx + i * (bw + 14), hh = Math.max(0, E / P.Etot) * bh;
          ctx.fillStyle = c.s2; ctx.fillRect(x, by - bh, bw, bh);
          ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, by - hh, bw, hh, [4, 4, 0, 0]) : ctx.rect(x, by - hh, bw, hh); ctx.fill();
          K.text(ctx, lab, x + bw / 2, by + 16, { align: 'center', size: 11, c });
          K.text(ctx, (E / 1000).toFixed(1) + ' kJ', x + bw / 2, by - hh - 6, { align: 'center', size: 11, mono: true, c });
        });
        K.text(ctx, 'total = ' + (P.Etot / 1000).toFixed(1) + ' kJ', bx, 16, { color: c.muted, size: 11.5, c });
        K.text(ctx, 'fallen ' + f2(y, 1) + ' m · v = ' + f2(Math.abs(v), 1) + ' m s⁻¹', 10, H - 10, { mono: true, size: 11.5, c });
      }
      add(K.loop(dt => { if (!P) return; t += dt; if (t > 1) stepPhys(dt); if (t > 14) { y = 0; v = 0; t = 0; } draw(); }, cv.wrap));
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };
})();
