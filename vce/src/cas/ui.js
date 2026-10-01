/* ==========================================================================
   Pop-up CAS calculator: calculator history, graphing, command help.
   Uses window.CASEngine (engine.js) on a fresh nerdamer from window.__nerdamerFactory
   (embedded build) or the jsdelivr copy (artifact build). Practice tool only.
   ========================================================================== */
(function () {
  'use strict';
  const btn = document.getElementById('casBtn');
  if (!btn || typeof window.CASEngine !== 'function') return;

  const KEY = 'vce-cas-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const saved = load();
  const S = {
    hist: Array.isArray(saved.hist) ? saved.hist.slice(-120) : [],
    defs: saved.defs || {}, vars: saved.vars || {},
    mode: saved.mode === 'approx' ? 'approx' : 'auto', angle: saved.angle === 'deg' ? 'deg' : 'rad',
    fns: Array.isArray(saved.fns) && saved.fns.length === 4 ? saved.fns : [{ e: '', on: true }, { e: '', on: true }, { e: '', on: true }, { e: '', on: true }],
    view: saved.view && isFinite(saved.view.xmin) ? saved.view : { xmin: -10, xmax: 10, ymin: -7, ymax: 7 },
    pos: saved.pos || null, tab: saved.tab || 'calc', cat: saved.cat || 'alg'
  };
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ hist: S.hist.slice(-120), defs: E ? E.state.defs : S.defs, vars: E ? E.state.vars : S.vars, mode: S.mode, angle: S.angle,
        fns: S.fns, view: S.view, pos: S.pos, tab: S.tab, cat: S.cat }));
    } catch (e) { /* storage blocked: still works for this visit */ }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const K = (tex, display) => {
    try { return window.katex ? window.katex.renderToString(tex, { throwOnError: false, displayMode: !!display }) : esc(tex); } catch (e) { return esc(tex); }
  };

  // ------------------------------------------------------------ engine boot (lazy)
  let E = null, booting = null;
  function freshNerdamer() {
    if (typeof window.__nerdamerFactory === 'function') return window.__nerdamerFactory.call(window);
    return null;
  }
  function boot() {
    if (E) return Promise.resolve(E);
    if (booting) return booting;
    booting = new Promise((resolve, reject) => {
      const go = nd => {
        try {
          E = window.CASEngine(nd, typeof window.__nerdamerFactory === 'function' ? freshNerdamer : null);
          E.setAngle(S.angle); E.setMode(S.mode); E.restore(S.defs, S.vars);
          resolve(E);
        } catch (err) { reject(err); }
      };
      const nd = freshNerdamer();
      if (nd) { go(nd); return; }
      if (window.nerdamer) { go(window.nerdamer); return; }
      const sc = document.createElement('script');
      sc.src = document.documentElement.getAttribute('data-nerdamer') || 'https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/all.min.js';
      sc.onload = () => window.nerdamer ? go(window.nerdamer) : reject(new Error('nerdamer did not load'));
      sc.onerror = () => reject(new Error('Could not load the algebra library (offline?)'));
      document.head.appendChild(sc);
    });
    booting.catch(() => { booting = null; });
    return booting;
  }

  // ------------------------------------------------------------ templates + signatures
  const CATS = [
    ['alg', 'Algebra', [['solve(|,x)', 'solve'], ['nSolve(|,x)', 'nSolve'], ['solve({|,},{x,y})', 'solve system'], ['zeros(|,x)', 'zeros'], ['factor(|)', 'factor'],
      ['expand(|)', 'expand'], ['simplify(|)', 'simplify'], ['define f(x)=|', 'define f(x)'], ['|→a', 'store →'], ['delvar |', 'delvar']]],
    ['calc', 'Calculus', [['d/dx(|)', 'd/dx'], ['derivative(|,x,2)', 'd²/dx²'], ['∫(|,x)', '∫ indefinite'], ['∫(|,x,,)', '∫ definite'], ['limit(|,x,)', 'limit'],
      ['fMin(|,x)', 'fMin'], ['fMax(|,x)', 'fMax'], ['tangentLine(|,x,)', 'tangentLine'], ['normalLine(|,x,)', 'normalLine']]],
    ['prob', 'Probability', [['normCdf(|)', 'normCdf'], ['invNorm(|)', 'invNorm'], ['normPdf(|)', 'normPdf'], ['binomPdf(|)', 'binomPdf'], ['binomCdf(|)', 'binomCdf'],
      ['invBinom(|)', 'invBinom'], ['poissPdf(|)', 'poissPdf'], ['poissCdf(|)', 'poissCdf'], ['nCr(|)', 'nCr'], ['nPr(|)', 'nPr'], ['|!', 'x!'], ['zInterval_1Prop(|)', 'zInterval 1-prop']]],
    ['stat', 'Stats', [['mean({|})', 'mean'], ['median({|})', 'median'], ['stDevSamp({|})', 'stDevSamp'], ['stDevPop({|})', 'stDevPop'], ['varSamp({|})', 'varSamp'],
      ['sum({|})', 'sum'], ['min({|})', 'min'], ['max({|})', 'max']]],
    ['fn', 'Functions', [['sin(|)', 'sin'], ['cos(|)', 'cos'], ['tan(|)', 'tan'], ['sin^-1(|)', 'sin⁻¹'], ['cos^-1(|)', 'cos⁻¹'], ['tan^-1(|)', 'tan⁻¹'], ['ln(|)', 'ln'],
      ['log(|)', 'log₁₀'], ['log(|,)', 'log_b'], ['e^(|)', 'eˣ'], ['√(|)', '√'], ['∛(|)', '∛'], ['abs(|)', '|x|']]],
    ['mat', 'Matrix', [['[|,;,]', '2×2'], ['[|,,;,,;,,]', '3×3'], ['det(|)', 'det'], ['transpose(|)', 'transpose'], ['^(-1)|', 'inverse']]],
    ['sym', 'Symbols', [['π', 'π'], ['e', 'e'], ['∞', '∞'], ['≤', '≤'], ['≥', '≥'], ['≠', '≠'], [' | ', '| (with)'], [' and ', 'and'], [':=', ':='], ['θ', 'θ'], ['°', '°'], ['{|}', '{ }'], ['[|]', '[ ]'], ['ans', 'ans']]]
  ];
  const QUICK = [['x', 'x'], ['^', '^'], ['(|)', '( )'], [',', ','], ['=', '='], [' | ', '|'], ['π', 'π'], ['√(|)', '√'], ['e^(|)', 'eˣ'], ['ln(|)', 'ln'], ['ans', 'ans']];
  const SIG = {
    solve: 'solve(equation, x)  ·  add | 0≤x≤2π for a domain  ·  {eq1,eq2},{x,y} for a system', nsolve: 'nSolve(equation, x[, guess])  ·  | a≤x≤b to pick a root',
    zeros: 'zeros(expression, x)', factor: 'factor(expression)', expand: 'expand(expression)', simplify: 'simplify(expression)',
    derivative: 'derivative(f, x[, order])', d: 'd(f, x)', diff: 'diff(f, x)', integral: '∫(f, x)  or  ∫(f, x, lower, upper)', limit: 'limit(f, x, point[, 1 right | -1 left])',
    fmin: 'fMin(f, x)  ·  | a≤x≤b', fmax: 'fMax(f, x)  ·  | a≤x≤b', tangentline: 'tangentLine(f, x, point)', normalline: 'normalLine(f, x, point)',
    normcdf: 'normCdf(lower, upper[, μ, σ])', normpdf: 'normPdf(x[, μ, σ])', invnorm: 'invNorm(area to the LEFT[, μ, σ])', binompdf: 'binomPdf(n, p[, x])',
    binomcdf: 'binomCdf(n, p, lower, upper)  or  binomCdf(n, p, upper)', invbinom: 'invBinom(area, n, p)', poisspdf: 'poissPdf(λ, x)', poisscdf: 'poissCdf(λ, lower, upper)',
    ncr: 'nCr(n, r)', npr: 'nPr(n, r)', zinterval_1prop: 'zInterval_1Prop(successes, n[, C-level])', mean: 'mean({list})', median: 'median({list})',
    stdevsamp: 'stDevSamp({list})', stdevpop: 'stDevPop({list})', varsamp: 'varSamp({list})', varpop: 'varPop({list})', sum: 'sum({list})', det: 'det(matrix)',
    transpose: 'transpose(matrix)', log: 'log(x) is base 10  ·  log(x, b) is base b  ·  use ln(x) for base e', ln: 'ln(x): natural log', define: 'define f(x)=expression'
  };

  // ------------------------------------------------------------ DOM
  const root = document.createElement('div');
  root.className = 'cas'; root.id = 'cas'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'CAS calculator');
  const catBtns = CATS.map(([id, name]) => '<button type="button" role="tab" data-cat="' + id + '">' + name + '</button>').join('');
  const quick = QUICK.map(([t, l]) => '<button type="button" data-ins="' + esc(t) + '">' + esc(l) + '</button>').join('');
  root.innerHTML =
    '<div class="cas-bar">' +
      '<span class="cas-grip" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 6.5h7M8.5 11h1M12 11h0M15.5 11h0M8.5 14.5h1M12 14.5h0M15.5 14.5h0M8.5 18h1M12 18h0M15.5 18h0"/></svg></span>' +
      '<strong class="cas-title">CAS</strong>' +
      '<div class="cas-tabs" role="tablist" aria-label="Calculator views">' +
        '<button type="button" role="tab" data-tab="calc">Calculator</button><button type="button" role="tab" data-tab="graph">Graph</button><button type="button" role="tab" data-tab="help">Help</button>' +
      '</div>' +
      '<button type="button" class="cas-x" aria-label="Close calculator" title="Close (Esc)">&times;</button>' +
    '</div>' +
    '<div class="cas-modes">' +
      '<div class="cas-seg" data-k="mode" role="group" aria-label="Result mode"><button type="button" data-v="auto" title="Exact answers unless you type a decimal">Auto</button><button type="button" data-v="approx" title="Always give decimals">Approx</button></div>' +
      '<div class="cas-seg" data-k="angle" role="group" aria-label="Angle mode"><button type="button" data-v="rad">Rad</button><button type="button" data-v="deg">Deg</button></div>' +
      '<span class="cas-sp"></span>' +
      '<button type="button" class="cas-mini" data-act="vars" aria-expanded="false">Vars</button>' +
      '<button type="button" class="cas-mini" data-act="clear" title="Clear the history (definitions stay)">Clear</button>' +
    '</div>' +
    '<div class="cas-varbox" hidden></div>' +
    '<section class="cas-pane" data-pane="calc">' +
      '<ol class="cas-hist" aria-live="polite"></ol>' +
      '<div class="cas-sig" aria-live="polite"></div>' +
      '<div class="cas-entry">' +
        '<textarea rows="1" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" aria-label="Expression to evaluate" placeholder="solve(x^2-5x+6=0,x)"></textarea>' +
        '<button type="button" class="cas-go" title="Evaluate (Enter)" aria-label="Evaluate">=</button>' +
        '<button type="button" class="cas-ap" title="Approximate (Ctrl+Enter)" aria-label="Evaluate as a decimal">≈</button>' +
      '</div>' +
      '<div class="cas-quick">' + quick + '</div>' +
      '<div class="cas-pad"><div class="cas-cats" role="tablist" aria-label="Templates">' + catBtns + '</div><div class="cas-keys"></div></div>' +
    '</section>' +
    '<section class="cas-pane" data-pane="graph" hidden>' +
      '<div class="cas-gfns">' + [0, 1, 2, 3].map(i =>
        '<label class="cas-gf"><input type="checkbox" data-on="' + i + '" aria-label="Show f' + (i + 1) + '"><span class="cas-sw" style="--c:var(--g' + i + ')"></span>' +
        '<span class="cas-gl">f' + (i + 1) + '(x)=</span><input type="text" data-f="' + i + '" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="' + ['x^2-4', 'sin(x)', '', ''][i] + '"></label>').join('') + '</div>' +
      '<div class="cas-gtools">' +
        '<button type="button" data-g="in" aria-label="Zoom in">+</button><button type="button" data-g="out" aria-label="Zoom out">−</button>' +
        '<button type="button" data-g="std" title="x and y from -10 to 10">Std</button><button type="button" data-g="trig" title="x from -2π to 2π">Trig</button><button type="button" data-g="fit" title="Fit y to the curves">Fit</button>' +
        '<span class="cas-sp"></span>' +
        '<select data-g="which" aria-label="Function to analyse"><option value="0">f1</option><option value="1">f2</option><option value="2">f3</option><option value="3">f4</option></select>' +
        '<button type="button" data-g="zeros">Zeros</button><button type="button" data-g="ext">Min/Max</button><button type="button" data-g="int" title="Intersections of all shown curves" aria-label="Intersections">∩</button>' +
      '</div>' +
      '<div class="cas-gwrap"><canvas aria-label="Graph"></canvas><div class="cas-gread" aria-live="polite"></div></div>' +
      '<div class="cas-gpts" aria-live="polite"></div>' +
      '<p class="cas-gwin"></p>' +
    '</section>' +
    '<section class="cas-pane cas-help" data-pane="help" hidden></section>' +
    '<p class="cas-legal">Practice CAS, not a TI product. It is not exam-approved: VCAA exams need your own approved calculator.</p>';
  document.body.appendChild(root);

  const $ = s => root.querySelector(s);
  const hist = $('.cas-hist'), ta = $('textarea'), sig = $('.cas-sig'), keys = $('.cas-keys'), varbox = $('.cas-varbox');
  const canvas = $('canvas'), gread = $('.cas-gread'), gpts = $('.cas-gpts'), gwin = $('.cas-gwin');

  // ------------------------------------------------------------ open / close / drag
  let open = false;
  function place() {
    if (window.innerWidth <= 720) { root.style.left = root.style.top = ''; return; }
    const w = root.offsetWidth, h = root.offsetHeight;
    let x = S.pos ? S.pos.x : window.innerWidth - w - 24, y = S.pos ? S.pos.y : Math.max(70, window.innerHeight - h - 24);
    x = Math.min(Math.max(8, x), window.innerWidth - w - 8); y = Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8));
    root.style.left = x + 'px'; root.style.top = y + 'px';
  }
  function show(v) {
    open = v; root.hidden = !v; btn.setAttribute('aria-expanded', String(v)); btn.classList.toggle('on', v);
    if (!v) { btn.focus(); return; }
    place(); setTab(S.tab);
    if (!E) { setStatus('Loading the algebra engine…'); boot().then(() => { setStatus(''); renderHist(); renderVars(); if (S.tab === 'graph') drawSoon(); }, err => setStatus('Could not start: ' + err.message, true)); }
    if (S.tab === 'calc') setTimeout(() => ta.focus(), 0);
  }
  btn.addEventListener('click', () => show(!open));
  $('.cas-x').addEventListener('click', () => show(false));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); show(false); } });
  (function drag() {
    const bar = $('.cas-bar'); let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    bar.addEventListener('pointerdown', e => {
      if (window.innerWidth <= 720 || e.target.closest('button')) return;
      on = true; sx = e.clientX; sy = e.clientY; ox = root.offsetLeft; oy = root.offsetTop; bar.setPointerCapture(e.pointerId); e.preventDefault();
    });
    bar.addEventListener('pointermove', e => { if (!on) return; S.pos = { x: ox + e.clientX - sx, y: oy + e.clientY - sy }; place(); });
    bar.addEventListener('pointerup', () => { if (on) { on = false; persist(); } });
  })();
  window.addEventListener('resize', () => { if (open) { place(); if (S.tab === 'graph') drawSoon(); } });

  // ------------------------------------------------------------ tabs + modes
  function setTab(t) {
    S.tab = t; persist();
    root.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    root.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
    if (t === 'graph') drawSoon();
    if (t === 'help' && !$('.cas-help').firstChild) renderHelp();
  }
  root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  function syncSeg() {
    root.querySelectorAll('.cas-seg').forEach(g => g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(S[g.dataset.k] === b.dataset.v))));
  }
  root.querySelectorAll('.cas-seg button').forEach(b => b.addEventListener('click', () => {
    const k = b.parentNode.dataset.k; S[k] = b.dataset.v; syncSeg(); persist();
    if (E) { E.setAngle(S.angle); E.setMode(S.mode); }
    if (k === 'angle') drawSoon();
  }));
  syncSeg();

  // ------------------------------------------------------------ calculator
  function setStatus(msg, bad) {
    let st = $('.cas-status');
    if (!msg) { if (st) st.remove(); return; }
    if (!st) { st = document.createElement('div'); st.className = 'cas-status'; hist.parentNode.insertBefore(st, hist); }
    st.textContent = msg; st.classList.toggle('bad', !!bad);
  }
  const EXAMPLES = ['solve(x^2-5x+6=0,x)', 'solve(sin(2x)=1/2,x)|0≤x≤2π', 'd/dx(x^2 cos(x))', '∫(x e^(-x),x,0,1)', 'normCdf(-∞,180,195,11)', 'define f(x)=x^3-3x'];
  function itemHtml(h, i) {
    const r = h.r || {};
    const graphable = !r.error && /\bx\b/.test(r.text || '') && !/[=<>≤≥]|^\{|^\[|Done/.test(r.text || '');
    return '<li class="cas-item' + (r.error ? ' err' : '') + '" data-i="' + i + '">' +
      '<button type="button" class="cas-in" title="Edit this again">' + esc(h.in) + '</button>' +
      '<button type="button" class="cas-out" title="Insert this result">' + K(r.tex || '\\text{' + (r.text || '') + '}') + '</button>' +
      (r.approx && r.approx !== r.text ? '<div class="cas-apx">≈ ' + esc(String(r.approx).replace(/≈/g, '=')) + '</div>' : '') +
      (r.note ? '<div class="cas-note">' + esc(r.note) + '</div>' : '') +
      (graphable ? '<button type="button" class="cas-graphit" title="Graph this">Graph</button>' : '') +
    '</li>';
  }
  function renderHist() {
    if (!S.hist.length) {
      hist.innerHTML = '<li class="cas-empty"><p>Type like on a CX II CAS. Enter gives an exact answer, Ctrl+Enter (or ≈) gives a decimal. Tap a template below, or try:</p>' +
        EXAMPLES.map(x => '<button type="button" class="cas-ex">' + esc(x) + '</button>').join('') + '</li>';
    } else hist.innerHTML = S.hist.map(itemHtml).join('');
    hist.scrollTop = hist.scrollHeight;
  }
  function insert(t) {
    const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
    const cur = t.indexOf('|') >= 0 && t.trim() !== '|' ? t.indexOf('|') : -1;
    const txt = cur >= 0 ? t.slice(0, cur) + t.slice(cur + 1) : t;
    ta.value = v.slice(0, a) + txt + v.slice(b);
    const p = a + (cur >= 0 ? cur : txt.length);
    ta.focus(); ta.setSelectionRange(p, p); autosize(); hint();
  }
  function autosize() { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
  let hpos = -1, draft = '';
  function evaluate(approx) {
    const input = ta.value.trim(); if (!input) return;
    boot().then(eng => {
      const r = eng.run(input, { approx: !!approx });
      if (!r) return;
      S.hist.push({ in: input, r: { tex: r.tex, text: r.text, approx: r.approx || null, note: r.note || null, error: !!r.error } });
      if (S.hist.length > 120) S.hist.shift();
      ta.value = ''; autosize(); hpos = -1; sig.textContent = '';
      renderHist(); renderVars(); persist();
    }, err => setStatus('Could not start: ' + err.message, true));
  }
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); evaluate(e.ctrlKey || e.metaKey); return; }
    const inputs = S.hist.map(h => h.in);
    if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionEnd === 0 && inputs.length) {
      e.preventDefault(); if (hpos === -1) { draft = ta.value; hpos = inputs.length; }
      hpos = Math.max(0, hpos - 1); ta.value = inputs[hpos]; autosize();
    } else if (e.key === 'ArrowDown' && hpos !== -1 && ta.selectionStart === ta.value.length) {
      e.preventDefault(); hpos++; if (hpos >= inputs.length) { hpos = -1; ta.value = draft; } else ta.value = inputs[hpos]; autosize();
    }
  });
  ta.addEventListener('input', () => { autosize(); hint(); });
  ta.addEventListener('click', hint); ta.addEventListener('keyup', e => { if (e.key.startsWith('Arrow')) hint(); });
  function hint() {
    const before = ta.value.slice(0, ta.selectionStart);
    let depth = 0, name = null;
    for (let i = before.length - 1; i >= 0; i--) {
      const c = before[i];
      if (c === ')') depth++;
      else if (c === '(') { if (depth === 0) { const m = before.slice(0, i).match(/([A-Za-z_][\w]*|∫|d\/d[a-z])\s*$/); name = m ? m[1] : null; break; } depth--; }
    }
    if (!name && /^\s*define\b/i.test(ta.value)) name = 'define';
    const key = name ? (name === '∫' ? 'integral' : /^d\/d/.test(name) ? 'derivative' : name.toLowerCase()) : null;
    sig.textContent = key && SIG[key] ? SIG[key] : '';
  }
  $('.cas-go').addEventListener('click', () => evaluate(false));
  $('.cas-ap').addEventListener('click', () => evaluate(true));
  hist.addEventListener('click', e => {
    const ex = e.target.closest('.cas-ex'); if (ex) { ta.value = ex.textContent; autosize(); evaluate(false); return; }
    const li = e.target.closest('.cas-item'); if (!li) return;
    const h = S.hist[+li.dataset.i]; if (!h) return;
    if (e.target.closest('.cas-in')) { ta.value = h.in; autosize(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); hint(); }
    else if (e.target.closest('.cas-out')) { if (!h.r.error) insert(h.r.text.replace(/^y=/, '')); }
    else if (e.target.closest('.cas-graphit')) { graphExpr(h.r.text.replace(/^y=/, '')); }
  });
  root.querySelector('.cas-quick').addEventListener('click', e => { const b = e.target.closest('[data-ins]'); if (b) insert(b.dataset.ins); });
  function renderKeys() {
    root.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cat === S.cat)));
    const cat = CATS.find(c => c[0] === S.cat) || CATS[0];
    keys.innerHTML = cat[2].map(([t, l]) => '<button type="button" data-ins="' + esc(t) + '" title="' + esc(t.replace('|', '')) + '">' + esc(l) + '</button>').join('');
  }
  root.querySelector('.cas-cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { S.cat = b.dataset.cat; renderKeys(); persist(); } });
  keys.addEventListener('click', e => { const b = e.target.closest('[data-ins]'); if (b) insert(b.dataset.ins); });
  renderKeys();

  // vars + clear
  function renderVars() {
    const st = E ? E.state : { defs: S.defs, vars: S.vars };
    const rows = Object.keys(st.defs).map(k => [k + '(' + st.defs[k].params.join(',') + ')', st.defs[k].body, k])
      .concat(Object.keys(st.vars).map(k => [k, st.vars[k], k]));
    varbox.innerHTML = rows.length
      ? '<ul>' + rows.map(([n, v, k]) => '<li><code>' + esc(n) + ' = ' + esc(v) + '</code><button type="button" data-del="' + esc(k) + '" aria-label="Delete ' + esc(n) + '">delvar</button></li>').join('') + '</ul>'
      : '<p>No stored functions or variables. Make one with <code>define f(x)=x^2</code> or <code>5→a</code>.</p>';
  }
  $('[data-act="vars"]').addEventListener('click', e => { varbox.hidden = !varbox.hidden; e.currentTarget.setAttribute('aria-expanded', String(!varbox.hidden)); renderVars(); });
  varbox.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; boot().then(eng => { eng.run('delvar ' + b.dataset.del); renderVars(); persist(); drawSoon(); }); });
  $('[data-act="clear"]').addEventListener('click', () => { S.hist = []; renderHist(); persist(); });

  // ------------------------------------------------------------ help
  const HELP = [
    ['Algebra', [['solve(x^2-5x+6=0,x)', 'Exact roots. General solutions for trig use n (an integer).'], ['solve(cos(2x)=-1/2,x)|0≤x≤2π', 'Restrict the domain with |.'],
      ['solve({3x-2y=4,x+y=3},{x,y})', 'Simultaneous equations.'], ['solve(y=e^(2x)+1,x)', 'Inverse functions: make x the subject.'], ['solve(2x^2+x-1>0,x)', 'Inequalities.'],
      ['nSolve(x^3+3x-3=0,x)', 'One decimal root.'], ['factor(x^3-x^2-16x-20)', 'Factor over the rationals.'], ['expand((2x-1)(x+3))', ''], ['zeros(x^2-x-6,x)', 'Roots as a list.']]],
    ['Functions and storing', [['define f(x)=x^3-3x', 'Then f(2), f(a+1), solve(f(x)=0,x), d/dx(f(x)).'], ['f(x):=x^2+1', 'Same as define.'], ['5→a', 'Store a value (or use a:=5).'],
      ['x^2+3x|x=2', 'Substitute with |.'], ['delvar f', 'Delete one. clear all deletes everything.']]],
    ['Calculus', [['d/dx(x^2 cos(x))', 'Derivative.'], ['derivative(x^4,x,2)', 'Second derivative.'], ['derivative(sqrt(x),x)|x=4', 'Gradient at a point.'], ['∫(x sin(x),x)', 'Antiderivative (add your own +c).'],
      ['∫(x sin(x),x,0,π)', 'Definite integral, exact when possible.'], ['limit(sin(x)/x,x,0)', 'Add 1 or -1 for one-sided.'], ['fMax(12x-3x^2,x)', 'x-value of the max. Use | for an interval.'],
      ['tangentLine(x^2,x,1)', 'Tangent line equation.'], ['normalLine(x^2,x,1)', 'Normal line equation.']]],
    ['Probability', [['normCdf(-∞,180,195,11)', 'Pr(X < 180), X ~ N(195, 11²).'], ['invNorm(0.9,6.7,0.1)', 'Area to the LEFT.'], ['binomPdf(10,0.3,4)', 'Pr(X = 4).'],
      ['binomCdf(10,0.3,2,5)', 'Pr(2 ≤ X ≤ 5).'], ['zInterval_1Prop(10,50,0.9)', 'Approximate 90% confidence interval for p.'], ['nCr(10,3)', 'Combinations.']]],
    ['Stats and matrices', [['mean({2,4,4,5})', ''], ['stDevSamp({2,4,4,5})', ''], ['det([1,2;3,4])', 'Rows are separated by ;'], ['[1,2;3,4]^(-1)', 'Inverse matrix.'], ['[2,0;0,3]*[1;4]', 'Matrix product.']]]
  ];
  function renderHelp() {
    $('.cas-help').innerHTML =
      '<p class="cas-hnote">Commands use TI-Nspire names so your muscle memory carries over. Tap any example to run it.</p>' +
      HELP.map(([h, rows]) => '<h4>' + esc(h) + '</h4><dl>' + rows.map(([c, d]) => '<dt><button type="button" class="cas-try">' + esc(c) + '</button></dt><dd>' + esc(d) + '</dd>').join('') + '</dl>').join('') +
      '<h4>Things that trip people up</h4><ul>' +
      '<li><code>log(x)</code> is base 10, like the Nspire. Natural log is <code>ln(x)</code>. <code>log(x,b)</code> is base b.</li>' +
      '<li>Typing a decimal (0.5) switches that answer to decimals, the same as the Nspire’s Auto mode.</li>' +
      '<li>Trig uses radians unless you switch to Deg. You can also write <code>sin(30°)</code>.</li>' +
      '<li>Use <code>*</code> between letters: <code>a*x</code>, not <code>ax</code> (which is one variable called ax). <code>2x</code> and <code>x sin(x)</code> are fine.</li>' +
      '<li>Equation solving without a domain searches −1000 ≤ x ≤ 1000 for decimal roots. Exact methods (polynomials, single-x equations, trig) have no limit.</li>' +
      '</ul>' +
      '<h4>Honest limits</h4><ul>' +
      '<li>This is a practice calculator built for this guide. It copies the Nspire’s command names, not its software. It is not a TI product, and VCAA exams only allow your approved physical CAS.</li>' +
      '<li>It has no complex mode, piecewise functions, sequences, regressions or spreadsheets. Symbolic solving with several letters works for polynomials up to degree 2 and for equations where x appears once.</li>' +
      '<li>Exact forms for some answers are recognised from very precise decimals (marked in a note). Check anything that matters by substituting back.</li>' +
      '</ul>';
  }
  $('.cas-help').addEventListener('click', e => { const b = e.target.closest('.cas-try'); if (!b) return; setTab('calc'); ta.value = b.textContent; autosize(); evaluate(false); });

  // ------------------------------------------------------------ graph
  const fnIn = [...root.querySelectorAll('[data-f]')], onIn = [...root.querySelectorAll('[data-on]')];
  fnIn.forEach((inp, i) => { inp.value = S.fns[i].e; onIn[i].checked = S.fns[i].on !== false; });
  let compiled = [null, null, null, null], marks = [], trace = null;
  function compileAll() {
    if (!E) return;
    compiled = S.fns.map(f => {
      if (!f.e.trim() || !f.on) return null;
      try { const fn = E.compile(f.e, ['x']); let d = null; try { d = E.compile(E.deriv(f.e, 'x'), ['x']); } catch (err) { d = null; } return { fn, d }; } catch (err) { return { err: err.message }; }
    });
    fnIn.forEach((inp, i) => inp.classList.toggle('bad', !!(compiled[i] && compiled[i].err)));
  }
  fnIn.forEach((inp, i) => inp.addEventListener('input', () => { S.fns[i].e = inp.value; marks = []; gpts.innerHTML = ''; boot().then(() => { compileAll(); drawSoon(); persist(); }); }));
  onIn.forEach((c, i) => c.addEventListener('change', () => { S.fns[i].on = c.checked; marks = []; gpts.innerHTML = ''; compileAll(); drawSoon(); persist(); }));
  function graphExpr(t) {
    let i = S.fns.findIndex(f => !f.e.trim()); if (i < 0) i = 3;
    S.fns[i] = { e: t, on: true }; fnIn[i].value = t; onIn[i].checked = true; setTab('graph'); boot().then(() => { compileAll(); drawSoon(); persist(); });
  }
  let raf = 0;
  function drawSoon() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (E && !compiled.some(Boolean) && S.fns.some(f => f.e.trim())) compileAll(); draw(); }); }
  const css = n => getComputedStyle(root).getPropertyValue(n).trim();
  function niceStep(span, px) { const raw = span / Math.max(2, px / 70), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  const sf = (x, d) => { if (Math.abs(x) < 1e-12) return '0'; const t = Number(x.toPrecision(d || 6)); return String(Math.abs(t) >= 1e6 || Math.abs(t) < 1e-4 ? t.toExponential(3) : t); };
  function draw() {
    if (root.hidden || S.tab !== 'graph') return;
    const wrap = canvas.parentNode, W = wrap.clientWidth, H = wrap.clientHeight; if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = S.view, X = x => (x - v.xmin) / (v.xmax - v.xmin) * W, Y = y => H - (y - v.ymin) / (v.ymax - v.ymin) * H;
    c.fillStyle = css('--surface') || '#fff'; c.fillRect(0, 0, W, H);
    const sx = niceStep(v.xmax - v.xmin, W), sy = niceStep(v.ymax - v.ymin, H);
    c.lineWidth = 1; c.strokeStyle = css('--line') || '#ddd'; c.beginPath();
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { const px = Math.round(X(x)) + 0.5; c.moveTo(px, 0); c.lineTo(px, H); }
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { const py = Math.round(Y(y)) + 0.5; c.moveTo(0, py); c.lineTo(W, py); }
    c.stroke();
    const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
    c.strokeStyle = css('--muted') || '#666'; c.beginPath(); c.moveTo(0, Math.round(ax) + 0.5); c.lineTo(W, Math.round(ax) + 0.5); c.moveTo(Math.round(ay) + 0.5, 0); c.lineTo(Math.round(ay) + 0.5, H); c.stroke();
    c.fillStyle = css('--muted') || '#666'; c.font = '11px ' + (css('--font-mono') || 'monospace'); c.textAlign = 'center'; c.textBaseline = 'top';
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { if (Math.abs(x) < sx / 2 || X(x) < 14 || X(x) > W - 14) continue; c.fillText(sf(x, 4), X(x), Math.min(ax + 3, H - 14)); }
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { if (Math.abs(y) < sy / 2 || Y(y) < 8 || Y(y) > H - 8) continue; c.fillText(sf(y, 4), Math.max(ay - 4, 30), Y(y)); }
    // curves
    compiled.forEach((g, i) => {
      if (!g || !g.fn) return;
      c.strokeStyle = css('--g' + i); c.lineWidth = 2.2; c.beginPath();
      let pen = false, py0 = 0;
      for (let px = 0; px <= W; px += 0.5) {
        const x = v.xmin + px / W * (v.xmax - v.xmin), y = g.fn(x);
        if (!isFinite(y)) { pen = false; continue; }
        const py = Math.max(-5 * H, Math.min(6 * H, Y(y)));
        if (pen && Math.abs(py - py0) > 2 * H) pen = false;
        if (pen) c.lineTo(px, py); else c.moveTo(px, py);
        pen = true; py0 = py;
      }
      c.stroke();
    });
    // marked points + trace
    const dot = (x, y, col, ring) => { const px = X(x), py = Y(y); c.beginPath(); c.arc(px, py, ring ? 5 : 4, 0, 2 * Math.PI); c.fillStyle = ring ? css('--surface') : col; c.fill(); c.lineWidth = 2; c.strokeStyle = col; c.stroke(); };
    marks.forEach(m => dot(m.x, m.y, css('--g' + m.i), false));
    if (trace) dot(trace.x, trace.y, css('--g' + trace.i), true);
    gwin.textContent = 'x: [' + sf(v.xmin, 4) + ', ' + sf(v.xmax, 4) + ']  y: [' + sf(v.ymin, 4) + ', ' + sf(v.ymax, 4) + ']' + (S.angle === 'deg' ? '  ·  degrees' : '') + '  ·  drag to pan, scroll or pinch to zoom, tap a curve to trace';
  }
  function zoom(f, cx, cy) {
    const v = S.view; cx = cx === undefined ? (v.xmin + v.xmax) / 2 : cx; cy = cy === undefined ? (v.ymin + v.ymax) / 2 : cy;
    S.view = { xmin: cx + (v.xmin - cx) * f, xmax: cx + (v.xmax - cx) * f, ymin: cy + (v.ymin - cy) * f, ymax: cy + (v.ymax - cy) * f }; persist(); drawSoon();
  }
  function fitY() {
    const v = S.view, ys = [];
    compiled.forEach(g => { if (!g || !g.fn) return; for (let k = 0; k <= 400; k++) { const y = g.fn(v.xmin + (v.xmax - v.xmin) * k / 400); if (isFinite(y)) ys.push(y); } });
    if (!ys.length) return;
    ys.sort((a, b) => a - b); let lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.98) - 1];
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.08; S.view = { xmin: v.xmin, xmax: v.xmax, ymin: lo - pad, ymax: hi + pad }; persist(); drawSoon();
  }
  root.querySelector('.cas-gtools').addEventListener('click', e => {
    const b = e.target.closest('button[data-g]'); if (!b) return;
    const g = b.dataset.g;
    if (g === 'in') zoom(0.5); else if (g === 'out') zoom(2);
    else if (g === 'std') { S.view = { xmin: -10, xmax: 10, ymin: -10, ymax: 10 }; persist(); drawSoon(); }
    else if (g === 'trig') { const p = S.angle === 'deg' ? 360 : 2 * Math.PI; S.view = { xmin: -p, xmax: p, ymin: -4, ymax: 4 }; persist(); drawSoon(); }
    else if (g === 'fit') fitY();
    else analyse(g);
  });
  function analyse(kind) {
    if (!E) return;
    const v = S.view, which = +$('[data-g="which"]').value, pts = [];
    const near = (a, b) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a));
    if (kind === 'zeros' || kind === 'ext') {
      const g = compiled[which];
      if (!g || !g.fn) { gpts.innerHTML = '<span class="cas-gmsg">Enter and show f' + (which + 1) + ' first.</span>'; return; }
      if (kind === 'zeros') E.findRoots(g.fn, v.xmin, v.xmax, g.d, 4000).forEach(x => pts.push({ i: which, x, y: 0, lab: 'zero' }));
      else if (g.d) {
        E.findRoots(g.d, v.xmin, v.xmax, null, 4000).forEach(x => {
          const h = 1e-4 * Math.max(1, Math.abs(x)), y = g.fn(x), l = g.fn(x - h), r = g.fn(x + h);
          if (!isFinite(y)) return;
          const lab = y > l && y > r ? 'max' : y < l && y < r ? 'min' : 'stationary';
          pts.push({ i: which, x, y, lab });
        });
      }
    } else {
      const on = compiled.map((g, i) => (g && g.fn ? i : -1)).filter(i => i >= 0);
      if (on.length < 2) { gpts.innerHTML = '<span class="cas-gmsg">Show at least two curves to find intersections.</span>'; return; }
      for (let a = 0; a < on.length; a++) for (let b = a + 1; b < on.length; b++) {
        const fa = compiled[on[a]].fn, fb = compiled[on[b]].fn, d = x => fa(x) - fb(x);
        E.findRoots(d, v.xmin, v.xmax, null, 4000).forEach(x => { if (!pts.some(p => near(p.x, x) && near(p.y, fa(x)))) pts.push({ i: on[a], x, y: fa(x), lab: 'f' + (on[a] + 1) + ' = f' + (on[b] + 1) }); });
      }
    }
    marks = pts;
    gpts.innerHTML = pts.length
      ? pts.map(p => '<span class="cas-gpt" style="--c:var(--g' + p.i + ')">' + esc(p.lab) + ' (' + sf(p.x) + ', ' + sf(p.y) + ')</span>').join('')
      : '<span class="cas-gmsg">None in this window. Pan or zoom out and try again.</span>';
    drawSoon();
  }
  (function pointer() {
    const ptrs = new Map(); let moved = false, startDist = 0, startView = null;
    const toX = px => S.view.xmin + px / canvas.clientWidth * (S.view.xmax - S.view.xmin), toY = py => S.view.ymax - py / canvas.clientHeight * (S.view.ymax - S.view.ymin);
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY }); moved = false;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; startDist = Math.hypot(a.x - b.x, a.y - b.y); startView = Object.assign({}, S.view); } });
    canvas.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y; p.x = e.offsetX; p.y = e.offsetY;
      if (Math.hypot(p.x - p.x0, p.y - p.y0) > 4) moved = true;
      if (ptrs.size === 1 && moved) {
        const v = S.view, kx = (v.xmax - v.xmin) / canvas.clientWidth, ky = (v.ymax - v.ymin) / canvas.clientHeight;
        S.view = { xmin: v.xmin - dx * kx, xmax: v.xmax - dx * kx, ymin: v.ymin + dy * ky, ymax: v.ymax + dy * ky }; drawSoon();
      } else if (ptrs.size === 2 && startView) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (!d) return;
        const f = startDist / d, cx = toX((a.x + b.x) / 2), cy = toY((a.y + b.y) / 2), sv = startView;
        S.view = { xmin: cx + (sv.xmin - cx) * f, xmax: cx + (sv.xmax - cx) * f, ymin: cy + (sv.ymin - cy) * f, ymax: cy + (sv.ymax - cy) * f }; drawSoon();
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (!moved && ptrs.size === 0) {
        const x = toX(e.offsetX), py = e.offsetY; let best = null;
        compiled.forEach((g, i) => { if (!g || !g.fn) return; const y = g.fn(x); if (!isFinite(y)) return; const d = Math.abs((S.view.ymax - y) / (S.view.ymax - S.view.ymin) * canvas.clientHeight - py); if (!best || d < best.d) best = { d, i, x, y }; });
        trace = best && best.d < 60 ? best : null;
        gread.textContent = trace ? 'f' + (trace.i + 1) + ':  x = ' + sf(trace.x) + ',  y = ' + sf(trace.y) : '';
        drawSoon();
      }
      if (ptrs.size < 2) startView = null;
      persist();
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, toX(e.offsetX), toY(e.offsetY)); }, { passive: false });
  })();
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => drawSoon()).observe(canvas.parentNode);

  renderHist();
})();
