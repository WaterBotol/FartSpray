/* ==========================================================================
   Official VCAA questions, inline.
   The practice papers link each real VCAA question to the official exam PDF.
   In the private copy of the guide (the claude.ai Artifact) those PDFs sit in
   the artifact's own storage, so here each question is drawn straight from
   the official paper, cropped to that question (crop boxes worked out ahead
   of time), with its options, graphs and diagrams. Claude can be handed the
   same crop as an image when it marks or explains a question.
   Anywhere else (GitHub Pages, a saved file) there is no paper map: nothing
   changes and the links open the PDF on the VCAA site as before.
   ========================================================================== */
(function () {
  'use strict';
  const MAP = window.VCAA_PAPERS;
  if (!MAP || !MAP.papers || !MAP.crops) return;
  const doc = document, main = doc.getElementById('main');
  if (!main) return;
  const $ = (s, r) => (r || doc).querySelector(s), $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
  const store = window.GUIDE_APP && window.GUIDE_APP.store;

  let lib = null;
  const pdfjs = () => lib || (lib = import(CDN + 'pdf.min.mjs').then(m => { m.GlobalWorkerOptions.workerSrc = CDN + 'pdf.worker.min.mjs'; return m; }));
  const docs = {};
  const paper = url => docs[url] || (docs[url] = pdfjs().then(m => m.getDocument({ url: MAP.papers[url], isEvalSupported: false }).promise)
    .catch(e => { delete docs[url]; throw e; }));

  // which crop belongs to a question: its link (paper + page) and its source label
  function keyOf(link) {
    const src = link.closest('.src'), tag = src && $('.src-tag', src);
    const href = link.getAttribute('href') || '';
    const k = href + '|' + (tag ? tag.textContent.trim() : '');
    return MAP.crops[k] && MAP.papers[href.split('#')[0]] ? k : null;
  }
  const linkIn = root => $$('a.src-link', root).find(keyOf) || null;

  // draw one crop box of one page onto a canvas, cssW pixels wide
  async function drawSeg(url, seg, cssW, dpr) {
    const [pn, x0, y0, x1, y1] = seg;
    const pdf = await paper(url), page = await pdf.getPage(pn);
    const base = page.getViewport({ scale: 1 });
    const scale = cssW * dpr / (base.width * (x1 - x0)), vp = page.getViewport({ scale });
    const c = doc.createElement('canvas');
    c.width = Math.max(1, Math.round(vp.width * (x1 - x0))); c.height = Math.max(1, Math.round(vp.height * (y1 - y0)));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, transform: [1, 0, 0, 1, -vp.width * x0, -vp.height * y0] }).promise;
    return trim(c);
  }
  // drop the empty paper under the last question on a page
  function trim(c) {
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, W = c.width;
      let last = c.height - 1;
      for (; last > 0; last--) { let ink = false; for (let x = 0; x < W; x += 2) { const i = (last * W + x) * 4; if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) { ink = true; break; } } if (ink) break; }
      const h = Math.min(c.height, last + Math.round(c.width * 0.025));
      if (h >= c.height - 4 || h < 20) return c;
      const t = doc.createElement('canvas'); t.width = c.width; t.height = h; t.getContext('2d').drawImage(c, 0, 0); return t;
    } catch (e) { return c; }
  }

  /* ---- the inline panel */
  const hidden = () => !!(store && store.get('vqHide', false));
  function panelFor(link) {
    const key = keyOf(link); if (!key) return null;
    const box = doc.createElement('div');
    box.className = 'vq'; box.dataset.key = key;
    const segs = MAP.crops[key], pages = [...new Set(segs.map(s => s[0]))];
    box.innerHTML = '<div class="vq-bar"><span class="vq-t">Official question' + (pages.length > 1 ? ' · ' + pages.length + ' pages' : '') + '</span>' +
      '<button class="vq-tog" type="button" aria-expanded="true">Hide</button></div><div class="vq-img" role="img" aria-label="The official VCAA question"><div class="vq-load">Loading the official question…</div></div>';
    const tog = $('.vq-tog', box);
    tog.addEventListener('click', () => {
      const off = !box.classList.contains('off');
      box.classList.toggle('off', off); tog.textContent = off ? 'Show' : 'Hide'; tog.setAttribute('aria-expanded', String(!off));
      if (store) store.set('vqHide', off);
      if (!off) queue(box);
    });
    if (hidden()) { box.classList.add('off'); tog.textContent = 'Show'; tog.setAttribute('aria-expanded', 'false'); }
    return box;
  }
  async function draw(box) {
    const img = $('.vq-img', box), w = Math.round(img.clientWidth);
    if (!w || box.classList.contains('off') || Math.abs((+box.dataset.w || 0) - w) < 24) return;
    box.dataset.w = w;
    const key = box.dataset.key, url = key.split('#')[0], dpr = Math.min(2, window.devicePixelRatio || 1);
    try {
      const canvases = [];
      for (const seg of MAP.crops[key]) canvases.push(await drawSeg(url, seg, w, dpr));
      img.innerHTML = '';
      canvases.forEach((c, i) => { if (i) img.appendChild(Object.assign(doc.createElement('div'), { className: 'vq-break', textContent: 'continued on the next page' })); img.appendChild(c); });
    } catch (e) {
      delete box.dataset.w;
      img.innerHTML = '<div class="vq-load">Couldn’t load the official paper here. Use the link above to open it on the VCAA site.</div>';
    }
  }
  let io = null;
  const queue = box => { if (io) io.observe(box); else draw(box); };
  if ('IntersectionObserver' in window) io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) draw(e.target); }), { rootMargin: '800px 0px' });

  function decorate(root) {
    $$('a.src-link', root || main).forEach(link => {
      const holder = link.closest('.mcq-q, .exq-stem, .ex-stim');
      if (!holder || holder.querySelector(':scope > .vq')) return;
      const box = panelFor(link); if (!box) return;
      const src = link.closest('.src'), after = src && src.nextElementSibling && src.nextElementSibling.tagName === 'P' && !src.nextElementSibling.classList.contains('ln') ? src.nextElementSibling : src;
      (after || holder.lastElementChild).after(box);
      queue(box);
    });
  }
  // new content (a page, a review card, a re-drawn exam) gets panels too
  let pending = 0;
  new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; decorate(main); }); }).observe(main, { childList: true, subtree: true });
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => $$('.vq', main).forEach(b => { if (b.dataset.w) queue(b); }), 250); });

  /* ---- for Claude: the same crop as an image, and whatever text the paper carries */
  async function imageFor(root, width) {
    const link = linkIn(root); if (!link) return null;
    const key = keyOf(link), url = key.split('#')[0];
    const cs = [];
    for (const seg of MAP.crops[key]) cs.push(await drawSeg(url, seg, width || 900, 1));
    const out = doc.createElement('canvas');
    out.width = Math.max(...cs.map(c => c.width)); out.height = cs.reduce((a, c) => a + c.height, 0);
    const ctx = out.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    let y = 0; cs.forEach(c => { ctx.drawImage(c, 0, y); y += c.height; });
    return new Promise(res => out.toBlob(b => res(b), 'image/jpeg', 0.85));
  }
  async function textFor(root) {
    const link = linkIn(root); if (!link) return '';
    const key = keyOf(link), url = key.split('#')[0], pdf = await paper(url);
    let out = '';
    for (const [pn, x0, y0, x1, y1] of MAP.crops[key]) {
      const page = await pdf.getPage(pn), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent();
      const items = tc.items.filter(it => it.str && it.str.trim()).map(it => ({ s: it.str, x: it.transform[4] / vp.width, y: 1 - it.transform[5] / vp.height }))
        .filter(it => it.x >= x0 - 0.01 && it.x <= x1 && it.y >= y0 && it.y <= y1 + 0.01).sort((a, b) => (a.y - b.y) || (a.x - b.x));
      let last = null;
      items.forEach(it => { out += (last === null ? '' : Math.abs(it.y - last) > 0.006 ? '\n' : ' ') + it.s; last = it.y; });
      out += '\n';
    }
    return out.replace(/[ \t]+/g, ' ').trim();
  }
  const fromHTML = html => { const d = doc.createElement('div'); d.innerHTML = html || ''; return d; };

  window.GUIDE_PAPERS = { has: root => !!linkIn(root), imageFor, textFor, fromHTML };
  window.addEventListener('guide:render', () => decorate(main));
  decorate(main);
})();
