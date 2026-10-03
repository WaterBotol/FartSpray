/* ==========================================================================
   VCE Physics 3/4 Field Guide — app engine
   Router, course map, search, worked-example stepping, practice/MCQ
   engines, quiz mode (gauntlet), review list, progress, theme.
   ========================================================================== */
(function () {
  'use strict';

  const G = JSON.parse(document.getElementById('guide-data').textContent);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const main = $('#main');
  const nav = $('#nav');
  const toc = $('#toc');
  const SITE = 'VCE Physics 3/4 Field Guide';

  /* ------------------------------------------------------------ storage */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('vp34:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('vp34:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };
  const S = {
    done: store.get('done', {}),      // topicId -> true
    pq: store.get('pq', {}),          // key -> 'ok' | 'review'
    mcq: store.get('mcq', {}),        // key -> {ok, c, t}
    collapsed: store.get('collapsed', {})
  };
  const save = (k) => store.set(k, S[k]);

  /* ------------------------------------------------------------ indexes */
  const byId = {};
  G.topics.forEach((t, i) => { t.index = i; byId[t.id] = t; });
  const groupById = {};
  G.groups.forEach(g => { groupById[g.id] = g; g.topics.forEach(id => { if (byId[id]) byId[id].groupObj = g; }); });
  // reading order = order of groups, then topics within group
  const ORDER = [];
  G.groups.forEach(g => g.topics.forEach(id => { if (byId[id]) ORDER.push(byId[id]); }));
  const STUDY = ORDER.filter(t => !t.special);

  /* ------------------------------------------------------------ utils */
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function slug(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/\\\(|\\\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function copyText(text, okMsg) {
    const done = () => toast(okMsg || 'Copied');
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed — link is in the address bar'); }
      ta.remove();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function renderMath(root) {
    if (typeof window.renderMathInElement !== 'function') return;
    try {
      window.renderMathInElement(root, {
        delimiters: [
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input']
      });
    } catch (e) { console.error(e); }
  }
  // TeX -> readable text for search snippets
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', varepsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', omega: 'ω', Omega: 'Ω', times: '×', cdot: '·', approx: '≈', propto: '∝', le: '≤', leq: '≤', ge: '≥', geq: '≥', to: '→', rightarrow: '→', infty: '∞', pm: '±', circ: '°', ll: '≪', gg: '≫', neq: '≠' };
  function texToText(s) {
    let out = s.replace(/\\[\(\)\[\]]/g, ' ');
    for (let k = 0; k < 4; k++) out = out.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)')
      .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\(left|right|displaystyle|quad|qquad)/g, ' ')
      .replace(/\\[,;:! ]/g, ' ')
      .replace(/\^\{?2\}?/g, '²').replace(/\^\{?3\}?/g, '³')
      .replace(/\\([A-Za-z]+)/g, (m, w) => GREEK[w] || w)
      .replace(/[{}]/g, '').replace(/_/g, '').replace(/\^/g, '^')
      .replace(/\s+/g, ' ');
    return out;
  }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, '').replace(/[^a-z0-9α-ωδΔ²³]+/g, ' ').trim();
  }

  /* ------------------------------------------------------------ theme */
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
    document.documentElement.setAttribute('data-theme', next);
    store.set('theme', next);
    emitTheme();
  });
  if (mq) { try { mq.addEventListener('change', emitTheme); } catch (e) { mq.addListener && mq.addListener(emitTheme); } }
  try {
    new MutationObserver(emitTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------ question bank (parsed once) */
  const BANK = { mcq: [], pq: [] };
  const TOPIC_Q = {}; // topicId -> {mcq, pq, we, trick, sims}
  (function buildBank() {
    const tpl = document.createElement('template');
    G.topics.forEach(t => {
      tpl.innerHTML = t.html;
      const f = tpl.content;
      let n = 0;
      const counts = { mcq: 0, pq: 0, we: $$('.we', f).length, trick: 0, sims: $$('.sim', f).length };
      $$('.mcq, .pq', f).forEach(q => {
        n++;
        const level = q.dataset.level || 'core';
        if (level === 'trick') counts.trick++;
        if (q.classList.contains('mcq')) { counts.mcq++; BANK.mcq.push({ t: t.id, n, level, html: q.outerHTML }); }
        else { counts.pq++; BANK.pq.push({ t: t.id, n, level }); }
      });
      counts.trick += $$('.c-trap', f).length;
      TOPIC_Q[t.id] = counts;
    });
  })();

  /* ------------------------------------------------------------ search index */
  let INDEX = null;
  const SYN = {
    rollercoaster: ['rollercoaster', 'roller coaster', 'loop'], coaster: ['coaster', 'loop'], rollercoasters: ['rollercoaster', 'roller coaster', 'loop'],
    fbd: ['free body', 'fbd'], tension: ['tension', 'string', 'rope', 'cable'], string: ['string', 'tension'],
    emf: ['emf', 'electromotive'], rms: ['rms', 'root mean square'], sr: ['relativity'], gpe: ['gravitational potential', 'gpe'],
    ke: ['kinetic energy', 'ke'], spe: ['strain potential', 'spe', 'elastic potential'], spring: ['spring', 'hooke'], springs: ['spring', 'hooke'],
    hookes: ['hooke'], gamma: ['gamma', 'lorentz'], lorentz: ['lorentz', 'gamma'], satellite: ['satellite', 'orbit'], orbit: ['orbit', 'satellite'],
    banked: ['banked', 'bank'], banking: ['banked', 'bank'], commutator: ['commutator', 'split ring'], slip: ['slip'],
    photoelectric: ['photoelectric', 'work function'], ydse: ['double slit', 'young'], young: ['young', 'double slit'],
    debroglie: ['de broglie', 'broglie'], broglie: ['broglie'], impulse: ['impulse'], momentum: ['momentum'],
    projectile: ['projectile'], projectiles: ['projectile'], lift: ['lift', 'elevator', 'apparent weight'], elevator: ['lift', 'elevator', 'apparent weight'],
    weightless: ['weightless', 'apparent weight'], weightlessness: ['weightless', 'apparent weight'], pulley: ['pulley', 'atwood', 'tension'],
    atwood: ['atwood', 'pulley'], incline: ['incline', 'slope', 'ramp'], ramp: ['incline', 'ramp', 'slope'], slope: ['slope', 'incline'],
    voltage: ['voltage', 'potential difference'], emr: ['electromagnetic'], em: ['electromagnetic'], uncertainty: ['uncertainty', 'error'],
    error: ['error', 'uncertainty'], errors: ['error', 'uncertainty'], poster: ['poster'], generator: ['generator', 'alternator'], alternator: ['alternator', 'generator'],
    motor: ['motor'], transformer: ['transformer'], transformers: ['transformer'], transmission: ['transmission', 'power loss'],
    bungee: ['bungee', 'spring'], car: ['car', 'vehicle'], vehicle: ['vehicle', 'car'], muon: ['muon'], muons: ['muon'],
    mass: ['mass'], gravity: ['gravity', 'gravitational'], gravitational: ['gravitational', 'gravity'], field: ['field'], fields: ['field']
  };
  function buildIndex() {
    if (INDEX) return INDEX;
    INDEX = [];
    const tpl = document.createElement('template');
    G.topics.forEach(t => {
      const gp = t.groupObj ? t.groupObj.eyebrow : '';
      INDEX.push(mkEntry({ t: t.id, a: null, title: t.title, path: gp, text: t.summary + ' ' + (t.dotpoints || []).join(' '), kw: (t.keywords || []).join(' '), kind: 'topic' }));
      tpl.innerHTML = t.html;
      const f = tpl.content;
      $$('svg, .sim', f).forEach(x => x.remove());
      // sections by heading (walk top-level nodes)
      const used = {};
      let cur = { title: t.title, a: null, text: '' };
      const flush = () => { if (cur.a && cur.text.trim()) INDEX.push(mkEntry({ t: t.id, a: cur.a, title: cur.title, path: t.short || t.title, text: cur.text, kw: '', kind: cur.kind || 'section' })); else if (!cur.a && cur.text.trim()) INDEX[INDEX.length - 1].text += ' ' + cur.text; };
      Array.from(f.childNodes).forEach(node => {
        if (node.nodeType === 1 && /^H[23]$/.test(node.tagName)) {
          flush();
          const txt = node.textContent.trim();
          let s = slug(texToText(txt)); if (used[s]) { used[s]++; s += '-' + used[s]; } else used[s] = 1;
          cur = { title: texToText(txt).trim(), a: s, text: '', kind: 'section' };
        } else {
          cur.text += ' ' + (node.textContent || '');
        }
      });
      flush();
      // worked examples
      $$('.we', f).forEach((we, i) => {
        INDEX.push(mkEntry({ t: t.id, a: 'we-' + (i + 1), title: we.dataset.title || ('Worked example ' + (i + 1)), path: (t.short || t.title) + ' · worked example', text: we.textContent, kw: '', kind: 'example' }));
      });
      // glossary terms
      $$('dl.gloss dt', f).forEach(dt => {
        const dd = dt.nextElementSibling;
        INDEX.push(mkEntry({ t: t.id, a: 'term-' + slug(texToText(dt.textContent)), title: texToText(dt.textContent).trim(), path: 'Glossary', text: dd ? dd.textContent : '', kw: '', kind: 'term' }));
      });
      // formula cards
      $$('.fs-card', f).forEach(card => {
        const h = card.querySelector('h4');
        if (!h) return;
        INDEX.push(mkEntry({ t: t.id, a: 'fs-' + slug(h.textContent), title: h.textContent.trim(), path: 'Formula sheet', text: card.textContent, kw: card.dataset.kw || '', kind: 'formula' }));
      });
    });
    return INDEX;
  }
  function mkEntry(e) {
    e.text = texToText(e.text).replace(/\s+/g, ' ').trim();
    e.title = texToText(e.title).replace(/\s+/g, ' ').trim();
    e.nTitle = ' ' + norm(e.title) + ' ';
    e.nKw = ' ' + norm(e.kw) + ' ';
    e.nPath = ' ' + norm(e.path) + ' ';
    e.nText = ' ' + norm(e.text) + ' ';
    return e;
  }
  function countOcc(hay, needle) { let c = 0, i = 0; while ((i = hay.indexOf(needle, i)) !== -1 && c < 8) { c++; i += needle.length; } return c; }
  function search(qRaw) {
    const idx = buildIndex();
    const q = norm(qRaw);
    if (!q) return [];
    const toks = q.split(' ').filter(Boolean);
    // each token expands to alternatives; the typed word scores full weight, synonyms 60%
    const groups = toks.map(tk => {
      const alts = new Map([[tk, 1]]);
      if (tk.length > 4 && tk.endsWith('s')) alts.set(tk.slice(0, -1), 1);
      if (SYN[tk]) SYN[tk].forEach(a => { const n = norm(a); if (!alts.has(n)) alts.set(n, 0.6); });
      return Array.from(alts);
    });
    const phrase = ' ' + q;
    const res = [];
    for (const e of idx) {
      let score = 0, ok = true;
      for (const alts of groups) {
        let best = 0;
        for (const [a, w] of alts) {
          const n = ' ' + a;
          let sc = 0;
          if (e.nTitle.includes(n)) sc = 12;
          else if (e.nKw.includes(n)) sc = 8;
          else if (e.nPath.includes(n)) sc = 3;
          else { const c = countOcc(e.nText, n); if (c) sc = 1 + Math.min(c, 6) * 0.5; }
          best = Math.max(best, sc * w);
        }
        if (!best) { ok = false; break; }
        score += best;
      }
      if (!ok) continue;
      if (toks.length > 1 && e.nTitle.includes(phrase)) score += 12;
      else if (toks.length > 1 && e.nText.includes(phrase)) score += 5;
      score += { topic: 5, term: 4, formula: 3, example: 2, section: 2 }[e.kind] || 0;
      res.push({ e, score, alts: groups.flatMap(g => g.map(x => x[0])) });
    }
    res.sort((a, b) => b.score - a.score);
    return res.slice(0, 14);
  }
  function snippet(text, alts) {
    const low = text.toLowerCase();
    let pos = -1;
    for (const a of alts) { const i = low.indexOf(a); if (i !== -1 && (pos === -1 || i < pos)) pos = i; }
    let start = Math.max(0, pos - 60);
    let s = text.slice(start, start + 170);
    if (start > 0) s = '…' + s.replace(/^\S*\s/, '');
    if (start + 170 < text.length) s = s.replace(/\s\S*$/, '') + '…';
    let h = esc(s);
    const sorted = alts.filter(a => a.length > 1).sort((a, b) => b.length - a.length);
    if (sorted.length) {
      const re = new RegExp('(' + sorted.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
      h = h.replace(re, '<mark>$1</mark>');
    }
    return h;
  }
  function hl(text, alts) {
    let h = esc(text);
    const sorted = alts.filter(a => a.length > 1).sort((a, b) => b.length - a.length);
    if (!sorted.length) return h;
    const re = new RegExp('(' + sorted.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return h.replace(re, '<mark>$1</mark>');
  }

  /* search UI */
  const qEl = $('#q'), resEl = $('#results');
  let sel = -1, lastRes = [];
  const KIND = { topic: 'Topic', section: '', example: 'Worked example', term: 'Definition', formula: 'Formula' };
  function showResults() {
    const v = qEl.value.trim();
    if (!v) { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); return; }
    lastRes = search(v);
    sel = lastRes.length ? 0 : -1;
    if (!lastRes.length) {
      resEl.innerHTML = '<div class="empty">No matches for “' + esc(v) + '”. Try a broader word (e.g. “loop”, “flux”, “photon”) or check the spelling.</div>';
    } else {
      resEl.innerHTML = lastRes.map((r, i) => {
        const e = r.e;
        const t = byId[e.t];
        const href = '#' + e.t + (e.a ? '~' + e.a : '');
        const kind = KIND[e.kind] ? '<span class="r-kind">' + KIND[e.kind] + '</span>' : '';
        const path = e.kind === 'topic' ? (t.groupObj ? t.groupObj.eyebrow : '') : (t.short || t.title);
        return '<a class="r' + (i === sel ? ' sel' : '') + '" role="option" href="' + href + '" data-i="' + i + '">' +
          '<div class="r-path">' + esc(path) + '</div>' +
          '<div class="r-title">' + hl(e.title, r.alts) + kind + '</div>' +
          '<div class="r-snip">' + snippet(e.text, r.alts) + '</div></a>';
      }).join('') + '<div class="r-foot"><kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>';
    }
    resEl.hidden = false;
    qEl.setAttribute('aria-expanded', 'true');
  }
  function moveSel(d) {
    if (!lastRes.length) return;
    sel = (sel + d + lastRes.length) % lastRes.length;
    $$('.r', resEl).forEach((a, i) => a.classList.toggle('sel', i === sel));
    const a = $$('.r', resEl)[sel]; if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function closeSearch() { resEl.hidden = true; qEl.setAttribute('aria-expanded', 'false'); }
  let qTimer;
  qEl.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(showResults, 60); });
  qEl.addEventListener('focus', () => { buildIndex(); if (qEl.value.trim()) showResults(); });
  qEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const a = $$('.r', resEl)[sel];
      if (a) { go(a.getAttribute('href')); }
    } else if (e.key === 'Escape') { if (qEl.value) { qEl.value = ''; closeSearch(); } else { qEl.blur(); closeSearch(); } }
  });
  resEl.addEventListener('click', e => {
    const a = e.target.closest('.r'); if (!a) return;
    e.preventDefault(); go(a.getAttribute('href'));
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) closeSearch(); });
  document.addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault(); qEl.focus(); qEl.select();
    }
  });
  function go(href) {
    closeSearch(); qEl.blur(); closeNav();
    if (location.hash === href) route(); else location.hash = href;
  }

  /* ------------------------------------------------------------ nav drawer */
  const body = document.body;
  function openNav() { body.classList.add('nav-open'); $('#scrim').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); }
  function closeNav() { body.classList.remove('nav-open'); $('#scrim').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false'); }
  $('#menuBtn').addEventListener('click', () => body.classList.contains('nav-open') ? closeNav() : openNav());
  $('#scrim').addEventListener('click', closeNav);

  /* ------------------------------------------------------------ progress helpers */
  function progress() {
    const done = STUDY.filter(t => S.done[t.id]).length;
    const answered = Object.keys(S.mcq).length;
    const correct = Object.values(S.mcq).filter(v => v.ok).length;
    const review = Object.values(S.pq).filter(v => v === 'review').length + Object.values(S.mcq).filter(v => !v.ok).length;
    return { done, total: STUDY.length, answered, correct, review };
  }
  function updateReviewCount() {
    const p = progress();
    $('#reviewCount').textContent = p.review ? String(p.review) : '';
  }

  /* ------------------------------------------------------------ sidebar */
  function renderNav(activeId) {
    const p = progress();
    let h = '<div class="nav-progress"><div class="lbl"><span>Topics completed</span><b>' + p.done + ' / ' + p.total + '</b></div><div class="bar"><i style="width:' + (100 * p.done / p.total).toFixed(1) + '%"></i></div></div>';
    G.groups.forEach(g => {
      const collapsed = S.collapsed[g.id];
      h += '<div class="nav-group' + (collapsed ? ' collapsed' : '') + '" data-g="' + g.id + '">' +
        '<button class="nav-group-h" aria-expanded="' + (!collapsed) + '"><span class="nav-eyebrow"><span>' + esc(g.eyebrow) + '</span><span class="chev">▾</span></span>' +
        (g.title ? '<span class="nav-gtitle">' + esc(g.title) + '</span>' : '') + '</button><ul>';
      g.topics.forEach(id => {
        const t = byId[id]; if (!t) return;
        const dot = t.special ? '<span class="nav-dot" style="border-style:dashed"></span>' : '<span class="nav-dot' + (S.done[id] ? ' done' : '') + '"></span>';
        h += '<li><a href="#' + id + '" class="' + (id === activeId ? 'active' : '') + '">' + dot + '<span>' + esc(t.short || t.title) + '</span></a></li>';
      });
      h += '</ul></div>';
    });
    nav.innerHTML = h;
    $$('.nav-group-h', nav).forEach(b => b.addEventListener('click', () => {
      const g = b.parentElement; const id = g.dataset.g;
      g.classList.toggle('collapsed');
      S.collapsed[id] = g.classList.contains('collapsed'); save('collapsed');
      b.setAttribute('aria-expanded', String(!S.collapsed[id]));
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
    $$('aside[class^="c-"]', root).forEach(a => {
      const cfg = CALLOUT[a.className.split(' ')[0]]; if (!cfg) return;
      const lab = el('div', 'c-label', ICON[cfg[0]] + '<span>' + esc(a.dataset.title || cfg[1]) + '</span>');
      a.prepend(lab);
    });
  }

  function enhanceHeadings(root, topic) {
    const used = {};
    $$('.prose > h2, .prose > h3', root).forEach(h => {
      let s = slug(texToText(h.textContent)); if (used[s]) { used[s]++; s += '-' + used[s]; } else used[s] = 1;
      h.id = 'a-' + s;
      const b = el('button', 'anchor', '#'); b.type = 'button'; b.title = 'Copy link to this section'; b.setAttribute('aria-label', 'Copy link to this section');
      b.addEventListener('click', () => copyText(location.href.split('#')[0] + '#' + topic.id + '~' + s, 'Link to section copied'));
      h.prepend(b);
    });
    $$('dl.gloss dt', root).forEach(dt => { dt.id = 'a-term-' + slug(texToText(dt.textContent)); });
    $$('.fs-card', root).forEach(c => { const h = c.querySelector('h4'); if (h) c.id = 'a-fs-' + slug(h.textContent); });
  }

  function enhanceWorked(root) {
    $$('.we', root).forEach((we, i) => {
      we.id = 'a-we-' + (i + 1);
      const title = we.dataset.title || '';
      const marks = we.dataset.marks;
      const head = el('div', 'we-h', '<span class="we-tag">Worked example ' + (i + 1) + '</span><span class="we-title">' + title + '</span>' +
        (marks ? '<span class="marks">' + marks + ' mark' + (marks === '1' ? '' : 's') + '</span>' : ''));
      const steps = $$(':scope > .we-s, :scope > .we-a', we);
      const wrap = el('div', 'we-steps');
      let n = 0;
      steps.forEach(s => { if (s.classList.contains('we-s')) s.dataset.n = ++n; s.hidden = true; wrap.appendChild(s); });
      we.prepend(head);
      we.appendChild(wrap);
      const ctl = el('div', 'we-ctl');
      const bNext = el('button', 'btn primary'); bNext.type = 'button';
      const bAll = el('button', 'btn', 'Show full solution'); bAll.type = 'button';
      const bReset = el('button', 'btn ghost', 'Hide solution'); bReset.type = 'button';
      const cnt = el('span', 'step-count');
      ctl.append(bNext, bAll, bReset, cnt);
      we.appendChild(ctl);
      let shown = 0;
      const upd = () => {
        steps.forEach((s, k) => { s.hidden = k >= shown; });
        wrap.hidden = shown === 0;
        if (shown < steps.length) {
          bNext.hidden = false; bAll.hidden = false;
          bNext.textContent = steps[shown].classList.contains('we-a') ? 'Show answer' : (shown === 0 ? 'Try it, then show step 1' : 'Show step ' + (shown + 1));
        } else { bNext.hidden = true; bAll.hidden = true; }
        bReset.hidden = shown === 0;
        cnt.textContent = shown ? shown + ' / ' + steps.length + ' shown' : steps.length + ' steps';
      };
      bNext.addEventListener('click', () => { shown = Math.min(steps.length, shown + 1); upd(); const s = steps[shown - 1]; if (s) s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
      bAll.addEventListener('click', () => { shown = steps.length; upd(); });
      bReset.addEventListener('click', () => { shown = 0; upd(); we.scrollIntoView({ block: 'nearest' }); });
      upd();
    });
  }

  function mcqHead(label, level) {
    return '<span class="pq-tag">' + label + '</span><span class="lvl lvl-' + level + '">' + (LEVEL[level] || level) + '</span><span class="marks">Multiple choice · 1 mark</span>';
  }
  // Turns a raw .mcq element into an interactive one. onAnswer(ok, choice)
  function enhanceMCQ(m, label, key, onAnswer) {
    const ans = (m.dataset.ans || 'A').trim().toUpperCase();
    const level = m.dataset.level || 'core';
    const q = $('.mcq-q', m);
    const ol = $(':scope > ol', m);
    const x = $('.mcq-x', m);
    const head = el('div', 'pq-h', mcqHead(label, level));
    m.prepend(head);
    const opts = el('div', 'mcq-opts');
    const items = ol ? $$(':scope > li', ol) : [];
    const btns = items.map((li, i) => {
      const L = String.fromCharCode(65 + i);
      const b = el('button', 'opt', '<span class="L">' + L + '</span><span>' + li.innerHTML + '</span>');
      b.type = 'button'; b.dataset.l = L;
      opts.appendChild(b);
      return b;
    });
    if (ol) ol.replaceWith(opts); else m.appendChild(opts);
    if (x) { x.hidden = true; m.appendChild(x); }
    const verdict = el('div', 'mcq-verdict');
    if (x) x.prepend(verdict);
    const reveal = (choice) => {
      btns.forEach(b => {
        b.disabled = true;
        if (b.dataset.l === ans) b.classList.add('correct');
        else if (b.dataset.l === choice) b.classList.add('wrong');
      });
      const ok = choice === ans;
      verdict.className = 'mcq-verdict ' + (ok ? 'ok' : 'no');
      verdict.textContent = ok ? 'Correct — ' + ans + '.' : 'Not quite. You chose ' + choice + '; the answer is ' + ans + '.';
      if (x) x.hidden = false;
      return ok;
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const ok = reveal(b.dataset.l);
      if (key) { S.mcq[key] = { ok, c: b.dataset.l, t: Date.now() }; save('mcq'); updateReviewCount(); }
      if (onAnswer) onAnswer(ok, b.dataset.l);
    }));
    // retry control
    if (key) {
      const again = el('button', 'btn ghost', 'Try again'); again.type = 'button'; again.style.margin = '0 16px 14px';
      again.hidden = true;
      m.appendChild(again);
      btns.forEach(b => b.addEventListener('click', () => { again.hidden = false; }));
      again.addEventListener('click', () => {
        btns.forEach(b => { b.disabled = false; b.classList.remove('correct', 'wrong'); });
        if (x) x.hidden = true; again.hidden = true;
      });
    }
  }

  function enhanceQuestions(root, topic) {
    let n = 0;
    $$('.mcq, .pq', root).forEach(q => {
      n++;
      const key = topic.id + ':q' + n;
      q.id = 'a-q' + n;
      if (q.classList.contains('mcq')) { enhanceMCQ(q, 'Question ' + n, key); return; }
      // practice (short answer)
      const level = q.dataset.level || 'core';
      const marks = q.dataset.marks;
      const head = el('div', 'pq-h', '<span class="pq-tag">Question ' + n + '</span><span class="lvl lvl-' + level + '">' + (LEVEL[level] || level) + '</span>' +
        (marks ? '<span class="marks">' + marks + ' mark' + (marks === '1' ? '' : 's') + '</span>' : ''));
      q.prepend(head);
      const sols = $$(':scope > .pq-s', q);
      sols.forEach(s => { s.hidden = true; });
      const ctl = el('div', 'pq-ctl');
      const bShow = el('button', 'btn primary', 'Reveal solution'); bShow.type = 'button';
      const sm = el('div', 'selfmark', '<span>How did you go?</span>');
      const bOk = el('button', 'btn', 'Got it'); bOk.type = 'button';
      const bRv = el('button', 'btn', 'Review later'); bRv.type = 'button';
      sm.append(bOk, bRv);
      ctl.append(bShow, sm);
      q.appendChild(ctl);
      const paint = () => {
        const st = S.pq[key];
        bOk.classList.toggle('on-good', st === 'ok');
        bRv.classList.toggle('on-bad', st === 'review');
        q.classList.toggle('state-ok', st === 'ok');
        q.classList.toggle('state-review', st === 'review');
      };
      let open = false;
      bShow.addEventListener('click', () => {
        open = !open;
        sols.forEach(s => { s.hidden = !open; });
        bShow.textContent = open ? 'Hide solution' : 'Reveal solution';
        bShow.classList.toggle('primary', !open);
      });
      const setSt = v => { S.pq[key] = S.pq[key] === v ? undefined : v; if (!S.pq[key]) delete S.pq[key]; save('pq'); paint(); updateReviewCount(); };
      bOk.addEventListener('click', () => setSt('ok'));
      bRv.addEventListener('click', () => setSt('review'));
      paint();
    });
  }

  /* sims */
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
    const hs = $$('.prose > h2', main);
    if (hs.length < 2) { toc.innerHTML = ''; return; }
    toc.innerHTML = '<h4>On this page</h4>' + hs.map(h => '<a href="#" data-id="' + h.id + '">' + esc(h.textContent.replace(/^#/, '')) + '</a>').join('');
    // math in TOC labels is already plain text via textContent of rendered KaTeX (may duplicate); use data attr fallback
    $$('a', toc).forEach((a, i) => {
      const h = hs[i];
      const clone = h.cloneNode(true);
      $$('.anchor, .katex-mathml', clone).forEach(x => x.remove());
      a.textContent = clone.textContent.trim();
      a.addEventListener('click', e => { e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    });
    if ('IntersectionObserver' in window) {
      tocObs = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            $$('a', toc).forEach(a => a.classList.toggle('active', a.dataset.id === en.target.id));
          }
        });
      }, { rootMargin: '-10% 0px -75% 0px' });
      hs.forEach(h => tocObs.observe(h));
    }
  }

  /* ------------------------------------------------------------ topic render */
  function chipsFor(t) {
    const c = TOPIC_Q[t.id] || {};
    const out = [];
    if (c.we) out.push('<span class="chip"><b>' + c.we + '</b> worked example' + (c.we > 1 ? 's' : '') + '</span>');
    if (c.pq || c.mcq) out.push('<span class="chip"><b>' + (c.pq + c.mcq) + '</b> practice questions</span>');
    if (c.trick) out.push('<span class="chip trap"><b>' + c.trick + '</b> traps flagged</span>');
    if (c.sims) out.push('<span class="chip"><b>' + c.sims + '</b> interactive' + (c.sims > 1 ? 's' : '') + '</span>');
    return out.join('');
  }
  function headHTML(t) {
    const g = t.groupObj;
    let h = '<header class="t-head"><div class="eyebrow">' + esc(g ? g.eyebrow : '') + '</div><h1>' + t.title + '</h1>';
    if (t.summary) h += '<p class="t-summary">' + t.summary + '</p>';
    h += '<div class="chips">' + chipsFor(t) + '</div>';
    if (t.dotpoints && t.dotpoints.length) {
      h += '<details class="dotpoints"><summary>Study design key knowledge covered<span>VCAA 2024–2027</span></summary><ul>' +
        t.dotpoints.map(d => '<li>' + d + '</li>').join('') + '</ul></details>';
    }
    return h + '</header>';
  }
  function footHTML(t) {
    const i = ORDER.indexOf(t);
    const prev = ORDER[i - 1], next = ORDER[i + 1];
    let h = '<footer class="t-foot">';
    if (!t.special) {
      h += '<div class="complete-card"><p>' + (S.done[t.id] ? 'You marked this topic as complete.' : 'Finished the explanations and questions? Mark this topic off on your course map.') + '</p>' +
        '<button class="btn ' + (S.done[t.id] ? 'on-good' : 'primary') + '" id="doneBtn" type="button">' + (S.done[t.id] ? '✓ Completed' : 'Mark topic complete') + '</button></div>';
    }
    h += '<nav class="pn" aria-label="Previous and next topics">';
    if (prev) h += '<a href="#' + prev.id + '"><div class="dir">← Previous</div><div class="tt">' + esc(prev.short || prev.title) + '</div></a>';
    if (next) h += '<a class="next" href="#' + next.id + '"><div class="dir">Next →</div><div class="tt">' + esc(next.short || next.title) + '</div></a>';
    return h + '</nav></footer>';
  }

  function render(t, anchor) {
    runCleanups();
    let html = '';
    if (t.special === 'home') html = '<div class="home-wrap"><div class="prose" id="prose">' + t.html + '</div></div>';
    else html = headHTML(t) + '<div class="prose" id="prose">' + t.html + '</div>' + footHTML(t);
    main.innerHTML = html;
    enhanceHeadings(main, t);
    enhanceCallouts(main);
    enhanceWorked(main);
    enhanceQuestions(main, t);
    fillSlots(main, t);
    renderMath(main);
    mountSims(main);
    buildToc();
    renderNav(t.id);
    document.title = t.special === 'home' ? SITE : (t.short || t.title).replace(/<[^>]+>/g, '') + ' · ' + SITE;
    const db = $('#doneBtn');
    if (db) db.addEventListener('click', () => {
      if (S.done[t.id]) delete S.done[t.id]; else S.done[t.id] = true;
      save('done');
      const on = !!S.done[t.id];
      db.className = 'btn ' + (on ? 'on-good' : 'primary');
      db.textContent = on ? '✓ Completed' : 'Mark topic complete';
      db.previousElementSibling.textContent = on ? 'You marked this topic as complete.' : 'Finished the explanations and questions? Mark this topic off on your course map.';
      renderNav(t.id);
      if (on) toast('Topic marked complete');
    });
    // scroll
    if (anchor) {
      const target = document.getElementById('a-' + anchor);
      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'start' });
          target.classList.add('flash');
          setTimeout(() => target.classList.remove('flash'), 1700);
        });
        return;
      }
    }
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ slots: home, gauntlet, review */
  function fillSlots(root, t) {
    $$('[data-slot]', root).forEach(s => {
      const k = s.dataset.slot;
      if (k === 'map') s.innerHTML = mapHTML();
      else if (k === 'stats') s.innerHTML = statsHTML();
      else if (k === 'gauntlet') mountGauntlet(s);
      else if (k === 'review') mountReview(s);
      else if (k === 'resume') s.innerHTML = resumeHTML();
    });
  }
  function resumeHTML() {
    const next = STUDY.find(x => !S.done[x.id]) || STUDY[0];
    return '<a class="btn primary" href="#' + next.id + '">' + (progress().done ? 'Continue: ' : 'Start: ') + esc(next.short || next.title) + ' →</a>';
  }
  function mapHTML() {
    return '<div class="map">' + G.groups.filter(g => g.map !== false).map(g => {
      const ts = g.topics.map(id => byId[id]).filter(Boolean);
      const study = ts.filter(x => !x.special);
      const d = study.filter(x => S.done[x.id]).length;
      return '<div class="map-card"><div class="eyebrow">' + esc(g.eyebrow) + '</div><h3>' + esc(g.title || '') + '</h3>' +
        (study.length ? '<div class="bar" title="' + d + ' of ' + study.length + ' complete"><i style="width:' + (study.length ? 100 * d / study.length : 0) + '%"></i></div>' : '') +
        '<ul>' + ts.map(x => '<li><a href="#' + x.id + '"><span class="nav-dot' + (S.done[x.id] ? ' done' : '') + '"' + (x.special ? ' style="border-style:dashed"' : '') + '></span><span>' + esc(x.short || x.title) + '</span></a></li>').join('') + '</ul></div>';
    }).join('') + '</div>';
  }
  function statsHTML() {
    const p = progress();
    const acc = p.answered ? Math.round(100 * p.correct / p.answered) + '%' : '—';
    return '<div class="stats">' +
      '<div class="stat"><span>Topics complete</span><b>' + p.done + '/' + p.total + '</b></div>' +
      '<div class="stat"><span>MCQs answered</span><b>' + p.answered + '</b></div>' +
      '<div class="stat"><span>MCQ accuracy</span><b>' + acc + '</b></div>' +
      '<div class="stat"><span>Flagged for review</span><b>' + p.review + '</b></div>' +
      '<div class="stat"><span>Question bank</span><b>' + (BANK.mcq.length + BANK.pq.length) + '</b></div></div>';
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function mountGauntlet(slot) {
    const groups = G.groups.filter(g => g.quiz);
    const cfg = store.get('gz', { groups: groups.map(g => g.id), mode: 'trick', n: 10 });
    const render0 = () => {
      slot.innerHTML =
        '<div class="gz-setup">' +
        '<div class="gz-row"><label>Areas of study</label>' + groups.map(g => '<label class="pill"><input type="checkbox" value="' + g.id + '"' + (cfg.groups.includes(g.id) ? ' checked' : '') + '> ' + esc(g.eyebrow) + '</label>').join('') + '</div>' +
        '<div class="gz-row"><label>Question type</label>' +
        ['trick|Trick questions only', 'hard|Hard + trick', 'all|Everything'].map(s => { const [v, l] = s.split('|'); return '<label class="pill"><input type="radio" name="gzmode" value="' + v + '"' + (cfg.mode === v ? ' checked' : '') + '> ' + l + '</label>'; }).join('') + '</div>' +
        '<div class="gz-row"><label>Length</label>' +
        [5, 10, 20, 40].map(v => '<label class="pill"><input type="radio" name="gzn" value="' + v + '"' + (cfg.n === v ? ' checked' : '') + '> ' + v + ' questions</label>').join('') + '</div>' +
        '<div class="gz-row"><button class="btn primary" type="button" id="gzGo">Start the gauntlet</button><span class="gz-avail" style="font-size:14px;color:var(--muted)"></span></div>' +
        '</div>';
      const avail = $('.gz-avail', slot);
      const read = () => {
        cfg.groups = $$('input[type=checkbox]:checked', slot).map(i => i.value);
        cfg.mode = ($('input[name=gzmode]:checked', slot) || {}).value || 'trick';
        cfg.n = +(($('input[name=gzn]:checked', slot) || {}).value || 10);
        store.set('gz', cfg);
        const pool = poolFor(cfg);
        avail.textContent = pool.length + ' questions match these settings.';
        return pool;
      };
      slot.addEventListener('change', read);
      read();
      $('#gzGo', slot).addEventListener('click', () => {
        const pool = read();
        if (!pool.length) { toast('No questions match — widen your selection'); return; }
        run(shuffle(pool.slice()).slice(0, cfg.n));
      });
    };
    const poolFor = c => {
      const ok = new Set();
      groups.filter(g => c.groups.includes(g.id)).forEach(g => g.topics.forEach(id => ok.add(id)));
      return BANK.mcq.filter(q => ok.has(q.t) && (c.mode === 'all' || q.level === 'trick' || (c.mode === 'hard' && q.level === 'hard')));
    };
    const run = qs => {
      let i = 0, score = 0;
      const wrong = [];
      const step = () => {
        if (i >= qs.length) return finish();
        const q = qs[i];
        const t = byId[q.t];
        slot.innerHTML = '<div class="gz-bar"><span>Question <b>' + (i + 1) + '</b> of ' + qs.length + '</span><span>Score <b>' + score + '</b></span><button class="btn ghost" type="button" id="gzQuit">End quiz</button></div><div class="gz-q"></div>';
        const holder = $('.gz-q', slot);
        holder.innerHTML = q.html;
        const m = holder.firstElementChild;
        enhanceMCQ(m, 'Q' + (i + 1), q.t + ':q' + q.n, ok => {
          if (ok) score++; else wrong.push(q);
          const sb = $$('.gz-bar b', slot)[1]; if (sb) sb.textContent = score;
          const nb = el('div', 'pq-ctl');
          const b = el('button', 'btn primary', i + 1 < qs.length ? 'Next question →' : 'See results'); b.type = 'button';
          nb.appendChild(b); m.appendChild(nb);
          b.addEventListener('click', () => { i++; step(); window.scrollTo({ top: slot.offsetTop - 80 }); });
          b.focus({ preventScroll: true });
        });
        const src = el('div', 'gz-src', 'From: <a href="#' + q.t + '~q' + q.n + '">' + esc(t.short || t.title) + '</a>');
        m.appendChild(src);
        renderMath(holder);
        $('#gzQuit', slot).addEventListener('click', finish);
      };
      const finish = () => {
        const answered = Math.min(i + (i < qs.length && slot.querySelector('.opt[disabled]') ? 1 : 0), qs.length);
        const pct = answered ? Math.round(100 * score / answered) : 0;
        slot.innerHTML = '<div class="gz-result"><div class="eyebrow">Gauntlet complete</div><div class="big">' + score + '/' + answered + '</div><p style="margin:10px 0 16px;color:var(--ink-2)">' +
          (answered === 0 ? 'No questions answered.' : pct >= 85 ? 'Brutal set and you survived it. Examiners would struggle to trap you.' : pct >= 60 ? 'Solid, but a few traps got you. Read the explanations for the ones you missed.' : 'The traps won this round. Revisit the flagged topics below, then run it again.') +
          '</p><div class="sim-btns" style="justify-content:center"><button class="btn primary" type="button" id="gzAgain">New gauntlet</button><a class="btn" href="#review">Open review list</a></div></div>' +
          (wrong.length ? '<h3>Missed questions</h3><div class="rv-list">' + wrong.map(q => '<div class="rv-item"><a href="#' + q.t + '~q' + q.n + '">' + esc(byId[q.t].short || byId[q.t].title) + ' · Question ' + q.n + '</a></div>').join('') + '</div>' : '');
        $('#gzAgain', slot).addEventListener('click', render0);
        updateReviewCount();
      };
      step();
    };
    render0();
  }

  function mountReview(slot) {
    const items = [];
    Object.entries(S.pq).forEach(([k, v]) => { if (v === 'review') items.push({ k, type: 'Short answer' }); });
    Object.entries(S.mcq).forEach(([k, v]) => { if (!v.ok) items.push({ k, type: 'Multiple choice (answered wrong)' }); });
    if (!items.length) {
      slot.innerHTML = '<aside class="c-key"><div class="c-label">' + ICON.key + '<span>Nothing flagged yet</span></div><p>When you press <strong>Review later</strong> on a practice question, or get a multiple-choice question wrong, it lands here so you can come back to it before the exam.</p></aside>';
      return;
    }
    const byTopic = {};
    items.forEach(it => { const [tid, qn] = it.k.split(':'); (byTopic[tid] = byTopic[tid] || []).push(Object.assign(it, { tid, qn })); });
    let h = '<p>' + items.length + ' question' + (items.length > 1 ? 's' : '') + ' flagged. Redo each one without looking at the solution, then clear it.</p>';
    ORDER.forEach(t => {
      const list = byTopic[t.id]; if (!list) return;
      h += '<h3>' + esc(t.short || t.title) + '</h3><div class="rv-list">' + list.sort((a, b) => parseInt(a.qn.slice(1)) - parseInt(b.qn.slice(1))).map(it =>
        '<div class="rv-item"><a href="#' + t.id + '~' + it.qn + '">Question ' + it.qn.slice(1) + '</a><span class="meta">' + it.type + '</span><button class="btn" type="button" data-k="' + it.k + '">Clear</button></div>').join('') + '</div>';
    });
    h += '<div style="margin-top:18px"><button class="btn ghost" type="button" id="rvClearAll">Clear the whole list</button></div>';
    slot.innerHTML = h;
    slot.addEventListener('click', e => {
      const b = e.target.closest('button[data-k]');
      if (b) {
        const k = b.dataset.k;
        if (S.pq[k] === 'review') { delete S.pq[k]; save('pq'); }
        if (S.mcq[k] && !S.mcq[k].ok) { delete S.mcq[k]; save('mcq'); }
        updateReviewCount(); mountReview(slot);
      }
      if (e.target.id === 'rvClearAll') {
        const b2 = e.target;
        if (b2.dataset.confirm) {
          Object.keys(S.pq).forEach(k => { if (S.pq[k] === 'review') delete S.pq[k]; });
          Object.keys(S.mcq).forEach(k => { if (!S.mcq[k].ok) delete S.mcq[k]; });
          save('pq'); save('mcq'); updateReviewCount(); mountReview(slot);
        } else { b2.dataset.confirm = '1'; b2.textContent = 'Press again to confirm'; b2.classList.add('on-bad'); }
      }
    });
  }

  /* ------------------------------------------------------------ router */
  function parseHash() {
    let h = location.hash.replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    const i = h.indexOf('~');
    return i === -1 ? { t: h, a: null } : { t: h.slice(0, i), a: h.slice(i + 1) };
  }
  let currentId = null;
  function route() {
    const { t, a } = parseHash();
    const topic = byId[t] || byId.home || ORDER[0];
    if (topic.id === currentId && a) {
      const target = document.getElementById('a-' + a);
      if (target) { target.scrollIntoView({ block: 'start' }); target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 1700); return; }
    }
    currentId = topic.id;
    render(topic, a);
    if (!a) main.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);
  window.GUIDE_APP = { go, renderMath, toast, isDark, store };
  updateReviewCount();
  route();
  // warm the search index when idle
  (window.requestIdleCallback || function (f) { return setTimeout(f, 800); })(() => buildIndex());
})();
