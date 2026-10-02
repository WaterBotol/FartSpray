/* ==========================================================================
   VCE 3/4 Field Guide — multi-subject app engine
   Router, subject switcher, course map, cross-subject search, worked-example
   stepping, practice/MCQ engines, quiz gauntlet, review list, progress, theme.
   ========================================================================== */
(function () {
  'use strict';

  const G = JSON.parse(document.getElementById('guide-data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const main = $('#main'), nav = $('#nav'), toc = $('#toc');

  // Editable-PDF downloads. Inside a claude.ai Artifact frame, plain download links are sandboxed,
  // so hand the file to the viewer through the `downloads` capability; on the normal site the link works as is.
  let DL = null;
  try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(x => { DL = x; }, () => {}); } catch (e) { /* no runtime */ }
  document.addEventListener('click', ev => {
    const a = ev.target && ev.target.closest ? ev.target.closest('a[href$=".pdf"]') : null;
    if (!a || !/^pdf\//.test(a.getAttribute('href') || '') || !DL) return;
    ev.preventDefault();
    const href = a.getAttribute('href'), name = href.split('/').pop();
    fetch(href).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(blob => DL.save({ filename: name, data: blob }))
      .catch(err => { if (!err || err.code !== 'declined') window.open(a.href, '_blank', 'noopener'); });
  });
  const SITE = 'VCE 3/4 Field Guide';

  /* ------------------------------------------------------------ storage */
  const NS = 'vce34:';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* blocked */ } }
  };
  const S = {
    done: store.get('done', {}), pq: store.get('pq', {}), mcq: store.get('mcq', {}),
    collapsed: store.get('collapsed', {}), subject: store.get('subject', null), last: store.get('last', {})
  };
  const save = k => store.set(k, S[k]);

  /* ------------------------------------------------------------ indexes */
  const byId = {};
  G.topics.forEach(t => { byId[t.id] = t; });
  const SUBJ = {};
  G.subjects.forEach(s => {
    SUBJ[s.id] = s;
    s.order = [];
    s.groups.forEach(g => { g.subject = s.id; g.key = s.id + ':' + g.id; g.topics.forEach(id => { const t = byId[id]; if (t) { t.groupObj = g; s.order.push(t); } }); });
    s.study = s.order.filter(t => !t.special);
  });
  G.topics.forEach(t => { t.subj = t.subject ? SUBJ[t.subject] : null; });
  const ALLSTUDY = G.subjects.flatMap(s => s.study);
  if (!S.subject || !SUBJ[S.subject]) S.subject = G.subjects[0] ? G.subjects[0].id : null;

  /* ------------------------------------------------------------ utils */
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/\\\(|\\\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  let toastTimer;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1900); }
  function copyText(text, okMsg) {
    const done = () => toast(okMsg || 'Copied');
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed: ' + text); }
      ta.remove();
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function linkFor(hash) {
    let inFrame = false;
    try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
    if (inFrame && G.artifactUrl) return G.artifactUrl + '#' + hash;
    return location.href.split('#')[0] + '#' + hash;
  }
  function renderMath(root) {
    if (typeof window.renderMathInElement !== 'function') return;
    try {
      window.renderMathInElement(root, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input']
      });
    } catch (e) { console.error(e); }
    requestAnimationFrame(() => fitMath(root));
  }
  // KaTeX can't line-break inside one group (a whole \ce equation, a big fraction), so on narrow
  // screens shrink an overflowing formula by up to 22%, and if it still won't fit let it scroll as a block.
  function fitMath(root) {
    if (!root) return;
    const done = $$('.k-fit', root);
    done.forEach(k => { k.classList.remove('k-fit', 'k-wide'); k.style.fontSize = ''; });
    const boxOf = k => { let p = k.parentElement; while (p && getComputedStyle(p).display.startsWith('inline')) p = p.parentElement; return p; };
    const todo = [];
    $$('.katex', root).forEach(k => {
      if (!k.offsetParent || k.closest('table, .fs-card')) return;
      const disp = k.parentElement.classList.contains('katex-display');
      let need, have;
      if (disp) { need = k.parentElement.scrollWidth; have = k.parentElement.clientWidth; }
      else {
        const b = boxOf(k); if (!b) return;
        const cs = getComputedStyle(b);
        need = k.getBoundingClientRect().width; have = b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      }
      if (have > 0 && need > have + 1) todo.push([k, have / need, disp]);
    });
    todo.forEach(([k, r, disp]) => {
      k.classList.add('k-fit');
      if (r >= 0.78) k.style.fontSize = (1.08 * r * 0.95).toFixed(3) + 'em';
      else { k.style.fontSize = (1.08 * 0.78).toFixed(3) + 'em'; if (!disp) k.classList.add('k-wide'); }
    });
  }
  let fitT;
  window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => fitMath(main), 150); });
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('.we, .pq, .mcq, .nt-card, details, .quiz');
    if (c) requestAnimationFrame(() => fitMath(c));
  });
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', omega: 'ω', Omega: 'Ω', times: '×', cdot: '·', approx: '≈', propto: '∝', le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→', rightarrow: '→', infty: '∞', pm: '±', circ: '°', ll: '≪', gg: '≫', neq: '≠', in: '∈', mathbb: '', rightleftharpoons: '⇌', hat: '' };
  function texToText(s) {
    let out = s.replace(/\\[\(\)\[\]]/g, ' ');
    out = out.replace(/\\ce\s*\{([^{}]*)\}/g, '$1');
    for (let k = 0; k < 4; k++) out = out.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|mathbb)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\(left|right|displaystyle|quad|qquad)/g, ' ')
      .replace(/\\[,;:! ]/g, ' ')
      .replace(/\^\{?2\}?/g, '²').replace(/\^\{?3\}?/g, '³')
      .replace(/\\([A-Za-z]+)/g, (m, w) => (w in GREEK ? GREEK[w] : w))
      .replace(/[{}]/g, '').replace(/_/g, '').replace(/\s+/g, ' ');
    return out;
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, '').replace(/[^a-z0-9α-ωδΔ²³]+/g, ' ').trim();
  }

  /* ------------------------------------------------------------ theme + subject accent */
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const savedTheme = store.get('theme', null);
  if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.setAttribute('data-theme', savedTheme);
  function isDark() {
    const a = document.documentElement.getAttribute('data-theme');
    if (a === 'dark') return true; if (a === 'light') return false;
    return !!(mq && mq.matches);
  }
  function emitTheme() { window.dispatchEvent(new CustomEvent('guide:theme')); }
  $('#themeBtn').addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); store.set('theme', next); emitTheme();
  });
  if (mq) { try { mq.addEventListener('change', emitTheme); } catch (e) { mq.addListener && mq.addListener(emitTheme); } }
  try { new MutationObserver(emitTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* noop */ }
  function setSubject(sid, persist) {
    if (!sid || !SUBJ[sid]) return;
    const changed = document.body.dataset.subject !== sid;
    S.subject = sid; document.body.dataset.subject = sid;
    if (persist !== false) save('subject');
    if (changed) emitTheme();
  }
  setSubject(S.subject, false);

  /* ------------------------------------------------------------ question bank (lazy) */
  let BANK = null;
  function bank() {
    if (BANK) return BANK;
    BANK = [];
    const tpl = document.createElement('template');
    G.subjects.forEach(s => s.groups.forEach(g => {
      if (!g.quiz) return;
      g.topics.forEach(id => {
        const t = byId[id]; if (!t || !t.counts.mcq) return;
        tpl.innerHTML = t.html;
        let n = 0;
        $$('.mcq, .pq', tpl.content).forEach(q => {
          n++;
          if (q.classList.contains('mcq')) BANK.push({ t: t.id, n, level: q.dataset.level || 'core', g: g.key, s: s.id, html: q.outerHTML });
        });
      });
    }));
    return BANK;
  }

  /* ------------------------------------------------------------ search index (built in idle chunks) */
  const INDEX = [];
  let indexPos = 0, indexDone = false;
  const SYN = {
    rollercoaster: ['rollercoaster', 'roller coaster', 'loop'], fbd: ['free body'], tension: ['tension', 'string', 'rope'],
    emf: ['emf', 'electromotive'], rms: ['rms', 'root mean square'], sr: ['relativity'], gpe: ['gravitational potential'],
    ke: ['kinetic energy'], hookes: ['hooke'], gamma: ['gamma', 'lorentz'], satellite: ['satellite', 'orbit'], orbit: ['orbit', 'satellite'],
    banked: ['banked', 'bank'], ydse: ['double slit', 'young'], debroglie: ['de broglie', 'broglie'], lift: ['lift', 'apparent weight'],
    weightless: ['weightless', 'apparent weight'], pulley: ['pulley', 'atwood'], incline: ['incline', 'slope'],
    diff: ['differentiation', 'derivative'], differentiate: ['differentiation', 'derivative'], derivative: ['derivative', 'differentiation'],
    integrate: ['integration', 'antiderivative', 'integral'], integral: ['integral', 'integration', 'antiderivative'], integration: ['integration', 'antiderivative', 'integral'],
    antidifferentiation: ['antiderivative', 'antidifferentiation', 'integral'], trig: ['circular', 'trigonometric', 'sine', 'cosine'], trigonometry: ['circular', 'trigonometric'],
    log: ['logarithm', 'log'], logs: ['logarithm'], ln: ['logarithm', 'natural log'], exp: ['exponential'], ci: ['confidence interval'], pdf: ['probability density'],
    binomial: ['binomial'], normal: ['normal distribution', 'normal'], phat: ['sample proportion'], newton: ['newton'], cas: ['cas', 'calculator'],
    lechatelier: ['le chatelier'], chatelier: ['chatelier'], kc: ['equilibrium constant', 'kc'], redox: ['redox', 'oxidation', 'reduction'],
    nmr: ['nmr', 'nuclear magnetic'], ir: ['infrared', 'ir'], ms: ['mass spectrometry'], hplc: ['hplc', 'chromatography'], faraday: ['faraday'],
    ester: ['ester', 'esterification'], amine: ['amine'], organic: ['organic'], calorimetry: ['calorimetry', 'calorimeter'], enthalpy: ['enthalpy', 'delta h'],
    dna: ['dna', 'nucleic'], rna: ['rna', 'nucleic'], pcr: ['pcr', 'polymerase chain'], crispr: ['crispr', 'cas9'], operon: ['operon', 'trp'], trp: ['trp', 'operon'],
    photosynthesis: ['photosynthesis', 'calvin', 'light dependent'], respiration: ['respiration', 'glycolysis', 'krebs'], immune: ['immune', 'immunity'], immunity: ['immunity', 'immune'],
    antibody: ['antibody', 'antibodies'], vaccine: ['vaccine', 'vaccination'], evolution: ['evolution', 'natural selection'], speciation: ['speciation'], hominin: ['hominin'],
    phonetics: ['phonetics', 'phonology'], ipa: ['phonetic', 'ipa'], syntax: ['syntax', 'clause', 'sentence'], semantics: ['semantics'], pragmatics: ['pragmatics'],
    slang: ['slang', 'colloquial'], ethnolect: ['ethnolect'], register: ['register'], jargon: ['jargon'], euphemism: ['euphemism'], essay: ['essay'], commentary: ['commentary', 'analytical commentary']
  };
  function mkEntry(e) {
    e.text = texToText(e.text).replace(/\s+/g, ' ').trim();
    e.title = texToText(e.title).replace(/\s+/g, ' ').trim();
    e.nTitle = ' ' + norm(e.title) + ' '; e.nKw = ' ' + norm(e.kw) + ' '; e.nPath = ' ' + norm(e.path) + ' '; e.nText = ' ' + norm(e.text) + ' ';
    return e;
  }
  const tplIdx = document.createElement('template');
  function indexTopic(t) {
    const sn = t.subj ? t.subj.name : 'Guide';
    INDEX.push(mkEntry({ t: t.id, a: null, s: t.subject, title: t.title, path: sn + (t.groupObj ? ' · ' + t.groupObj.eyebrow : ''), text: t.summary + ' ' + (t.dotpoints || []).join(' '), kw: (t.keywords || []).join(' ') + ' ' + sn, kind: 'topic' }));
    tplIdx.innerHTML = t.html;
    const f = tplIdx.content;
    $$('svg, .sim', f).forEach(x => x.remove());
    const used = {};
    let cur = { a: null, text: '' };
    const flush = () => {
      if (cur.a && cur.text.trim()) INDEX.push(mkEntry({ t: t.id, a: cur.a, s: t.subject, title: cur.title, path: sn + ' · ' + (t.short || t.title), text: cur.text, kw: '', kind: 'section' }));
      else if (!cur.a && cur.text.trim()) { const top = INDEX.filter(e => e.t === t.id && e.kind === 'topic')[0]; if (top) mkEntry(Object.assign(top, { text: top.text + ' ' + cur.text.slice(0, 1500) })); }
    };
    Array.from(f.childNodes).forEach(node => {
      if (node.nodeType === 1 && /^H[23]$/.test(node.tagName)) {
        flush();
        const txt = node.textContent.trim();
        let s = slug(texToText(txt)); if (used[s]) { used[s]++; s += '-' + used[s]; } else used[s] = 1;
        cur = { title: texToText(txt).trim(), a: s, text: '' };
      } else cur.text += ' ' + (node.textContent || '');
    });
    flush();
    $$('.we', f).forEach((we, i) => INDEX.push(mkEntry({ t: t.id, a: 'we-' + (i + 1), s: t.subject, title: we.dataset.title || ('Worked example ' + (i + 1)), path: sn + ' · ' + (t.short || t.title), text: we.textContent, kw: '', kind: 'example' })));
    $$('dl.gloss dt', f).forEach(dt => { const dd = dt.nextElementSibling; INDEX.push(mkEntry({ t: t.id, a: 'term-' + slug(texToText(dt.textContent)), s: t.subject, title: texToText(dt.textContent).trim(), path: sn + ' · glossary', text: dd ? dd.textContent : '', kw: '', kind: 'term' })); });
    $$('.fs-card', f).forEach(card => { const h = card.querySelector('h4'); if (h) INDEX.push(mkEntry({ t: t.id, a: 'fs-' + slug(h.textContent), s: t.subject, title: h.textContent.trim(), path: sn + ' · reference', text: card.textContent, kw: card.dataset.kw || '', kind: 'formula' })); });
  }
  function indexSome(n) { while (indexPos < G.topics.length && n-- > 0) indexTopic(G.topics[indexPos++]); if (indexPos >= G.topics.length) indexDone = true; }
  function ensureIndex() { if (!indexDone) indexSome(1e9); }
  function idleIndex() {
    if (indexDone) return;
    indexSome(6);
    (window.requestIdleCallback || (f => setTimeout(f, 60)))(idleIndex);
  }
  function countOcc(hay, needle) { let c = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1 && c < 8) { c++; i += needle.length; } return c; }
  function search(qRaw) {
    ensureIndex();
    const q = norm(qRaw); if (!q) return [];
    const toks = q.split(' ').filter(Boolean);
    const groups = toks.map(tk => {
      const alts = new Map([[tk, 1]]);
      if (tk.length > 4 && tk.endsWith('s')) alts.set(tk.slice(0, -1), 1);
      if (SYN[tk]) SYN[tk].forEach(a => { const n = norm(a); if (!alts.has(n)) alts.set(n, 0.6); });
      return Array.from(alts);
    });
    const phrase = ' ' + q, res = [];
    for (const e of INDEX) {
      let score = 0, ok = true;
      for (const alts of groups) {
        let best = 0;
        for (const [a, w] of alts) {
          const n = ' ' + a; let sc = 0;
          if (e.nTitle.includes(n)) sc = 12; else if (e.nKw.includes(n)) sc = 8; else if (e.nPath.includes(n)) sc = 3;
          else { const c = countOcc(e.nText, n); if (c) sc = 1 + Math.min(c, 6) * 0.5; }
          best = Math.max(best, sc * w);
        }
        if (!best) { ok = false; break; }
        score += best;
      }
      if (!ok) continue;
      if (toks.length > 1 && e.nTitle.includes(phrase)) score += 12; else if (toks.length > 1 && e.nKw.includes(phrase)) score += 10; else if (toks.length > 1 && e.nText.includes(phrase)) score += 5;
      score += { topic: 5, term: 4, formula: 3, example: 2, section: 2 }[e.kind] || 0;
      if (e.s && S.subject) score += e.s === S.subject ? 4 : -4;
      res.push({ e, score, alts: groups.flatMap(g => g.map(x => x[0])) });
    }
    res.sort((a, b) => b.score - a.score);
    let terms = 0; // at most two glossary definitions, so topic pages aren't crowded out
    return res.filter(r => r.e.kind !== 'term' || ++terms <= 2).slice(0, 16);
  }
  function hlRe(alts) {
    const sorted = alts.filter(a => a.length > 1).sort((a, b) => b.length - a.length);
    return sorted.length ? new RegExp('(' + sorted.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi') : null;
  }
  function snippet(text, alts) {
    const low = text.toLowerCase(); let pos = -1;
    for (const a of alts) { const i = low.indexOf(a); if (i !== -1 && (pos === -1 || i < pos)) pos = i; }
    const start = Math.max(0, pos - 60);
    let s = text.slice(start, start + 170);
    if (start > 0) s = '…' + s.replace(/^\S*\s/, '');
    if (start + 170 < text.length) s = s.replace(/\s\S*$/, '') + '…';
    const re = hlRe(alts); const h = esc(s);
    return re ? h.replace(re, '<mark>$1</mark>') : h;
  }
  function hl(text, alts) { const re = hlRe(alts); const h = esc(text); return re ? h.replace(re, '<mark>$1</mark>') : h; }

  const qEl = $('#q'), resEl = $('#results');
  let sel = -1, lastRes = [];
  const KIND = { topic: 'Topic', section: '', example: 'Worked example', term: 'Definition', formula: 'Reference' };
  function showResults() {
    const v = qEl.value.trim();
    if (!v) { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); return; }
    lastRes = search(v); sel = lastRes.length ? 0 : -1;
    if (!lastRes.length) resEl.innerHTML = '<div class="empty">No matches for “' + esc(v) + '”. Try a broader word, or check the spelling.</div>';
    else resEl.innerHTML = lastRes.map((r, i) => {
      const e = r.e, href = '#' + e.t + (e.a ? '~' + e.a : '');
      const kind = KIND[e.kind] ? '<span class="r-kind">' + KIND[e.kind] + '</span>' : '';
      const badge = e.s ? '<span class="r-subj" data-s="' + e.s + '">' + esc(SUBJ[e.s] ? SUBJ[e.s].short : '') + '</span>' : '';
      return '<a class="r' + (i === sel ? ' sel' : '') + '" role="option" href="' + href + '" data-i="' + i + '"><div class="r-path">' + badge + esc(e.path) + '</div>' +
        '<div class="r-title">' + hl(e.title, r.alts) + kind + '</div><div class="r-snip">' + snippet(e.text, r.alts) + '</div></a>';
    }).join('') + '<div class="r-foot"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>';
    resEl.hidden = false; qEl.setAttribute('aria-expanded', 'true');
  }
  function moveSel(d) {
    if (!lastRes.length) return;
    sel = (sel + d + lastRes.length) % lastRes.length;
    $$('.r', resEl).forEach((a, i) => a.classList.toggle('sel', i === sel));
    const a = $$('.r', resEl)[sel]; if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function closeSearch() { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); }
  let qTimer;
  qEl.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(showResults, 70); });
  qEl.addEventListener('focus', () => { if (qEl.value.trim()) showResults(); });
  qEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = $$('.r', resEl)[sel]; if (a) go(a.getAttribute('href')); }
    else if (e.key === 'Escape') { if (qEl.value) { qEl.value = ''; closeSearch(); } else cancelSearch(); }
  });
  resEl.addEventListener('click', e => { const a = e.target.closest('.r'); if (!a) return; e.preventDefault(); go(a.getAttribute('href')); });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) closeSearch(); });
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); qEl.focus(); qEl.select(); }
  });
  function go(href) { closeSearch(); qEl.blur(); closeNav(); body.classList.remove('search-open'); if (location.hash === href) route(); else location.hash = href; }
  function openSearch() { body.classList.add('search-open'); closeNav(); qEl.focus(); qEl.select(); }
  function cancelSearch() { qEl.value = ''; closeSearch(); qEl.blur(); body.classList.remove('search-open'); }
  $('#searchCancel').addEventListener('click', cancelSearch);

  /* ------------------------------------------------------------ nav drawer */
  const body = document.body;
  function openNav() { body.classList.add('nav-open'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeNav() { body.classList.remove('nav-open'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
  $('#menuBtn').addEventListener('click', () => body.classList.contains('nav-open') ? closeNav() : openNav());
  $('#scrim').addEventListener('click', closeNav);

  /* ------------------------------------------------------------ progress */
  function progress(sid) {
    const list = sid ? SUBJ[sid].study : ALLSTUDY;
    const done = list.filter(t => S.done[t.id]).length;
    const inS = k => !sid || (byId[k.split(':')[0]] && byId[k.split(':')[0]].subject === sid);
    const mk = Object.keys(S.mcq).filter(inS);
    const correct = mk.filter(k => S.mcq[k].ok).length;
    const review = Object.keys(S.pq).filter(k => S.pq[k] === 'review' && inS(k)).length + mk.filter(k => !S.mcq[k].ok).length;
    const qb = list.reduce((a, t) => a + t.counts.mcq + t.counts.pq, 0);
    return { done, total: list.length, answered: mk.length, correct, review, qb };
  }
  function updateReviewCount() { const p = progress(), n = p.review ? String(p.review) : ''; $('#reviewCount').textContent = n; const tb = $('#tabReviewCount'); if (tb) tb.textContent = n; }

  /* ------------------------------------------------------------ sidebar */
  function renderNav(activeId) {
    const s = SUBJ[S.subject];
    let h = '<div class="subj-switch" role="tablist" aria-label="Subjects">' + G.subjects.map(x =>
      '<button type="button" role="tab" class="subj-btn" data-s="' + x.id + '" aria-selected="' + (x.id === S.subject) + '">' + esc(x.short) + '</button>').join('') + '</div>';
    if (s) {
      const p = progress(s.id);
      h += '<a class="nav-subj-title" href="#' + (s.order[0] ? s.order[0].id : 'home') + '">' + esc(s.name) + '</a>';
      h += '<div class="nav-progress"><div class="lbl"><span>Topics completed</span><b>' + p.done + ' / ' + p.total + '</b></div><div class="bar"><i style="width:' + (p.total ? 100 * p.done / p.total : 0).toFixed(1) + '%"></i></div></div>';
      const isExamGroup = g => g.topics.length && g.topics.every(id => byId[id] && byId[id].special === 'exam');
      const groups = s.groups.slice(0, 1).concat(s.groups.filter(isExamGroup), s.groups.slice(1).filter(g => !isExamGroup(g)));
      groups.forEach(g => {
        const collapsed = S.collapsed[g.key];
        h += '<div class="nav-group' + (collapsed ? ' collapsed' : '') + '" data-g="' + g.key + '"><button class="nav-group-h" aria-expanded="' + (!collapsed) + '"><span class="nav-eyebrow"><span>' + esc(g.eyebrow) + '</span><span class="chev">▾</span></span>' +
          (g.title ? '<span class="nav-gtitle">' + esc(g.title) + '</span>' : '') + '</button><ul>';
        g.topics.forEach(id => {
          const t = byId[id]; if (!t) return;
          const dot = t.special ? '<span class="nav-dot" style="border-style:dashed"></span>' : '<span class="nav-dot' + (S.done[id] ? ' done' : '') + '"></span>';
          h += '<li><a href="#' + id + '" class="' + (id === activeId ? 'active' : '') + '">' + dot + '<span>' + esc(t.short || t.title) + '</span></a></li>';
        });
        h += '</ul></div>';
      });
    }
    h += '<div class="nav-group"><div class="nav-eyebrow" style="padding:4px 6px">General</div><ul>' +
      ['home', 'notes', 'gauntlet', 'exams', 'past-papers', 'review'].map(id => byId[id] ? '<li><a href="#' + id + '" class="' + (id === activeId ? 'active' : '') + '"><span class="nav-dot" style="border-style:dashed"></span><span>' + esc(byId[id].short) + '</span></a></li>' : '').join('') + '</ul></div>';
    nav.innerHTML = h;
    $$('.subj-btn', nav).forEach(b => b.addEventListener('click', () => {
      const sid = b.dataset.s;
      setSubject(sid);
      const cur = byId[currentId];
      if (cur && cur.subject) { const first = SUBJ[sid].order[0]; if (first) { go('#' + first.id); return; } }
      renderNav(currentId);
      if (cur && cur.special === 'home') fillSlots(main, cur);
    }));
    $$('.nav-group-h', nav).forEach(b => b.addEventListener('click', () => {
      const g = b.parentElement, key = g.dataset.g;
      g.classList.toggle('collapsed'); S.collapsed[key] = g.classList.contains('collapsed'); save('collapsed');
      b.setAttribute('aria-expanded', String(!S.collapsed[key]));
    }));
    $$('a', nav).forEach(a => a.addEventListener('click', closeNav));
    const act = $('a.active', nav);
    if (act) { try { act.scrollIntoView({ block: 'nearest' }); } catch (e) { /* noop */ } }
  }

  /* ------------------------------------------------------------ enhancers */
  const ICON = {
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>',
    trap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    exam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    def: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    deep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg>'
  };
  const CALLOUT = { 'c-key': ['key', 'Key idea'], 'c-trap': ['trap', 'Trick alert'], 'c-exam': ['exam', 'Exam tip'], 'c-def': ['def', 'Definition'], 'c-deep': ['deep', 'Going deeper'] };
  const LEVEL = { core: 'Core', hard: 'Hard', trick: 'Trick', exam: 'Exam-style' };

  function enhanceCallouts(root) {
    $$('aside[class^="c-"]', root).forEach(a => { const cfg = CALLOUT[a.className.split(' ')[0]]; if (cfg) a.prepend(el('div', 'c-label', ICON[cfg[0]] + '<span>' + esc(a.dataset.title || cfg[1]) + '</span>')); });
  }
  function enhanceHeadings(root, topic) {
    const used = {};
    $$('.prose > h2, .prose > h3', root).forEach(h => {
      let s = slug(texToText(h.textContent)); if (used[s]) { used[s]++; s += '-' + used[s]; } else used[s] = 1;
      h.id = 'a-' + s;
      const b = el('button', 'anchor', '#'); b.type = 'button'; b.title = 'Copy link to this section'; b.setAttribute('aria-label', 'Copy link to this section');
      b.addEventListener('click', () => copyText(linkFor(topic.id + '~' + s), 'Link to section copied'));
      h.prepend(b);
    });
    $$('dl.gloss dt', root).forEach(dt => { dt.id = 'a-term-' + slug(texToText(dt.textContent)); });
    $$('.fs-card', root).forEach(c => { const h = c.querySelector('h4'); if (h) c.id = 'a-fs-' + slug(h.textContent); });
  }
  const splitF = str => (str || '').split(';;').map(x => x.trim()).filter(Boolean);
  // A formula like "f'(x) = 0 \text{ at turning points}" renders its wordy \text{} parts as plain text,
  // so a chip can wrap like a sentence instead of being one unbreakable KaTeX box.
  // Only top-level \text groups containing a space are split out (not units like \text{m s}^{-2}).
  function fxHtml(f) {
    const parts = []; let i = 0, last = 0;
    while ((i = f.indexOf('\\text{', i)) !== -1) {
      let d = 0, j = i + 5, depth = 0;
      for (let k = 0; k < i; k++) { if (f[k] === '{') depth++; else if (f[k] === '}') depth--; }
      for (; j < f.length; j++) { if (f[j] === '{') d++; else if (f[j] === '}' && --d === 0) break; }
      const inner = f.slice(i + 6, j), next = f[j + 1];
      if (depth === 0 && /\s/.test(inner) && next !== '^' && next !== '_' && !/[{}\\]/.test(inner.replace(/\\[%&$#]/g, ''))) {
        parts.push({ m: f.slice(last, i) }, { t: inner.replace(/\\([%&$#])/g, '$1') }); last = j + 1;
      }
      i = j + 1;
    }
    parts.push({ m: f.slice(last) });
    const trimM = m => m.replace(/^(\s|\\[ ,;:!]|\\quad)+|(\s|\\[ ,;:!]|\\quad)+$/g, '');
    // more wrap points: after a top-level ",\ " and before the arrow of a \ce equation
    const pieces = m => {
      const out = []; let depth = 0, last = 0;
      for (let k = 0; k < m.length; k++) {
        if (m[k] === '{' || /^\\left(?![a-zA-Z])/.test(m.slice(k, k + 6))) depth++;
        else if (m[k] === '}' || /^\\right(?![a-zA-Z])/.test(m.slice(k, k + 7))) depth--;
        else if (!depth && m.startsWith(',\\ ', k)) { out.push(m.slice(last, k + 1)); last = k + 3; }
      }
      out.push(m.slice(last));
      return out.map(trimM).filter(Boolean).flatMap(x => { const c = x.match(/^\\ce\{([^{}]*?)\s(->|<=>|<-)\s([^{}]*)\}$/); return c ? ['\\ce{' + c[1] + '}', '\\ce{' + c[2] + ' ' + c[3] + '}'] : [x]; });
    };
    return parts.map(p => p.t !== undefined ? (p.t.trim() ? '<span class="fx-t">' + esc(p.t.trim()) + '</span>' : '')
      : pieces(p.m).map(x => '\\(' + esc(x) + '\\)').join(' ')).filter(Boolean).join(' ');
  }
  function formulaBox(str) {
    const fs = splitF(str);
    if (!fs.length) return null;
    return el('aside', 'fx', '<div class="fx-h">Formulas used</div><ul>' + fs.map(f => '<li>' + fxHtml(f) + '</li>').join('') + '</ul>');
  }
  // formula(s) used in one step, shown beside that step (below it on narrow screens)
  function stepFormula(s) {
    const fs = splitF(s.dataset.f);
    if (!fs.length || s.classList.contains('has-sf')) return;
    const body = el('div', 's-body');
    while (s.firstChild) body.appendChild(s.firstChild);
    s.append(body, el('div', 's-f', '<span class="s-f-h">Using</span>' + fs.map(f => '<span class="s-f-i">' + fxHtml(f) + '</span>').join('')));
    s.classList.add('has-sf');
  }
  function enhanceWorked(root) {
    $$('.we', root).forEach((we, i) => {
      we.id = 'a-we-' + (i + 1);
      const marks = we.dataset.marks;
      const head = el('div', 'we-h', '<span class="we-tag">Worked example ' + (i + 1) + '</span><span class="we-title">' + (we.dataset.title || '') + '</span>' + (marks ? '<span class="marks">' + marks + ' mark' + (marks === '1' ? '' : 's') + '</span>' : ''));
      const steps = $$(':scope > .we-s, :scope > .we-a', we);
      steps.forEach(stepFormula);
      const th = $(':scope > .we-t', we);
      if (th) { th.prepend(el('div', 'we-t-h', 'Theory')); th.hidden = true; }
      const wrap = el('div', 'we-steps');
      let n = 0;
      steps.forEach(s => { if (s.classList.contains('we-s')) s.dataset.n = ++n; s.hidden = true; wrap.appendChild(s); });
      we.prepend(head); we.appendChild(wrap);
      const ctl = el('div', 'we-ctl');
      const bNext = el('button', 'btn primary'); bNext.type = 'button';
      const bAll = el('button', 'btn', 'Show full solution'); bAll.type = 'button';
      const bReset = el('button', 'btn ghost', 'Hide solution'); bReset.type = 'button';
      const bTh = el('button', 'btn ghost', 'Theory'); bTh.type = 'button'; bTh.hidden = !th;
      const cnt = el('span', 'step-count');
      ctl.append(bNext, bAll, bTh, bReset, cnt); we.appendChild(ctl);
      const setTh = on => { if (!th) return; th.hidden = !on; bTh.textContent = on ? 'Hide theory' : 'Theory'; bTh.setAttribute('aria-expanded', on); };
      bTh.addEventListener('click', () => setTh(th.hidden));
      let shown = 0;
      const upd = () => {
        steps.forEach((s, k) => { s.hidden = k >= shown; });
        wrap.hidden = shown === 0;
        if (shown < steps.length) { bNext.hidden = false; bAll.hidden = false; bNext.textContent = steps[shown].classList.contains('we-a') ? 'Show answer' : (shown === 0 ? 'Try it, then show step 1' : 'Show step ' + (shown + 1)); }
        else { bNext.hidden = true; bAll.hidden = true; }
        bReset.hidden = shown === 0;
        cnt.textContent = shown ? shown + ' / ' + steps.length + ' shown' : steps.length + ' steps';
      };
      bNext.addEventListener('click', () => { shown = Math.min(steps.length, shown + 1); upd(); const s = steps[shown - 1]; if (s) s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      bAll.addEventListener('click', () => { shown = steps.length; setTh(true); upd(); });
      bReset.addEventListener('click', () => { shown = 0; setTh(false); upd(); we.scrollIntoView({ block: 'nearest' }); });
      upd();
    });
  }
  function enhanceMCQ(m, label, key, onAnswer) {
    const ans = (m.dataset.ans || 'A').trim().toUpperCase(), level = m.dataset.level || 'core';
    const ol = $(':scope > ol', m), x = $('.mcq-x', m);
    m.prepend(el('div', 'pq-h', '<span class="pq-tag">' + label + '</span><span class="lvl lvl-' + level + '">' + (LEVEL[level] || level) + '</span><span class="marks">Multiple choice · 1 mark</span>'));
    const opts = el('div', 'mcq-opts');
    const btns = (ol ? $$(':scope > li', ol) : []).map((li, i) => {
      const L = String.fromCharCode(65 + i);
      const b = el('button', 'opt', '<span class="L">' + L + '</span><span>' + li.innerHTML + '</span>'); b.type = 'button'; b.dataset.l = L; opts.appendChild(b); return b;
    });
    if (ol) ol.replaceWith(opts); else m.appendChild(opts);
    if (x) { x.hidden = true; m.appendChild(x); }
    const verdict = el('div', 'mcq-verdict'); if (x) x.prepend(verdict);
    const reveal = choice => {
      btns.forEach(b => { b.disabled = true; if (b.dataset.l === ans) b.classList.add('correct'); else if (b.dataset.l === choice) b.classList.add('wrong'); });
      const ok = choice === ans;
      verdict.className = 'mcq-verdict ' + (ok ? 'ok' : 'no');
      verdict.textContent = ok ? 'Correct: ' + ans + '.' : 'Not quite. You chose ' + choice + '; the answer is ' + ans + '.';
      if (x) x.hidden = false;
      return ok;
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const ok = reveal(b.dataset.l);
      if (key) { S.mcq[key] = { ok, c: b.dataset.l, t: Date.now() }; save('mcq'); updateReviewCount(); }
      if (onAnswer) onAnswer(ok, b.dataset.l);
    }));
    if (key && !onAnswer) {
      const again = el('button', 'btn ghost', 'Try again'); again.type = 'button'; again.style.margin = '0 16px 14px'; again.hidden = true; m.appendChild(again);
      btns.forEach(b => b.addEventListener('click', () => { again.hidden = false; }));
      again.addEventListener('click', () => { btns.forEach(b => { b.disabled = false; b.classList.remove('correct', 'wrong'); }); if (x) x.hidden = true; again.hidden = true; });
    }
  }
  function enhanceQuestions(root, topic) {
    let n = 0;
    $$('.mcq, .pq', root).forEach(q => {
      n++;
      const key = topic.id + ':q' + n; q.id = 'a-q' + n;
      if (q.classList.contains('mcq')) { enhanceMCQ(q, 'Question ' + n, key); return; }
      const level = q.dataset.level || 'core', marks = q.dataset.marks;
      q.prepend(el('div', 'pq-h', '<span class="pq-tag">Question ' + n + '</span><span class="lvl lvl-' + level + '">' + (LEVEL[level] || level) + '</span>' + (marks ? '<span class="marks">' + marks + ' mark' + (marks === '1' ? '' : 's') + '</span>' : '')));
      const sols = $$(':scope > .pq-s', q); sols.forEach(s => { s.hidden = true; });
      const fx = formulaBox(q.dataset.f);
      if (fx && sols.length) { fx.classList.add('fx-under'); sols[sols.length - 1].after(fx); fx.hidden = true; sols.push(fx); }
      const ctl = el('div', 'pq-ctl');
      const bShow = el('button', 'btn primary', 'Reveal solution'); bShow.type = 'button';
      const sm = el('div', 'selfmark', '<span>How did you go?</span>');
      const bOk = el('button', 'btn', 'Got it'); bOk.type = 'button';
      const bRv = el('button', 'btn', 'Review later'); bRv.type = 'button';
      sm.append(bOk, bRv); ctl.append(bShow, sm); q.appendChild(ctl);
      const paint = () => { const st = S.pq[key]; bOk.classList.toggle('on-good', st === 'ok'); bRv.classList.toggle('on-bad', st === 'review'); q.classList.toggle('state-ok', st === 'ok'); q.classList.toggle('state-review', st === 'review'); };
      let open = false;
      bShow.addEventListener('click', () => { open = !open; sols.forEach(s => { s.hidden = !open; }); bShow.textContent = open ? 'Hide solution' : 'Reveal solution'; bShow.classList.toggle('primary', !open); });
      const setSt = v => { if (S.pq[key] === v) delete S.pq[key]; else S.pq[key] = v; save('pq'); paint(); updateReviewCount(); };
      bOk.addEventListener('click', () => setSt('ok')); bRv.addEventListener('click', () => setSt('review'));
      paint();
    });
  }

  /* ------------------------------------------------------------ practice exams (special: exam) */
  // Markup: .ex-meta (data-level/reading/writing), .ex-cover, h2 sections, .ex-inst, .ex-stim,
  // .mcq (data-ans, data-t topic), .exq > .exq-stem + .exp (data-marks, data-part, data-t) > .exp-q, ul.mk, .exp-a, .ex-rep;
  // h2 + .ex-report at the end is the assessor's general report (shown after marking).
  function enhanceExam(root, t) {
    const prose = $('#prose', root), meta = $('.ex-meta', prose);
    if (!prose || !meta) return;
    const KEY = 'ex:' + t.id, P = t.subj ? t.subj.prefix + '-' : '';
    const st = Object.assign({ phase: 'idle', t0: 0, timed: true, mcq: {}, resp: {}, ticks: {}, marked: false }, store.get(KEY, {}));
    const persist = () => store.set(KEY, st);
    const reading = +(meta.dataset.reading || 15), writing = +(meta.dataset.writing || 150);
    const LV = { easy: 'Easier', medium: 'Medium', hard: 'Harder' }, level = meta.dataset.level || 'medium', real = !!meta.dataset.real;
    const topicName = id => { const x = byId[P + id]; return x ? (x.short || x.title) : id; };
    // ---- MCQs
    const mcqs = $$('.mcq', prose).map((m, i) => {
      const n = i + 1, ans = (m.dataset.ans || 'A').toUpperCase(), ol = $(':scope > ol', m), x = $('.mcq-x', m), rep = $(':scope > .ex-rep', m);
      m.classList.add('ex-mcq'); m.id = 'a-mcq' + n;
      m.prepend(el('div', 'pq-h', '<span class="pq-tag">Question ' + n + '</span><span class="marks">1 mark</span>'));
      const opts = el('div', 'mcq-opts');
      const btns = (ol ? $$(':scope > li', ol) : []).map((li, j) => {
        const L = String.fromCharCode(65 + j), b = el('button', 'opt', '<span class="L">' + L + '</span><span>' + li.innerHTML + '</span>');
        b.type = 'button'; b.dataset.l = L; opts.appendChild(b); return b;
      });
      if (ol) { if (btns.every(b => !b.textContent.replace(/^[A-E]/, '').trim())) opts.classList.add('letters'); ol.replaceWith(opts); }
      if (x) { x.hidden = true; m.appendChild(x); }
      if (rep) { rep.hidden = true; m.appendChild(rep); }
      const fac = m.dataset.fac !== undefined ? +m.dataset.fac / 100 : null;
      const verdict = el('div', 'mcq-verdict'); if (x) x.prepend(verdict);
      const paint = () => btns.forEach(b => b.classList.toggle('sel', st.mcq[n] === b.dataset.l));
      btns.forEach(b => b.addEventListener('click', () => {
        if (st.marked || !canWrite()) { if (!st.marked) toast(st.phase === 'reading' ? 'Reading time: you can read but not answer yet' : 'Press Start to begin'); return; }
        st.mcq[n] = st.mcq[n] === b.dataset.l ? undefined : b.dataset.l; persist(); paint(); bar();
      }));
      paint();
      return { n, ans, btns, x, rep, verdict, fac, t: m.dataset.t || '' };
    });
    // ---- written questions
    let qn = 0; const parts = [];
    $$('.exq', prose).forEach(q => {
      qn++; q.id = 'a-exq' + qn;
      const ps = $$(':scope > .exp', q), total = ps.reduce((a, p) => a + (+p.dataset.marks || 0), 0);
      q.prepend(el('div', 'exq-h', '<span class="pq-tag">Question ' + qn + '</span><span class="marks">' + total + ' mark' + (total === 1 ? '' : 's') + '</span>'));
      ps.forEach((p, j) => {
        const lab = ps.length > 1 ? (p.dataset.part || String.fromCharCode(97 + j)) : '';
        const id = qn + lab, marks = +p.dataset.marks || 0;
        const mk = $(':scope > ul.mk', p), ans = $(':scope > .exp-a', p), rep = $(':scope > .ex-rep', p);
        p.prepend(el('div', 'exp-h', (lab ? '<span class="exp-l">' + lab + '.</span>' : '') + '<span class="marks">' + marks + ' mark' + (marks === 1 ? '' : 's') + '</span>'));
        const ta = el('textarea', 'ex-ta'); ta.rows = marks >= 10 ? 18 : Math.max(2, Math.min(10, marks * 2)); ta.placeholder = marks >= 10 ? 'Write your full response here (' + marks + ' marks). Plan first, then write in paragraphs.' : 'Write your answer here (' + marks + ' mark' + (marks === 1 ? '' : 's') + ').' + (marks > 1 ? ' Show your working or reasoning.' : '');
        ta.value = st.resp[id] || '';
        let tm; ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { st.resp[id] = ta.value; persist(); }, 350); });
        const qEl = $(':scope > .exp-q', p); (qEl || p.firstChild).after(ta);
        const box = el('div', 'ex-mark'); box.hidden = true;
        let items = [];
        if (mk) {
          items = $$(':scope > li', mk).map((li, k) => ({ li, k, m: +(li.dataset.m || 1) }));
          const list = el('ol', 'mk-list');
          items.forEach(it => {
            const row = el('li', 'mk-row', '<label><input type="checkbox"> <span class="mk-m">' + it.m + '</span><span class="mk-t">' + it.li.innerHTML + '</span></label>');
            const cb = $('input', row); cb.checked = (st.ticks[id] || []).includes(it.k);
            cb.addEventListener('change', () => { const s = new Set(st.ticks[id] || []); cb.checked ? s.add(it.k) : s.delete(it.k); st.ticks[id] = [...s]; persist(); tally(); });
            it.cb = cb; list.appendChild(row);
          });
          box.append(el('div', 'ex-mark-h', '<span>Marking guide · tick what you earned</span><span class="ex-mark-s"></span>'), list);
          mk.remove();
        }
        if (ans) { ans.classList.add('ex-ans'); ans.prepend(el('div', 'ex-lbl', real ? 'Answer' : 'Sample answer')); box.appendChild(ans); }
        if (rep) { rep.prepend(el('div', 'ex-lbl', real ? 'How Victoria went' : 'Assessor’s comment')); box.appendChild(rep); }
        p.appendChild(box);
        parts.push({ id, marks, items, box, ta, avg: p.dataset.avg !== undefined ? +p.dataset.avg : null, t: p.dataset.t || q.dataset.t || '' });
      });
    });
    const report = $('.ex-report', prose), repH = report && report.previousElementSibling && report.previousElementSibling.tagName === 'H2' ? report.previousElementSibling : null;
    const mcqTotal = mcqs.length, wTotal = parts.reduce((a, p) => a + p.marks, 0), grand = mcqTotal + wTotal;
    // ---- cover + sticky bar + results
    const fmt = mins => (mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60 ? (mins % 60) + ' min' : '') : mins + ' min').trim();
    const cover = el('div', 'ex-start', '<div class="ex-badges"><span class="lvl-b lvl-b-' + level + '">' + (LV[level] || level) + '</span><span class="chip"><b>' + grand + '</b> marks</span><span class="chip">Reading <b>' + fmt(reading) + '</b></span><span class="chip">Writing <b>' + fmt(writing) + '</b></span>' + (mcqTotal ? '<span class="chip"><b>' + mcqTotal + '</b> multiple choice</span>' : '') + (qn ? '<span class="chip"><b>' + qn + '</b> written questions</span>' : '') + '</div>' +
      '<div class="ex-go"><button class="btn primary" type="button" data-go="timed">Start exam (timed)</button><button class="btn" type="button" data-go="free">Start untimed</button><button class="btn ghost" type="button" data-go="peek">Skip to solutions &amp; report</button></div>' +
      (real ? '<p class="ln">Real VCAA questions: open each one in the official exam PDF (link on every question) and answer here. Timed mode gives reading time first, then writing time. Your answers save in this browser. When you finish, mark your written answers against the guide, then compare with the state results.</p>' : '') + (real ? '' : '<p class="ln">Timed mode gives you reading time first (you can read, not answer), then writing time. Your answers save in this browser. After you finish, you mark the written answers yourself against the marking guide, then the assessor’s report unlocks.</p>'));
    const cv = $('.ex-cover', prose); (cv || meta).after(cover);
    const barEl = el('div', 'ex-bar'); barEl.hidden = true; cover.after(barEl);
    const res = el('div', 'ex-results'); res.hidden = true; barEl.after(res);
    const body = []; let node = res.nextElementSibling;
    while (node) { if (node !== report && node !== repH) body.push(node); node = node.nextElementSibling; }
    const setBody = on => body.forEach(n => { n.hidden = !on; });
    const canWrite = () => st.phase === 'writing' || st.phase === 'free';
    let tick = null;
    const left = () => {
      if (!st.timed || !st.t0) return null;
      const s = (Date.now() - st.t0) / 1000, r = reading * 60, w = writing * 60;
      if (s < r) return { phase: 'reading', s: r - s };
      if (s < r + w) return { phase: 'writing', s: r + w - s };
      return { phase: 'over', s: 0 };
    };
    const mmss = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
    const lockInputs = () => parts.forEach(p => { p.ta.readOnly = st.marked || !canWrite(); });
    barEl.innerHTML = '<div class="ex-clock"></div><div class="ex-prog"></div><button class="btn" type="button" data-act=""></button>';
    const bClock = $('.ex-clock', barEl), bProg = $('.ex-prog', barEl), bBtn = $('button', barEl);
    // two-step confirm (modal dialogs can be blocked inside embedded frames)
    const arm = (btn, msg, fn) => {
      if (btn.dataset.armed) { delete btn.dataset.armed; clearTimeout(btn._t); fn(); return; }
      btn.dataset.armed = '1'; btn._lbl = btn.innerHTML; btn.innerHTML = 'Click again to confirm'; btn.classList.add('armed'); toast(msg);
      btn._t = setTimeout(() => { delete btn.dataset.armed; btn.innerHTML = btn._lbl; btn.classList.remove('armed'); }, 4000);
    };
    function bar() {
      if (st.phase === 'idle') { barEl.hidden = true; return; }
      barEl.hidden = false;
      const answered = mcqs.filter(m => st.mcq[m.n]).length, written = parts.filter(p => (st.resp[p.id] || '').trim()).length;
      let clock = '';
      if (st.marked) clock = '<span class="ex-ph done">Marked</span>';
      else if (st.timed) { const l = left(); clock = l.phase === 'reading' ? '<span class="ex-ph read">Reading time</span><b>' + mmss(l.s) + '</b>' : l.phase === 'writing' ? '<span class="ex-ph">Writing time</span><b>' + mmss(l.s) + '</b>' : '<span class="ex-ph over">Time’s up</span>'; }
      else clock = '<span class="ex-ph">Untimed</span>';
      bClock.innerHTML = clock;
      bProg.innerHTML = (mcqTotal ? 'MC <b>' + answered + '/' + mcqTotal + '</b>' : '') + (parts.length ? (mcqTotal ? ' · ' : '') + 'Written <b>' + written + '/' + parts.length + '</b>' : '');
      const act = st.marked ? 'reset' : 'finish';
      if (bBtn.dataset.act !== act && !bBtn.dataset.armed) { bBtn.dataset.act = act; bBtn.className = 'btn ' + (act === 'finish' ? 'primary' : 'ghost'); bBtn.innerHTML = act === 'finish' ? 'Finish &amp; mark' : 'Reset exam'; }
    }
    const startClock = () => {
      clearInterval(tick);
      tick = setInterval(() => {
        if (!document.body.contains(barEl)) { clearInterval(tick); return; }
        if (st.timed && !st.marked) { const l = left(), ph = l.phase === 'over' ? 'writing' : l.phase; if (ph !== st.phase) { st.phase = ph; persist(); lockInputs(); if (ph === 'writing') toast('Reading time over: start writing'); } if (l.phase === 'over' && !st.warned) { st.warned = true; persist(); toast('Time’s up. Finish and mark when ready.'); } }
        bar();
      }, 1000);
      cleanups.push(() => clearInterval(tick));
    };
    function tally() {
      let got = 0; const per = {};
      const add = (tp, g, of) => { if (!tp) return; tp.split(/\s+/).forEach(x => { per[x] = per[x] || [0, 0]; per[x][0] += g; per[x][1] += of; }); };
      const mcGot = mcqs.filter(m => st.mcq[m.n] === m.ans).length;
      mcqs.forEach(m => add(m.t, st.mcq[m.n] === m.ans ? 1 : 0, 1));
      parts.forEach(p => {
        const g = Math.min(p.marks, p.items.filter(it => it.cb && it.cb.checked).reduce((a, it) => a + it.m, 0));
        got += g; add(p.t, g, p.marks);
        const s = $('.ex-mark-s', p.box); if (s) s.textContent = g + ' / ' + p.marks;
      });
      const tot = mcGot + got, pct = grand ? Math.round(100 * tot / grand) : 0;
      if (st.marked) { st.score = tot; st.of = grand; persist(); }
      const weak = Object.entries(per).filter(([, v]) => v[1] >= 2).map(([k, v]) => [k, v, v[0] / v[1]]).sort((a, b) => a[2] - b[2]);
      const stateTot = mcqs.reduce((x, m) => x + (m.fac || 0), 0) + parts.reduce((x, p) => x + (p.avg || 0), 0);
      const bench = real && stateTot ? '<div class="ex-bench">State average on these same questions: <b>' + stateTot.toFixed(0) + ' / ' + grand + '</b> (' + Math.round(100 * stateTot / grand) + '%). ' + (tot >= stateTot ? 'You beat the state average.' : 'You are ' + Math.round(stateTot - tot) + ' mark' + (Math.round(stateTot - tot) === 1 ? '' : 's') + ' below it (tick your written marks first).') + '</div>' : '';
      res.innerHTML = '<div class="ex-score"><div><span class="ex-big">' + tot + '</span><span class="ex-of">/ ' + grand + '</span></div><div class="ex-pct">' + pct + '%</div></div>' +
        '<div class="ex-split">' + (mcqTotal ? '<span>Multiple choice <b>' + mcGot + '/' + mcqTotal + '</b></span>' : '') + (parts.length ? '<span>Written (self-marked) <b>' + got + '/' + wTotal + '</b></span>' : '') + '</div>' + bench +
        (weak.length ? '<div class="ex-weak"><h4>By topic, weakest first</h4><ul>' + weak.slice(0, 10).map(([k, v, r]) => '<li><a href="#' + P + k + '">' + esc(topicName(k)) + '</a><span class="ex-bar-mini"><i style="width:' + Math.round(r * 100) + '%"></i></span><b>' + v[0] + '/' + v[1] + '</b></li>').join('') + '</ul></div>' : '') +
        '<p class="ln">Written marks only count once you tick the marking points under each answer. Be as strict as a VCAA assessor: the idea has to be clearly there, in your own words. Then read the assessor’s report at the end.</p>';
    }
    function mark() {
      st.marked = true; st.phase = 'marked'; persist();
      mcqs.forEach(m => {
        const c = st.mcq[m.n];
        m.btns.forEach(b => { b.disabled = true; b.classList.remove('sel'); if (b.dataset.l === m.ans) b.classList.add('correct'); else if (b.dataset.l === c) b.classList.add('wrong'); });
        m.verdict.className = 'mcq-verdict ' + (c === m.ans ? 'ok' : 'no');
        m.verdict.textContent = !c ? 'Not answered. The answer is ' + m.ans + '.' : c === m.ans ? 'Correct: ' + m.ans + '.' : 'You chose ' + c + '; the answer is ' + m.ans + '.';
        if (m.x) m.x.hidden = false; if (m.rep) { m.rep.hidden = false; if (!$('.ex-lbl', m.rep)) m.rep.prepend(el('div', 'ex-lbl', real ? 'How Victoria went' : 'Assessor’s comment')); }
      });
      parts.forEach(p => { p.box.hidden = false; p.ta.readOnly = true; if (!p.ta.value.trim()) p.ta.classList.add('empty'); });
      if (report) { report.hidden = false; if (repH) repH.hidden = false; }
      setBody(true); res.hidden = false; tally(); bar(); buildToc(); renderMath(prose);
    }
    function begin(mode) {
      if (mode === 'peek') { st.phase = 'free'; st.timed = false; mark(); return; }
      st.timed = mode === 'timed'; st.t0 = Date.now(); st.phase = st.timed ? (reading ? 'reading' : 'writing') : 'free';
      persist(); cover.hidden = true; setBody(true); lockInputs(); bar(); startClock(); buildToc();
      barEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    cover.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; if (b.dataset.go === 'peek') arm(b, 'This shows every answer and ends the attempt', () => begin('peek')); else begin(b.dataset.go); });
    bBtn.addEventListener('click', () => {
      if (bBtn.dataset.act === 'finish') {
        const un = mcqs.filter(m => !st.mcq[m.n]).length;
        arm(bBtn, (un ? un + ' multiple-choice unanswered. ' : '') + 'Finishing shows the marking guide.', () => { mark(); res.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      } else if (bBtn.dataset.act === 'reset') arm(bBtn, 'This clears all your answers and marks for this exam', () => { store.set(KEY, {}); render(t); });
    });
    // ---- initial state
    if (report) { report.hidden = true; if (repH) repH.hidden = true; }
    if (st.marked) { cover.hidden = true; mark(); }
    else if (st.phase === 'idle') setBody(false);
    else { cover.hidden = true; setBody(true); lockInputs(); bar(); startClock(); }
  }

  let cleanups = [];
  function mountSims(root) {
    $$('.sim[data-sim]', root).forEach(s => {
      const f = window.SIMS && window.SIMS[s.dataset.sim];
      if (!f) { s.innerHTML = '<p class="sim-note">Interactive “' + esc(s.dataset.sim) + '” unavailable.</p>'; return; }
      try { const c = f(s); if (typeof c === 'function') cleanups.push(c); } catch (e) { console.error(e); s.innerHTML = '<p class="sim-note bad">This interactive failed to load in your browser.</p>'; }
    });
  }
  function runCleanups() { cleanups.forEach(c => { try { c(); } catch (e) { /* noop */ } }); cleanups = []; }

  /* ------------------------------------------------------------ TOC */
  let tocObs = null;
  function buildToc() {
    if (tocObs) { tocObs.disconnect(); tocObs = null; }
    const hs = $$('.prose > h2', main).filter(h => !h.hidden);
    if (hs.length < 2) { toc.innerHTML = ''; return; }
    toc.innerHTML = '<h4>On this page</h4>' + hs.map(h => '<a href="#" data-id="' + h.id + '"></a>').join('');
    $$('a', toc).forEach((a, i) => {
      const h = hs[i], clone = h.cloneNode(true);
      $$('.anchor, .katex-mathml', clone).forEach(x => x.remove());
      a.textContent = clone.textContent.trim();
      a.addEventListener('click', e => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
    if ('IntersectionObserver' in window) {
      tocObs = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) $$('a', toc).forEach(a => a.classList.toggle('active', a.dataset.id === en.target.id)); }), { rootMargin: '-10% 0px -75% 0px' });
      hs.forEach(h => tocObs.observe(h));
    }
  }

  /* ------------------------------------------------------------ topic render */
  function chipsFor(t) {
    const c = t.counts || {}, out = [];
    if (t.special === 'exam') return '';
    if (c.we) out.push('<span class="chip"><b>' + c.we + '</b> worked example' + (c.we > 1 ? 's' : '') + '</span>');
    if (c.pq || c.mcq) out.push('<span class="chip"><b>' + (c.pq + c.mcq) + '</b> practice questions</span>');
    if (c.trick) out.push('<span class="chip trap"><b>' + c.trick + '</b> traps flagged</span>');
    if (c.sims) out.push('<span class="chip"><b>' + c.sims + '</b> interactive' + (c.sims > 1 ? 's' : '') + '</span>');
    return out.join('');
  }
  function headHTML(t) {
    const g = t.groupObj, s = t.subj;
    let h = '<header class="t-head"><div class="eyebrow">' + esc((s ? s.name : 'General') + (g && g.eyebrow ? ' · ' + g.eyebrow : '')) + '</div><h1>' + t.title + '</h1>';
    if (t.summary) h += '<p class="t-summary">' + t.summary + '</p>';
    h += '<div class="chips">' + chipsFor(t) + '</div>';
    if (t.dotpoints && t.dotpoints.length) h += '<details class="dotpoints"><summary>Study design key knowledge covered<span>summary</span></summary><p class="ln">Summarised from the VCAA study design; the official wording may differ. Check the study design on the VCAA website for the exact dot points.</p><ul>' + t.dotpoints.map(d => '<li>' + d + '</li>').join('') + '</ul></details>';
    return h + '</header>';
  }
  function footHTML(t) {
    const order = t.subj ? t.subj.order : [];
    const i = order.indexOf(t), prev = order[i - 1], next = order[i + 1];
    let h = '<footer class="t-foot">';
    if (!t.special) h += '<div class="complete-card"><p>' + (S.done[t.id] ? 'You marked this topic as complete.' : 'Finished the explanations and questions? Mark this topic off on your course map.') + '</p><button class="btn ' + (S.done[t.id] ? 'on-good' : 'primary') + '" id="doneBtn" type="button">' + (S.done[t.id] ? '✓ Completed' : 'Mark topic complete') + '</button></div>';
    if (prev || next) {
      h += '<nav class="pn" aria-label="Previous and next topics">';
      if (prev) h += '<a href="#' + prev.id + '"><div class="dir">← Previous</div><div class="tt">' + esc(prev.short || prev.title) + '</div></a>';
      if (next) h += '<a class="next" href="#' + next.id + '"><div class="dir">Next →</div><div class="tt">' + esc(next.short || next.title) + '</div></a>';
      h += '</nav>';
    }
    return h + '</footer>';
  }
  function render(t, anchor) {
    runCleanups();
    if (t.subject) setSubject(t.subject);
    const bare = t.special === 'home' || t.special === 'overview';
    main.innerHTML = bare ? '<div class="home-wrap"><div class="prose" id="prose">' + t.html + '</div></div>' + (t.special === 'overview' ? footHTML(t) : '') : headHTML(t) + '<div class="prose" id="prose">' + t.html + '</div>' + footHTML(t);
    if (t.special === 'overview' && t.subj) { const hero = $('.hero', main), cta = examCtaHTML(t.subj); if (hero && cta) hero.insertAdjacentHTML('beforeend', cta); }
    enhanceHeadings(main, t); enhanceCallouts(main); enhanceWorked(main); if (t.special === 'exam') enhanceExam(main, t); else enhanceQuestions(main, t); fillSlots(main, t);
    renderMath(main); mountSims(main); buildToc(); renderNav(t.id);
    document.title = t.special === 'home' ? SITE : (t.short || t.title).replace(/<[^>]+>/g, '') + (t.subj ? ' · ' + t.subj.short : '') + ' · ' + SITE;
    if (t.subject) { S.last[t.subject] = t.id; S.last._ = t.id; save('last'); }
    const db = $('#doneBtn');
    if (db) db.addEventListener('click', () => {
      if (S.done[t.id]) delete S.done[t.id]; else S.done[t.id] = true;
      save('done');
      const on = !!S.done[t.id];
      db.className = 'btn ' + (on ? 'on-good' : 'primary'); db.textContent = on ? '✓ Completed' : 'Mark topic complete';
      db.previousElementSibling.textContent = on ? 'You marked this topic as complete.' : 'Finished the explanations and questions? Mark this topic off on your course map.';
      renderNav(t.id); if (on) toast('Topic marked complete');
    });
    if (anchor) {
      const target = document.getElementById('a-' + anchor);
      if (target) { requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1700); }); return; }
    }
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ slots */
  function fillSlots(root, t) {
    $$('[data-slot]', root).forEach(s => {
      const k = s.dataset.slot, sid = t.subject || null;
      if (k === 'map') s.innerHTML = mapHTML(sid || S.subject);
      else if (k === 'stats') s.innerHTML = statsHTML(sid);
      else if (k === 'subjects') s.innerHTML = subjectsHTML();
      else if (k === 'subjects-mini') s.innerHTML = subjectsMiniHTML();
      else if (k === 'gauntlet') mountGauntlet(s);
      else if (k === 'notes') mountNotes(s);
      else if (k === 'exams') mountExams(s);
      else if (k === 'review') mountReview(s);
      else if (k === 'resume') s.innerHTML = resumeHTML(sid);
    });
  }
  function resumeHTML(sid) {
    if (sid) {
      const s = SUBJ[sid], next = s.study.find(x => !S.done[x.id]) || s.study[0];
      if (!next) return '';
      return '<a class="btn primary" href="#' + next.id + '">' + (progress(sid).done ? 'Continue: ' : 'Start: ') + esc(next.short || next.title) + ' →</a>';
    }
    const last = byId[S.last._];
    if (last) return '<a class="btn primary" href="#' + last.id + '">Continue: ' + esc(last.short || last.title) + ' (' + esc(last.subj ? last.subj.short : '') + ') →</a>';
    const s = SUBJ[S.subject];
    return s && s.order[0] ? '<a class="btn primary" href="#' + s.order[0].id + '">Start with ' + esc(s.name) + ' →</a>' : '';
  }
  function subjectsMiniHTML() {
    return '<div class="subj-mini">' + G.subjects.map(s => { const p = progress(s.id); return '<a class="subj-mini-card" data-s="' + s.id + '" href="#' + (s.order[0] ? s.order[0].id : 'home') + '"><span class="sm-name">' + esc(s.name) + '</span><span class="sm-meta">' + s.study.length + ' topics · ' + p.qb + ' questions</span><span class="bar"><i style="width:' + (p.total ? 100 * p.done / p.total : 0) + '%"></i></span></a>'; }).join('') + '</div>';
  }
  function subjectsHTML() {
    return '<div class="subj-grid">' + G.subjects.map(s => {
      const p = progress(s.id);
      const sims = s.study.reduce((a, t) => a + t.counts.sims, 0) + s.order.filter(t => t.special).reduce((a, t) => a + t.counts.sims, 0);
      return '<div class="subj-card" data-s="' + s.id + '"><div class="eyebrow">' + esc(s.design || '') + '</div><h3><a href="#' + (s.order[0] ? s.order[0].id : 'home') + '">' + esc(s.name) + '</a></h3><p>' + esc(s.blurb || '') + '</p>' +
        '<div class="chips"><span class="chip"><b>' + s.study.length + '</b> topics</span><span class="chip"><b>' + p.qb + '</b> questions</span>' + (sims ? '<span class="chip"><b>' + sims + '</b> interactives</span>' : '') + '</div>' +
        '<div class="bar" title="' + p.done + ' of ' + p.total + ' complete"><i style="width:' + (p.total ? 100 * p.done / p.total : 0) + '%"></i></div>' +
        '<div class="subj-links">' + s.groups.filter(g => g.map !== false).map(g => '<a href="#' + g.topics[0] + '">' + esc(g.eyebrow) + '</a>').join('') + '</div></div>';
    }).join('') + '</div>';
  }
  function mapHTML(sid) {
    const s = SUBJ[sid]; if (!s) return '';
    return '<div class="map">' + s.groups.filter(g => g.map !== false).map(g => {
      const ts = g.topics.map(id => byId[id]).filter(Boolean), study = ts.filter(x => !x.special), d = study.filter(x => S.done[x.id]).length;
      return '<div class="map-card"><div class="eyebrow">' + esc(g.eyebrow) + '</div><h3>' + esc(g.title || '') + '</h3>' + (study.length ? '<div class="bar"><i style="width:' + (100 * d / study.length) + '%"></i></div>' : '') +
        '<ul>' + ts.map(x => '<li><a href="#' + x.id + '"><span class="nav-dot' + (S.done[x.id] ? ' done' : '') + '"' + (x.special ? ' style="border-style:dashed"' : '') + '></span><span>' + esc(x.short || x.title) + '</span></a></li>').join('') + '</ul></div>';
    }).join('') + '</div>';
  }
  function statsHTML(sid) {
    const p = progress(sid), acc = p.answered ? Math.round(100 * p.correct / p.answered) + '%' : '–';
    return '<div class="stats"><div class="stat"><span>Topics complete</span><b>' + p.done + '/' + p.total + '</b></div><div class="stat"><span>MCQs answered</span><b>' + p.answered + '</b></div><div class="stat"><span>MCQ accuracy</span><b>' + acc + '</b></div><div class="stat"><span>Flagged for review</span><b>' + p.review + '</b></div><div class="stat"><span>Question bank</span><b>' + p.qb + '</b></div></div>';
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  const EXLV = { easy: 'Easier', medium: 'Medium', hard: 'Harder' };
  function examInfo(t) {
    const meta = k => (t.html.match(new RegExp('class="ex-meta"[^>]*data-' + k + '="([\\w.]+)"')) || [])[1];
    const mc = (t.html.match(/class="mcq"/g) || []).length;
    const wm = (t.html.match(/class="exp"[^>]*data-marks="(\d+)"/g) || []).reduce((a, x) => a + +x.match(/(\d+)"$/)[1], 0);
    const w = +(meta('writing') || 0), marks = mc + wm, state = +(meta('state') || 0);
    const st = store.get('ex:' + t.id, {});
    return {
      lv: meta('level') || 'medium', marks, state: marks && state ? Math.round(100 * state / marks) : 0,
      time: w ? (w >= 60 ? Math.floor(w / 60) + ' h' + (w % 60 ? ' ' + w % 60 + ' min' : '') : w + ' min') : '',
      status: st.marked && st.of ? 'Scored <b>' + st.score + '/' + st.of + '</b> (' + Math.round(100 * st.score / st.of) + '%)' : st.phase && st.phase !== 'idle' ? 'In progress' : 'Not started'
    };
  }
  const pdfLinks = s => '<p class="ex-pdfs">Editable PDFs' + (s.id === 'methods' ? ' (Exam 1 and Exam 2 in one file)' : '') + ': ' + ['easier', 'medium', 'harder'].map(l => '<a href="pdf/' + s.id + '-' + l + '.pdf" download>' + l + ' paper</a>').join(' · ') + '</p>';
  // big practice-exam buttons at the top of each subject's overview page
  function examCtaHTML(s) {
    const ex = s.order.filter(t => t.special === 'exam');
    if (!ex.length) return '';
    const rows = [];
    ex.forEach(t => { const k = ((t.short || '').match(/^Exam \d/) || [''])[0]; let r = rows.find(x => x.k === k); if (!r) rows.push(r = { k, ts: [] }); r.ts.push(t); });
    return '<section class="ex-cta" aria-label="Practice exams"><div class="ex-cta-head"><div><h2 class="ex-cta-t">Practice exams</h2><p>Real VCAA questions, sorted by how the state actually went. Timed, with marking guides.</p></div><a class="btn" href="#exams">All exams</a></div>' +
      rows.map(r => (r.k ? '<div class="ex-cta-row">' + esc(r.k) + '</div>' : '') + '<div class="ex-cta-grid">' + r.ts.map(t => {
        const i = examInfo(t);
        return '<a class="ex-tile lv-' + i.lv + '" href="#' + t.id + '"><span class="ex-tile-lv">' + (EXLV[i.lv] || i.lv) + '</span>' +
          '<span class="ex-tile-m">' + i.marks + ' marks' + (i.time ? ' · ' + i.time : '') + '</span><span class="ex-tile-s">' + i.status + (i.state ? ' · state avg ' + i.state + '%' : '') + '</span><span class="ex-tile-go" aria-hidden="true">›</span></a>';
      }).join('') + '</div>').join('') + pdfLinks(s) + '</section>';
  }
  function mountExams(slot) {
    let h = '';
    G.subjects.slice().sort((a, b) => (b.id === S.subject) - (a.id === S.subject)).forEach(s => {
      const ex = s.order.filter(t => t.special === 'exam');
      if (!ex.length) return;
      h += '<h3 class="ex-hub-h" data-s="' + s.id + '">' + esc(s.name) + '</h3><div class="ex-hub">';
      ex.forEach(t => {
        const i = examInfo(t);
        h += '<a class="ex-card" href="#' + t.id + '"><span class="lvl-b lvl-b-' + i.lv + '">' + (EXLV[i.lv] || i.lv) + '</span><span class="ex-card-t">' + esc(t.short || t.title) + '</span><span class="ex-card-m">' + i.marks + ' marks' + (i.time ? ' · ' + i.time : '') + '</span><span class="ex-card-s">' + i.status + '</span></a>';
      });
      h += '</div>' + pdfLinks(s);
    });
    slot.innerHTML = h || '<p class="ln">No practice exams yet.</p>';
  }
  function mountGauntlet(slot) {
    const allGroups = G.subjects.flatMap(s => s.groups.filter(g => g.quiz));
    const def = { groups: SUBJ[S.subject] ? SUBJ[S.subject].groups.filter(g => g.quiz).map(g => g.key) : [], mode: 'trick', n: 10 };
    const cfg = Object.assign(def, store.get('gz2', {}));
    cfg.groups = cfg.groups.filter(k => allGroups.some(g => g.key === k));
    const render0 = () => {
      let h = '<div class="gz-setup">';
      G.subjects.forEach(s => {
        const gs = s.groups.filter(g => g.quiz); if (!gs.length) return;
        const allOn = gs.every(g => cfg.groups.includes(g.key));
        h += '<div class="gz-row gz-subj"><label class="pill pill-subj" data-s="' + s.id + '"><input type="checkbox" data-subj="' + s.id + '"' + (allOn ? ' checked' : '') + '> <b>' + esc(s.name) + '</b></label>' +
          gs.map(g => '<label class="pill"><input type="checkbox" value="' + g.key + '"' + (cfg.groups.includes(g.key) ? ' checked' : '') + '> ' + esc(g.eyebrow) + '</label>').join('') + '</div>';
      });
      h += '<div class="gz-row"><label>Question type</label>' + ['trick|Trick only', 'hard|Hard + trick', 'all|Everything'].map(x => { const [v, l] = x.split('|'); return '<label class="pill"><input type="radio" name="gzmode" value="' + v + '"' + (cfg.mode === v ? ' checked' : '') + '> ' + l + '</label>'; }).join('') + '</div>';
      h += '<div class="gz-row"><label>Length</label>' + [5, 10, 20, 40].map(v => '<label class="pill"><input type="radio" name="gzn" value="' + v + '"' + (cfg.n === v ? ' checked' : '') + '> ' + v + '</label>').join('') + '</div>';
      h += '<div class="gz-row"><button class="btn primary" type="button" id="gzGo">Start the gauntlet</button><span class="gz-avail"></span></div></div>';
      slot.innerHTML = h;
      const avail = $('.gz-avail', slot);
      const read = () => {
        cfg.groups = $$('input[type=checkbox][value]:checked', slot).map(i => i.value);
        cfg.mode = ($('input[name=gzmode]:checked', slot) || {}).value || 'trick';
        cfg.n = +(($('input[name=gzn]:checked', slot) || {}).value || 10);
        store.set('gz2', cfg);
        const pool = poolFor(cfg); avail.textContent = pool.length + ' questions match.';
        return pool;
      };
      slot.addEventListener('change', e => {
        const sj = e.target.dataset && e.target.dataset.subj;
        if (sj) $$('input[type=checkbox][value^="' + sj + ':"]', slot).forEach(i => { i.checked = e.target.checked; });
        read();
      });
      read();
      $('#gzGo', slot).addEventListener('click', () => { const pool = read(); if (!pool.length) { toast('No questions match: widen your selection'); return; } run(shuffle(pool.slice()).slice(0, cfg.n)); });
    };
    const poolFor = c => bank().filter(q => c.groups.includes(q.g) && (c.mode === 'all' || q.level === 'trick' || (c.mode === 'hard' && q.level === 'hard')));
    const run = qs => {
      let i = 0, score = 0; const wrong = [];
      const step = () => {
        if (i >= qs.length) return finish();
        const q = qs[i], t = byId[q.t];
        slot.innerHTML = '<div class="gz-bar"><span>Question <b>' + (i + 1) + '</b> of ' + qs.length + '</span><span>Score <b>' + score + '</b></span><button class="btn ghost" type="button" id="gzQuit">End quiz</button></div><div class="gz-q"></div>';
        const holder = $('.gz-q', slot); holder.innerHTML = q.html;
        const m = holder.firstElementChild;
        enhanceMCQ(m, (t.subj ? t.subj.short + ' · ' : '') + 'Q' + (i + 1), q.t + ':q' + q.n, ok => {
          if (ok) score++; else wrong.push(q);
          const sb = $$('.gz-bar b', slot)[1]; if (sb) sb.textContent = score;
          const nb = el('div', 'pq-ctl'); const b = el('button', 'btn primary', i + 1 < qs.length ? 'Next question →' : 'See results'); b.type = 'button';
          nb.appendChild(b); m.appendChild(nb);
          b.addEventListener('click', () => { i++; step(); window.scrollTo({ top: slot.offsetTop - 80 }); });
          b.focus({ preventScroll: true });
        });
        m.appendChild(el('div', 'gz-src', 'From: <a href="#' + q.t + '~q' + q.n + '">' + esc((t.subj ? t.subj.short + ' · ' : '') + (t.short || t.title)) + '</a>'));
        renderMath(holder);
        $('#gzQuit', slot).addEventListener('click', finish);
      };
      const finish = () => {
        const answered = Math.min(i + (i < qs.length && slot.querySelector('.opt[disabled]') ? 1 : 0), qs.length);
        const pct = answered ? Math.round(100 * score / answered) : 0;
        slot.innerHTML = '<div class="gz-result"><div class="eyebrow">Gauntlet complete</div><div class="big">' + score + '/' + answered + '</div><p style="margin:10px 0 16px;color:var(--ink-2)">' +
          (answered === 0 ? 'No questions answered.' : pct >= 85 ? 'Brutal set and you survived it. Examiners would struggle to trap you.' : pct >= 60 ? 'Solid, but a few traps got you. Read the explanations for the ones you missed.' : 'The traps won this round. Revisit the topics below, then run it again.') +
          '</p><div class="sim-btns" style="justify-content:center"><button class="btn primary" type="button" id="gzAgain">New gauntlet</button><a class="btn" href="#review">Open review list</a></div></div>' +
          (wrong.length ? '<h3>Missed questions</h3><div class="rv-list">' + wrong.map(q => { const t = byId[q.t]; return '<div class="rv-item"><a href="#' + q.t + '~q' + q.n + '">' + esc((t.subj ? t.subj.short + ' · ' : '') + (t.short || t.title)) + ' · Question ' + q.n + '</a></div>'; }).join('') + '</div>' : '');
        $('#gzAgain', slot).addEventListener('click', render0); updateReviewCount();
      };
      step();
    };
    render0();
  }

  /* Quick notes: short card per topic (summary bullets, key ideas, traps), expandable to the
     full topic minus its practice questions. */
  function noteParts(t) {
    if (t._np) return t._np;
    const tp = document.createElement('template'); tp.innerHTML = t.html;
    let sec = '';
    const full = [], summary = [], boxes = [];
    Array.from(tp.content.children).forEach(n => {
      if (n.tagName === 'H2') sec = n.textContent.trim();
      if (sec === 'Practice') return;
      if (sec === 'Summary') { if (n.tagName !== 'H2') summary.push(n.outerHTML); return; }
      full.push(n);
      if (n.matches('aside.c-key, aside.c-trap')) boxes.push(n.outerHTML);
    });
    const box = document.createElement('div'); full.forEach(n => box.appendChild(n));
    $$('.mcq, .pq', box).forEach(q => q.remove());
    return (t._np = { summary: summary.join(''), boxes, full: box.innerHTML });
  }
  function mountNotes(slot) {
    const noted = g => g.topics.map(id => byId[id]).filter(t => t && !t.special && /<h2>Summary<\/h2>/.test(t.html));
    const allGroups = G.subjects.flatMap(s => s.groups.filter(g => noted(g).length));
    const def = { groups: SUBJ[S.subject] ? allGroups.filter(g => g.subject === S.subject).map(g => g.key) : [], boxes: true };
    const cfg = Object.assign(def, store.get('nt1', {}));
    cfg.groups = cfg.groups.filter(k => allGroups.some(g => g.key === k));
    let h = '<div class="gz-setup">';
    G.subjects.forEach(s => {
      const gs = allGroups.filter(g => g.subject === s.id); if (!gs.length) return;
      h += '<div class="gz-row gz-subj"><label class="pill pill-subj" data-s="' + s.id + '"><input type="checkbox" data-subj="' + s.id + '"' + (gs.every(g => cfg.groups.includes(g.key)) ? ' checked' : '') + '> <b>' + esc(s.name) + '</b></label>' +
        gs.map(g => '<label class="pill"><input type="checkbox" value="' + g.key + '"' + (cfg.groups.includes(g.key) ? ' checked' : '') + '> ' + esc(g.eyebrow) + '</label>').join('') + '</div>';
    });
    h += '<div class="gz-row"><label class="pill"><input type="checkbox" id="ntBoxes"' + (cfg.boxes ? ' checked' : '') + '> Key ideas &amp; trick alerts</label></div></div>' +
      '<div class="nt-bar"><span class="nt-count"></span><span class="sim-btns"><button class="btn" type="button" id="ntOpen">Expand all</button><button class="btn ghost" type="button" id="ntClose">Collapse all</button></span></div><div class="nt-list"></div>';
    slot.innerHTML = h;
    const list = $('.nt-list', slot), count = $('.nt-count', slot);
    const openCard = (card, on) => {
      const full = $('.nt-full', card), b = $('.nt-more', card);
      if (on && !full.dataset.ready) {
        full.innerHTML = noteParts(byId[card.dataset.t]).full;
        enhanceCallouts(full); enhanceWorked(full); renderMath(full); mountSims(full);
        $$('[id]', full).forEach(x => x.removeAttribute('id'));
        full.dataset.ready = '1';
      }
      full.hidden = !on; card.classList.toggle('open', on);
      b.textContent = on ? 'Hide full notes' : 'Full notes';
      b.setAttribute('aria-expanded', on);
    };
    const draw = () => {
      runCleanups();
      const ts = [];
      G.subjects.forEach(s => s.groups.forEach(g => { if (cfg.groups.includes(g.key)) noted(g).forEach(t => ts.push(t)); }));
      count.textContent = ts.length ? ts.length + ' topic' + (ts.length > 1 ? 's' : '') : '';
      $$('button', count.nextElementSibling).forEach(b => { b.hidden = !ts.length; });
      if (!ts.length) { list.innerHTML = '<p class="ln">Pick at least one area above.</p>'; return; }
      list.innerHTML = ts.map(t => {
        const p = noteParts(t);
        return '<article class="nt-card" data-s="' + t.subject + '" data-t="' + t.id + '"><div class="eyebrow">' + esc(t.subj.short + ' · ' + t.groupObj.eyebrow) + '</div>' +
          '<h3><a href="#' + t.id + '">' + (t.short || t.title) + '</a></h3><div class="nt-sum">' + p.summary + '</div>' +
          (cfg.boxes && p.boxes.length ? '<div class="nt-boxes">' + p.boxes.join('') + '</div>' : '') +
          '<button class="btn nt-more" type="button" aria-expanded="false">Full notes</button><div class="nt-full" hidden></div></article>';
      }).join('');
      enhanceCallouts(list); renderMath(list);
    };
    slot.addEventListener('change', e => {
      const sj = e.target.dataset && e.target.dataset.subj;
      if (sj) $$('input[type=checkbox][value^="' + sj + ':"]', slot).forEach(i => { i.checked = e.target.checked; });
      else if (e.target.value && e.target.value.includes(':')) { const sp = e.target.value.split(':')[0], all = $$('input[type=checkbox][value^="' + sp + ':"]', slot); $('input[data-subj="' + sp + '"]', slot).checked = all.every(i => i.checked); }
      cfg.groups = $$('input[type=checkbox][value]:checked', slot).map(i => i.value);
      cfg.boxes = $('#ntBoxes', slot).checked;
      store.set('nt1', cfg); draw();
    });
    slot.addEventListener('click', e => {
      const b = e.target.closest('.nt-more');
      if (b) { const card = b.closest('.nt-card'), on = !card.classList.contains('open'); openCard(card, on); if (!on) card.scrollIntoView({ block: 'nearest' }); return; }
      if (e.target.id === 'ntOpen') $$('.nt-card', list).forEach(c => openCard(c, true));
      if (e.target.id === 'ntClose') { $$('.nt-card', list).forEach(c => openCard(c, false)); slot.scrollIntoView({ block: 'start' }); }
    });
    draw();
  }

  function mountReview(slot) {
    const items = [];
    Object.entries(S.pq).forEach(([k, v]) => { if (v === 'review') items.push({ k, type: 'Short answer' }); });
    Object.entries(S.mcq).forEach(([k, v]) => { if (!v.ok) items.push({ k, type: 'Multiple choice (answered wrong)' }); });
    const valid = items.filter(it => byId[it.k.split(':')[0]]);
    if (!valid.length) { slot.innerHTML = '<aside class="c-key"><div class="c-label">' + ICON.key + '<span>Nothing flagged yet</span></div><p>When you press <strong>Review later</strong> on a practice question, or get a multiple-choice question wrong, it lands here so you can come back to it before the exam.</p></aside>'; return; }
    const byTopic = {};
    valid.forEach(it => { const [tid, qn] = it.k.split(':'); (byTopic[tid] = byTopic[tid] || []).push(Object.assign(it, { tid, qn })); });
    let h = '<p>' + valid.length + ' question' + (valid.length > 1 ? 's' : '') + ' flagged. Redo each one without looking at the solution, then clear it.</p>';
    G.subjects.forEach(s => {
      const ts = s.order.filter(t => byTopic[t.id]); if (!ts.length) return;
      h += '<h2>' + esc(s.name) + '</h2>';
      ts.forEach(t => {
        h += '<h3>' + esc(t.short || t.title) + '</h3><div class="rv-list">' + byTopic[t.id].sort((a, b) => parseInt(a.qn.slice(1)) - parseInt(b.qn.slice(1))).map(it =>
          '<div class="rv-item"><a href="#' + t.id + '~' + it.qn + '">Question ' + it.qn.slice(1) + '</a><span class="meta">' + it.type + '</span><button class="btn" type="button" data-k="' + it.k + '">Clear</button></div>').join('') + '</div>';
      });
    });
    h += '<div style="margin-top:18px"><button class="btn ghost" type="button" id="rvClearAll">Clear the whole list</button></div>';
    slot.innerHTML = h;
    slot.onclick = e => {
      const b = e.target.closest('button[data-k]');
      if (b) { const k = b.dataset.k; if (S.pq[k] === 'review') { delete S.pq[k]; save('pq'); } if (S.mcq[k] && !S.mcq[k].ok) { delete S.mcq[k]; save('mcq'); } updateReviewCount(); mountReview(slot); }
      if (e.target.id === 'rvClearAll') {
        const b2 = e.target;
        if (b2.dataset.confirm) { Object.keys(S.pq).forEach(k => { if (S.pq[k] === 'review') delete S.pq[k]; }); Object.keys(S.mcq).forEach(k => { if (!S.mcq[k].ok) delete S.mcq[k]; }); save('pq'); save('mcq'); updateReviewCount(); mountReview(slot); }
        else { b2.dataset.confirm = '1'; b2.textContent = 'Press again to confirm'; b2.classList.add('on-bad'); }
      }
    };
  }

  /* ------------------------------------------------------------ router */
  function parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch (e) { /* raw */ }
    const i = h.indexOf('~');
    return i === -1 ? { t: h, a: null } : { t: h.slice(0, i), a: h.slice(i + 1) };
  }
  let currentId = null;
  function route() {
    let { t, a } = parseHash();
    if (!byId[t] && byId['ph-' + t]) t = 'ph-' + t; // old physics-guide links
    const topic = byId[t] || byId.home;
    if (topic.id === currentId && a) {
      const target = document.getElementById('a-' + a);
      if (target) { target.scrollIntoView({ block: 'start' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1700); return; }
    }
    currentId = topic.id;
    render(topic, a); syncTabs(topic);
    if (!a) main.focus({ preventScroll: true });
  }
  function syncTabs(t) {
    const tab = t.id === 'home' ? 'home' : (t.id === 'exams' || t.special === 'exam') ? 'exams' : t.id === 'review' ? 'review' : t.subject ? 'topics' : '';
    $$('#tabbar [data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); if (b.tagName === 'A') { if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } });
  }
  $('#tabbar [data-tab="topics"]').addEventListener('click', () => { body.classList.remove('search-open'); body.classList.contains('nav-open') ? closeNav() : openNav(); });
  $('#tabbar [data-tab="search"]').addEventListener('click', openSearch);
  $$('#tabbar a').forEach(a => a.addEventListener('click', () => { body.classList.remove('search-open'); closeNav(); }));
  window.addEventListener('hashchange', route);
  window.GUIDE_APP = { go, renderMath, toast, isDark, store };
  updateReviewCount();
  route();
  setTimeout(idleIndex, 900);
})();
