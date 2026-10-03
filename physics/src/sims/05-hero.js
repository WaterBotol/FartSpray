/* Home page: draggable charges with live electric field lines */
(function () {
  'use strict';
  const K = window.SIMKIT;
  window.SIMS.heroField = function (el) {
    el.innerHTML = '';
    const cvs = K.canvas(el, 0.8, { maxH: 440, minH: 260, label: 'Electric field lines around two charges. Drag a charge to move it, tap it to flip its sign.' });
    cvs.wrap.style.border = '0';
    cvs.wrap.style.borderRadius = '0';
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = 'Drag the charges · tap one to flip its sign';
    el.appendChild(cap);
    const charges = [{ x: 0.32, y: 0.52, q: 1 }, { x: 0.7, y: 0.46, q: -1 }];
    const { ctx } = cvs;

    function field(px, py, W, H) {
      let ex = 0, ey = 0;
      for (const c of charges) {
        const dx = px - c.x * W, dy = py - c.y * H;
        const r2 = dx * dx + dy * dy + 1;
        const r3 = r2 * Math.sqrt(r2);
        ex += c.q * dx / r3; ey += c.q * dy / r3;
      }
      return [ex, ey];
    }
    function draw() {
      const W = cvs.W, H = cvs.H, c = K.col();
      ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      K.grid(ctx, W, H, 28, c);
      const pos = charges.filter(q => q.q > 0);
      const sources = pos.length ? pos : charges;
      const dirSign = pos.length ? 1 : -1;
      const nLines = 18, step = 2.4;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = c.acc;
      ctx.fillStyle = c.acc;
      for (const s of sources) {
        const sx = s.x * W, sy = s.y * H;
        for (let i = 0; i < nLines; i++) {
          const a = (i + 0.5) / nLines * Math.PI * 2;
          let x = sx + 15 * Math.cos(a), y = sy + 15 * Math.sin(a);
          const pts = [[x, y]];
          for (let k = 0; k < 1100; k++) {
            const [ex, ey] = field(x, y, W, H);
            const m = Math.hypot(ex, ey);
            if (m === 0) break;
            x += dirSign * step * ex / m; y += dirSign * step * ey / m;
            pts.push([x, y]);
            if (x < -40 || y < -40 || x > W + 40 || y > H + 40) break;
            let hit = false;
            for (const o of charges) { if (o.q * s.q < 0 && Math.hypot(x - o.x * W, y - o.y * H) < 11) { hit = true; break; } }
            if (hit) break;
          }
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
          ctx.stroke();
          // arrowhead near the middle of the visible part of the line
          const vis = pts.filter(p => p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H);
          if (vis.length > 30) {
            const j = Math.floor(vis.length * 0.45);
            const p0 = vis[j], p1 = vis[Math.min(vis.length - 1, j + 3)];
            let ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
            if (dirSign < 0) ang += Math.PI;
            ctx.globalAlpha = 1;
            ctx.save(); ctx.translate(p0[0], p0[1]); ctx.rotate(ang);
            ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
      }
      ctx.globalAlpha = 1;
      for (const q of charges) {
        const x = q.x * W, y = q.y * H;
        ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = q.q > 0 ? c.w : c.n; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = c.surface; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '700 18px ' + c.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(q.q > 0 ? '+' : '−', x, y + 1);
      }
    }
    cvs.draw = draw;
    draw();

    let drag = null;
    const pt = e => { const r = cvs.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    const onDown = e => {
      const [x, y] = pt(e);
      let best = null, bd = 1e9;
      charges.forEach(q => { const d = Math.hypot((q.x - x) * cvs.W, (q.y - y) * cvs.H); if (d < bd) { bd = d; best = q; } });
      if (best && bd < 28) {
        drag = { q: best, sx: x, sy: y, moved: false };
        cvs.cv.setPointerCapture(e.pointerId);
        cvs.cv.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };
    const onMove = e => {
      if (!drag) return;
      const [x, y] = pt(e);
      if (Math.hypot((x - drag.sx) * cvs.W, (y - drag.sy) * cvs.H) > 4) drag.moved = true;
      drag.q.x = K.clamp(x, 0.04, 0.96); drag.q.y = K.clamp(y, 0.06, 0.94);
      draw();
    };
    const onUp = () => {
      if (!drag) return;
      if (!drag.moved) { drag.q.q *= -1; draw(); }
      drag = null; cvs.cv.style.cursor = '';
    };
    cvs.cv.addEventListener('pointerdown', onDown);
    cvs.cv.addEventListener('pointermove', onMove);
    cvs.cv.addEventListener('pointerup', onUp);
    cvs.cv.addEventListener('pointercancel', onUp);
    const offTheme = K.onTheme(draw);
    return () => { offTheme(); cvs.destroy(); };
  };
})();
