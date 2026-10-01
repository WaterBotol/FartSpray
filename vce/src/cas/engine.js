/* ==========================================================================
   CAS engine: TI-Nspire-style commands on top of nerdamer (MIT).
   Exposes make(nerdamer) -> { run(input, opts), state, reset, ... }.
   Works in the browser (window.CASEngine) and in node (module.exports).
   ========================================================================== */
(function (root) {
  'use strict';

  function make(nerdamer, reloader) {
    const ST = { defs: {}, vars: {}, ans: null, angle: 'rad', digits: 10 };
    const N = (s, subs) => subs ? nerdamer(s, subs) : nerdamer(s);
    const PI = Math.PI;
    const TRIG = /\b(sin|cos|tan|sec|csc|cot)\(/;

    // ------------------------------------------------------------ string helpers
    const OPEN = '([{', CLOSE = ')]}';
    function matchClose(s, i) {
      let d = 0;
      for (let j = i; j < s.length; j++) {
        if (OPEN.includes(s[j])) d++;
        else if (CLOSE.includes(s[j])) { d--; if (d === 0) return j; }
      }
      return -1;
    }
    function splitTop(s, sep) {
      const out = []; let d = 0, start = 0;
      for (let j = 0; j < s.length; j++) {
        const c = s[j];
        if (OPEN.includes(c)) d++;
        else if (CLOSE.includes(c)) d--;
        else if (d === 0 && s.startsWith(sep, j)) { out.push(s.slice(start, j)); start = j + sep.length; j += sep.length - 1; }
      }
      out.push(s.slice(start));
      return out.map(x => x.trim());
    }
    function topIndex(s, tokens) {
      let d = 0;
      for (let j = 0; j < s.length; j++) {
        const c = s[j];
        if (OPEN.includes(c)) d++;
        else if (CLOSE.includes(c)) d--;
        else if (d === 0) for (const t of tokens) if (s.startsWith(t, j)) return [j, t];
      }
      return [-1, null];
    }
    // rewrite every call name(args...) using fn(argsArray) -> replacement string (inner calls first)
    function rewriteCalls(s, name, fn) {
      const re = new RegExp('(^|[^A-Za-z_])' + name + '\\(');
      let guard = 0, m;
      while ((m = re.exec(s)) && guard++ < 500) {
        const start = m.index + m[1].length, open = start + name.length, close = matchClose(s, open);
        if (close < 0) throw new Error('Missing ) after ' + name);
        const inner = rewriteCalls(s.slice(open + 1, close), name, fn);
        s = s.slice(0, start) + fn(splitTop(inner, ','), inner) + s.slice(close + 1);
      }
      return s;
    }

    // ------------------------------------------------------------ input normalisation (Nspire -> nerdamer)
    function prep(raw) {
      let s = String(raw).trim();
      s = s.replace(/[−–]/g, '-').replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/∞/g, 'Infinity')
        .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=').replace(/²/g, '^2').replace(/³/g, '^3').replace(/θ/g, 'theta')
        .replace(/→/g, '->').replace(/\bans\b/gi, ST.ans != null ? '(' + ST.ans + ')' : 'ans').replace(/\binfinity\b/gi, 'Infinity')
        .replace(/\bINF\b/g, 'Infinity');
      s = s.replace(/(\d|\.)\s*[Eᴇ]\s*([+-]?\d+)/g, '$1*10^($2)');
      s = s.replace(/√\s*\(/g, 'sqrt(').replace(/√\s*([0-9.]+|[A-Za-z]\w*)/g, 'sqrt($1)');
      s = s.replace(/∛\s*\(/g, 'ROOT3__(').replace(/∛\s*([0-9.]+|[A-Za-z]\w*)/g, 'ROOT3__($1)').replace(/∜\s*\(/g, 'ROOT4__(').replace(/∜\s*([0-9.]+|[A-Za-z]\w*)/g, 'ROOT4__($1)');
      s = rewriteCalls(s, 'ROOT3__', (a, inner) => 'nthroot(' + inner + ',3)'); s = rewriteCalls(s, 'ROOT4__', (a, inner) => 'nthroot(' + inner + ',4)');
      s = ST.angle === 'deg' ? s.replace(/°/g, '') : s.replace(/([0-9.]+|\))\s*°/g, '$1*(pi/180)');
      s = s.replace(/(^|[^A-Za-z_])(sin|cos|tan)(\^-1|\^\(-1\)|⁻¹)\(/g, '$1a$2(').replace(/(^|[^A-Za-z_])arc(sin|cos|tan)\(/g, '$1a$2(');
      s = s.replace(/\bnCr\(/g, 'nCr(');
      // log(x) is base 10 and log(x,b) is base b on the Nspire; ln is natural (nerdamer's log)
      s = rewriteCalls(s, 'log', a => a.length >= 2 ? '(LN__(' + a[0] + ')/LN__(' + a[1] + '))' : 'LOG10__(' + a[0] + ')');
      s = s.replace(/(^|[^A-Za-z_])ln\(/g, '$1LN__(');
      s = s.replace(/LN__\(/g, 'log(').replace(/LOG10__\(/g, 'log10(');
      // factorial
      s = s.replace(/(\d+)!/g, 'factorial($1)').replace(/\b([A-Za-z])!/g, 'factorial($1)');
      // degree mode: trig takes degrees, inverse trig returns degrees
      if (ST.angle === 'deg') {
        ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'].forEach(f => { s = rewriteCalls(s, f, (a, inner) => f + 'DEG__((pi/180)*(' + inner + '))'); });
        ['asin', 'acos', 'atan'].forEach(f => { s = rewriteCalls(s, f, (a, inner) => '((180/pi)*' + f + 'DEG__(' + inner + '))'); });
        s = s.replace(/DEG__\(/g, '(');
      }
      s = s.replace(/(^|[^A-Za-z0-9_])derivative\(/g, '$1diff(');   // nested derivative(...) -> nerdamer's diff
      s = checkCalls(s);
      // implicit multiplication across spaces: "2 x", "x sin(x)", ") ("
      s = s.replace(/([0-9A-Za-z_)\]])\s+(?=[0-9A-Za-z_(])/g, (m0, a, off, str) => {
        const before = str.slice(0, off + 1);
        if (/\b(and|or)$/.test(before)) return a + ' ';
        const after = str.slice(off + m0.length);
        if (/^(and|or)\b/.test(after)) return a + ' ';
        return a + '*';
      });
      return s;
    }

    // a(b+c) with an undefined one-letter name means a*(b+c); an unknown longer name is an error, not a silent product
    const KNOWN = new Set(('sqrt abs exp log log10 nthroot matrix invert transpose determinant diff integrate defint sum product limit expand factor simplify factorial ' +
      'erf erfc vector min max mod floor ceil round sign cbrt fact atan2 sin cos tan sec csc cot asin acos atan asec acsc acot sinh cosh tanh asinh acosh atanh ' +
      'LN__ LOG10__ DEG__ sinDEG__ cosDEG__ tanDEG__ secDEG__ cscDEG__ cotDEG__ asinDEG__ acosDEG__ atanDEG__ DDX__ ROOT3__ ROOT4__ nCr nPr').split(' '));
    function checkCalls(s) {
      return s.replace(/(^|[^A-Za-z0-9_])([A-Za-z_]\w*)\s*\(/g, (m0, pre, name) => {
        if (KNOWN.has(name) || ST.defs[name] || CMDNAMES.has(name.toLowerCase()) || /^(derivative|diff)__[a-z]$/.test(name) || /^DDX__[a-z]$/.test(name)) return m0;
        if (name.length === 1 || ST.vars[name] !== undefined) return pre + name + '*(';
        throw new Error('“' + name + '” is not a function. Use define ' + name + '(x)=… first, or put * for multiplication.');
      });
    }

    // ------------------------------------------------------------ numbers + formatting
    function fmt(x, digits) {
      digits = digits || ST.digits;
      if (x === Infinity) return '∞';
      if (x === -Infinity) return '-∞';
      if (!isFinite(x)) return 'undef';
      if (Math.abs(x) < 1e-300) return '0';
      const ax = Math.abs(x);
      if (ax >= 1e10 || ax < 1e-5) {
        const [m, e] = x.toExponential(digits - 1).split('e');
        return m.replace(/\.?0+$/, '') + 'E' + (+e);
      }
      let t = x.toPrecision(digits);
      if (t.includes('e')) t = Number(t).toString();
      if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
      return t;
    }
    function fmtTex(x) {
      const t = fmt(x);
      const m = t.match(/^(-?[\d.]+)E(-?\d+)$/);
      return m ? m[1] + '\\times10^{' + m[2] + '}' : t.replace('∞', '\\infty');
    }
    function num(s) {
      if (typeof s === 'number') return s;
      const str = String(s).trim();
      if (/^-?Infinity$/.test(str)) return str[0] === '-' ? -Infinity : Infinity;
      const v = Number(N(str).evaluate().text('decimals'));
      if (isNaN(v)) throw new Error('Not a number: ' + str);
      return v;
    }
    function isNumeric(s) { try { return N(s).variables().length === 0; } catch (e) { return false; } }
    // Compile an expression to a fast numeric function. nerdamer's buildFunction writes e as a ratio of huge
    // integer powers (overflow -> NaN), and uses new Function, so this is a small closure compiler instead.
    function rpow(a, b) {
      if (a >= 0 || Number.isInteger(b)) return Math.pow(a, b);
      const r = ratApprox(b, 99);                      // real odd roots of negatives, like the Nspire in real mode
      if (r && r[1] % 2 === 1) return (r[0] % 2 ? -1 : 1) * Math.pow(-a, b);
      return NaN;
    }
    const FN = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
      asin: Math.asin, acos: Math.acos, atan: Math.atan, asec: x => Math.acos(1 / x), acsc: x => Math.asin(1 / x), acot: x => Math.atan(1 / x),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
      log: (x, b) => b === undefined ? Math.log(x) : Math.log(x) / Math.log(b), log10: Math.log10, exp: Math.exp, sqrt: Math.sqrt, cbrt: Math.cbrt,
      abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign, min: Math.min, max: Math.max,
      factorial: x => (Number.isInteger(x) && x >= 0 && x < 171) ? Math.round(Math.exp(lgamma(x + 1))) : Math.exp(lgamma(x + 1)),
      erf: x => 1 - erfc(x), erfc: x => erfc(x), nthroot: (x, n) => rpow(x, 1 / n), mod: (a, b) => a - b * Math.floor(a / b),
    };
    FN.fact = FN.factorial;
    const CONST = { e: Math.E, pi: PI, Infinity: Infinity };
    // ---- expression trees: n number, s symbol, f function call, + - * / ^ binary, neg, ! factorial
    function parse(src) {
      const toks = String(src).match(/\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|\S/g) || [];
      let i = 0;
      const peek = () => toks[i], take = t => { if (toks[i] !== t) throw new Error('Expected ' + t); i++; };
      function expr() { let a = term(); while (peek() === '+' || peek() === '-') { const k = toks[i++]; a = { k, l: a, r: term() }; } return a; }
      function term() { let a = unary(); while (peek() === '*' || peek() === '/') { const k = toks[i++]; a = { k, l: a, r: unary() }; } return a; }
      function unary() { if (peek() === '-') { i++; return { k: 'neg', x: unary() }; } if (peek() === '+') { i++; return unary(); } return power(); }
      function power() { const a = postfix(); if (peek() === '^') { i++; return { k: '^', l: a, r: unary() }; } return a; }
      function postfix() { let a = primary(); while (peek() === '!') { i++; a = { k: '!', x: a }; } return a; }
      function primary() {
        const t = toks[i++];
        if (t === undefined) throw new Error('Unexpected end');
        if (t === '(') { const a = expr(); take(')'); return a; }
        if (/^[\d.]/.test(t)) return { k: 'n', v: t };
        if (/^[A-Za-z_]/.test(t)) {
          if (peek() === '(') { i++; const a = []; if (peek() !== ')') { a.push(expr()); while (peek() === ',') { i++; a.push(expr()); } } take(')'); return { k: 'f', v: t, a }; }
          return { k: 's', v: t };
        }
        throw new Error('Unexpected ' + t);
      }
      const root = expr(); if (i < toks.length) throw new Error('Unexpected ' + toks[i]);
      return root;
    }
    function closure(nd, vars) {
      switch (nd.k) {
        case 'n': { const v = Number(nd.v); return () => v; }
        case 's': { const k = vars.indexOf(nd.v); if (k >= 0) return e => e[k]; const v = nd.v in CONST ? CONST[nd.v] : NaN; return () => v; }
        case 'neg': { const a = closure(nd.x, vars); return e => -a(e); }
        case '!': { const a = closure(nd.x, vars); return e => FN.factorial(a(e)); }
        case 'f': {
          const f = FN[nd.v]; if (!f) return () => NaN;
          const as = nd.a.map(x => closure(x, vars));
          if (as.length === 1) { const a0 = as[0]; return e => f(a0(e)); }
          return e => f.apply(null, as.map(g => g(e)));
        }
      }
      const l = closure(nd.l, vars), r = closure(nd.r, vars);
      switch (nd.k) {
        case '+': return e => l(e) + r(e);
        case '-': return e => l(e) - r(e);
        case '*': return e => l(e) * r(e);
        case '/': return e => l(e) / r(e);
        case '^': return e => rpow(l(e), r(e));
      }
      throw new Error('bad node');
    }
    function buildFn(src, vars) { return closure(parse(src), vars); }
    const hasSym = (nd, v) => nd.k === 's' ? (v ? nd.v === v : !(nd.v in CONST)) : nd.k === 'n' ? false : nd.k === 'f' ? nd.a.some(x => hasSym(x, v)) : (nd.x ? hasSym(nd.x, v) : hasSym(nd.l, v) || hasSym(nd.r, v));
    const countSym = (nd, v) => nd.k === 's' ? (nd.v === v ? 1 : 0) : nd.k === 'n' ? 0 : nd.k === 'f' ? nd.a.reduce((m, x) => m + countSym(x, v), 0) : (nd.x ? countSym(nd.x, v) : countSym(nd.l, v) + countSym(nd.r, v));
    const evalNode = nd => { try { return closure(nd, [])([]); } catch (e) { return NaN; } };

    function compile(expr, vars) {
      let src; try { src = N(expr).toString(); } catch (e) { src = String(expr); }
      let g; try { g = buildFn(src, vars); } catch (e) { g = null; }
      if (!g) return function () { return NaN; };
      return function () { const v = g(arguments); return typeof v === 'number' ? v : NaN; };
    }
    const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

    // ------------------------------------------------------------ exact recognition of a decimal
    let REC_TOL = 1e-12;
    const SQF = []; for (let c = 2; c <= 200; c++) { let ok = true; for (let p = 2; p * p <= c; p++) if (c % (p * p) === 0) ok = false; if (ok) SQF.push(c); }
    function ratApprox(x, maxQ) {
      if (!isFinite(x)) return null;
      let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
      for (let i = 0; i < 40; i++) {
        const a = Math.floor(b), h2 = a * h1 + h0, k2 = a * k1 + k0;
        if (k2 > maxQ) break;
        h0 = h1; h1 = h2; k0 = k1; k1 = k2;
        if (Math.abs(x - h1 / k1) <= REC_TOL * Math.max(1, Math.abs(x))) return [h1, k1];
        const fr = b - a; if (fr < 1e-15) break; b = 1 / fr;
      }
      return Math.abs(x - h1 / k1) <= REC_TOL * Math.max(1, Math.abs(x)) ? [h1, k1] : null;
    }
    function fracStr(p, q) { return q === 1 ? String(p) : p + '/' + q; }
    function recognize(x) {
      if (!isFinite(x)) return null;
      const tol = Math.max(1e-10, REC_TOL) * Math.max(1, Math.abs(x));
      if (Math.abs(x - Math.round(x)) < Math.max(tol, 1e-12)) return String(Math.round(x));
      let r = ratApprox(x, 1000); if (r) return fracStr(r[0], r[1]);
      r = ratApprox(x / PI, 72);
      if (r && Math.abs(r[0]) <= 720) return (r[0] === 1 ? '' : r[0] === -1 ? '-' : r[0] + '*') + 'pi' + (r[1] === 1 ? '' : '/' + r[1]);
      const coef = (r, t) => (r[0] === 1 ? '' : r[0] === -1 ? '-' : r[0] + '*') + t + (r[1] === 1 ? '' : '/' + r[1]);
      r = ratApprox(x / Math.sqrt(PI), 24); if (r && Math.abs(r[0]) <= 48) return coef(r, 'sqrt(pi)');
      for (const k of [1, -1, 2, -2, 3, -3]) { r = ratApprox(x / Math.exp(k), 24); if (r && Math.abs(r[0]) <= 100) return coef(r, k === 1 ? 'e' : 'e^(' + k + ')'); }
      for (const c of SQF) {
        const rc = Math.sqrt(c);
        for (let d = 1; d <= 24; d++) {
          for (let b = 1; b <= 24; b++) {
            for (const sg of [1, -1]) {
              const a = x * d - sg * b * rc;
              const ar = Math.round(a);
              if (Math.abs(a - ar) < REC_TOL * d * Math.max(1, Math.abs(x)) && Math.abs(ar) <= 2000) {
                const g = gcd(gcd(ar, b), d);
                const A = ar / g, B = b / g, D = d / g;
                const surd = (B === 1 ? '' : B + '*') + 'sqrt(' + c + ')';
                let t = A === 0 ? (sg < 0 ? '-' : '') + surd : A + (sg < 0 ? '-' : '+') + surd;
                return D === 1 ? t : (A === 0 ? (sg < 0 ? '-' : '') + surd + '/' + D : '(' + t + ')/' + D);
              }
            }
          }
        }
      }
      for (let k = 1; k <= 4; k++) {
        const ex = Math.exp(k * x); r = ratApprox(ex, 200);
        if (r && r[0] > 0 && r[0] <= 5000 && !(r[0] === 1 && r[1] === 1)) return 'log(' + fracStr(r[0], r[1]) + ')' + (k > 1 ? '/' + k : '');
      }
      const ten = Math.pow(10, x); r = ratApprox(ten, 100);
      if (r && r[0] > 0 && r[0] <= 5000 && !(r[0] === 1 && r[1] === 1)) return 'log10(' + fracStr(r[0], r[1]) + ')';
      return null;
    }

    // ------------------------------------------------------------ LaTeX
    function tex(s) {
      let t;
      try { t = nerdamer.convertToLaTeX(String(s)); } catch (e) { t = String(s); }
      return cleanTex(t);
    }
    function cleanTex(t) {
      return String(t).replace(/\\mathrm\{log10\}/g, '\\log_{10}').replace(/\\mathrm\{log\}/g, '\\ln').replace(/\\mathrm\{(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|exp)\}/g, '\\$1')
        .replace(/\\mathrm\{asin\}/g, '\\sin^{-1}').replace(/\\mathrm\{acos\}/g, '\\cos^{-1}').replace(/\\mathrm\{atan\}/g, '\\tan^{-1}').replace(/\\mathrm\{abs\}\\left\(([^]*?)\\right\)/g, '\\left|$1\\right|')
        .replace(/\{([A-Za-z])\}\^\{1\}/g, '$1').replace(/(\d+) \\cdot \\frac\{(\\pi|\\sqrt\{\d+\}|e)\}\{(\d+)\}/g, '\\frac{$1$2}{$3}')
        .replace(/(\d)\s*\\cdot\s*(?=[\d.])/g, '$1\\times ').replace(/\\cdot\s*/g, '\\,').replace(/Infinity/g, '\\infty');
    }
    function exactTex(s) { return tex(tidySafe(s)); }

    // ------------------------------------------------------------ simplification of results
    function niceExact(str) {
      // clean nerdamer output: prefer recognised simple forms for pure numbers
      let s = String(str);
      if (/^-?\d+$/.test(s)) return s;
      if (isNumeric(s)) {
        let v; try { v = num(s); } catch (e) { return s; }
        if (!isFinite(v)) return s;
        const rec = recognize(v);
        if (rec && (rec.length < s.length || /log|e\^|factorial|\d{9,}/.test(s))) return rec;
        if (/\d{12,}/.test(s)) return fmt(v); // nerdamer's huge rationals for decimals
      }
      return s.replace(/e\^log\(([^()]+)\)/g, '($1)').replace(/e\^\((\d+)\*log\(([^()]+)\)\)/g, '($2)^$1');
    }
    function simp(s, force) {
      let r = N(s).toString();
      // nerdamer's simplify is sometimes wrong (it can flip signs inside surds), so every result is checked numerically
      if (force || /\/|\^\(-|[a-z]\(/.test(r)) { try { const t = N('simplify(' + r + ')').toString(); if (t.length < r.length && sameValue(t, r)) r = t; } catch (e) { /* keep */ } }
      if (force) try { const vs = N(r).variables(); if (vs.length === 1 && /\(/.test(r) && polyCoeffs(r, vs[0])) { const ex = N('expand(' + r + ')').toString(); if (sameValue(ex, r)) r = ex; } } catch (e) { /* keep */ }
      return niceExact(r);
    }

    // ------------------------------------------------------------ display (Nspire-like order, fractions, approx form)
    function splitTerms(s) {
      const outT = []; let d = 0, start = 0;
      for (let j = 0; j < s.length; j++) {
        const c = s[j];
        if (OPEN.includes(c)) d++; else if (CLOSE.includes(c)) d--;
        else if (d === 0 && (c === '+' || c === '-') && j > start && !/[*/^(,]/.test(s[j - 1])) { outT.push(s.slice(start, j)); start = j; }
      }
      outT.push(s.slice(start)); return outT.filter(t => t !== '');
    }
    const isInt = t => /^\d+$/.test(t);
    function flatSum(nd, sg, outL) {
      if (nd.k === '+') { flatSum(nd.l, sg, outL); flatSum(nd.r, sg, outL); }
      else if (nd.k === '-') { flatSum(nd.l, sg, outL); flatSum(nd.r, -sg, outL); }
      else if (nd.k === 'neg') flatSum(nd.x, -sg, outL);
      else outL.push({ sg, nd });
      return outL;
    }
    // product -> {sg, p, q (integer coefficient p/q as BigInt), num:[nodes], den:[nodes]}
    function flatProd(nd) {
      const T = { sg: 1, p: 1n, q: 1n, num: [], den: [] };
      (function walk(x, inDen) {
        if (x.k === '*') { walk(x.l, inDen); walk(x.r, inDen); }
        else if (x.k === '/') { walk(x.l, inDen); walk(x.r, !inDen); }
        else if (x.k === 'neg') { T.sg = -T.sg; walk(x.x, inDen); }
        else if (x.k === 'n' && isInt(x.v)) { if (inDen) T.q *= BigInt(x.v); else T.p *= BigInt(x.v); }
        else if (x.k === '^' && (x.r.k === 'neg' || (x.r.k === 'n' && false))) {
          const e = x.r.x; const base = (e.k === 'n' && e.v === '1') ? x.l : { k: '^', l: x.l, r: e };
          walk(base, !inDen);
        }
        else (inDen ? T.den : T.num).push(x);
      })(nd, false);
      return T;
    }
    const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    function rankF(x) {
      if (x.k === 'n') return 0;
      if (x.k === 's' && x.v === 'pi') return 1;
      if (x.k === 's' && x.v !== 'e') return 2;
      if (x.k === '^' && x.l.k === 's' && x.l.v !== 'e' && x.l.v !== 'pi' && x.r.k === 'n') return 2;
      if (x.k === '^' && x.l.k === 's' && x.l.v === 'e') return 2.5;
      return 3;
    }
    function monoDeg(T) {
      if (T.den.length) return null;
      let d = 0;
      for (const x of T.num) {
        if (x.k === 's' && !(x.v in CONST)) d += 1;
        else if (x.k === '^' && x.l.k === 's' && !(x.l.v in CONST) && x.r.k === 'n') d += Number(x.r.v);
        else if (x.k === 'n' || (x.k === 's' && x.v in CONST)) continue;
        else return null;
      }
      return d;
    }
    // print a tree; ap = approximate (decimals for numeric parts)
    function pr(nd, ap) { return prSum(nd, ap); }
    function prSum(nd, ap) {
      if (ap && !hasSym(nd)) { const v = evalNode(nd); if (isFinite(v)) return fmt(v); }
      const terms = flatSum(nd, 1, []).map(t => { const T = flatProd(t.nd); T.sg *= t.sg; return normTerm(T); });
      if (terms.length > 1) {
        const degs = terms.map(monoDeg);
        let order = terms.map((T, i) => i);
        if (degs.every(d => d !== null)) {
          const vec = T => { const m = {}; T.num.forEach(x => { if (x.k === 's') m[x.v] = (m[x.v] || 0) + 1; else if (x.k === '^' && x.l.k === 's') m[x.l.v] = (m[x.l.v] || 0) + Number(x.r.v); }); return m; };
          const names = Array.from(new Set(terms.flatMap(T => Object.keys(vec(T))))).sort();
          const lex = (a, b) => { const A = vec(terms[a]), B = vec(terms[b]); for (const n of names) { const d = (B[n] || 0) - (A[n] || 0); if (d) return d; } return 0; };
          order.sort((a, b) => degs[b] - degs[a] || lex(a, b) || a - b);
          // within the leading degree, prefer a positive term first (b^2-4*a*c, not -4*a*c+b^2)
          const top = order.filter(i => degs[i] === degs[order[0]]), pos = top.find(i => terms[i].sg > 0);
          if (terms[order[0]].sg < 0 && pos !== undefined) order = [pos].concat(order.filter(i => i !== pos));
        } else {
          const isC = i => !terms[i].num.length && !terms[i].den.length; order = order.filter(i => !isC(i)).concat(order.filter(isC));
          const firstPos = order.findIndex(i => terms[i].sg > 0);
          if (firstPos > 0) order = order.slice(firstPos).concat(order.slice(0, firstPos));
        }
        return order.map((i, j) => { const t = prTerm(terms[i], ap); return j === 0 ? t : (t[0] === '-' ? t : '+' + t); }).join('');
      }
      return prTerm(terms[0], ap);
    }
    const isSum = x => x.k === '+' || x.k === '-';
    const allSymNeg = x => { const ts = flatSum(x, 1, []).filter(t => hasSym(t.nd)); return ts.length > 0 && ts.every(t => t.sg * flatProd(t.nd).sg < 0); };
    function normTerm(T) {
      // -(3-y)/2 -> (y-3)/2 and 2/(3-y) -> -2/(y-3): flip a bracket whose variable terms are all negative
      if (T.sg < 0 && T.num.length === 1 && isSum(T.num[0])) { T.sg = 1; T.num[0] = { k: 'neg', x: T.num[0] }; }
      T.den = T.den.map(x => { if (isSum(x) && allSymNeg(x)) { T.sg = -T.sg; return { k: 'neg', x }; } return x; });
      return T;
    }
    function prFactor(x, ap) {
      // factor inside a product: sums need brackets
      const s = prAtomish(x, ap);
      return (x.k === '+' || x.k === '-' || x.k === 'neg') ? '(' + s + ')' : s;
    }
    function prAtomish(x, ap) {
      if (ap && !hasSym(x) && !(x.k === 's' && x.v === 'e')) { const v = evalNode(x); if (isFinite(v)) return fmt(v); }
      switch (x.k) {
        case 'n': return x.v;
        case 's': return x.v;
        case 'f': return x.v + '(' + x.a.map(y => prSum(y, ap)).join(',') + ')';
        case '!': return prBase(x.x, ap) + '!';
        case '^': {
          const ex = x.r, exS = prSum(ex, ap && hasSym(ex));
          const simpleEx = (ex.k === 'n' && isInt(ex.v)) || ex.k === 's';
          return prBase(x.l, ap) + '^' + (simpleEx ? exS : '(' + exS + ')');
        }
        default: return prSum(x, ap);
      }
    }
    function prBase(x, ap) {
      const s = prAtomish(x, ap);
      return (x.k === 'n' || x.k === 's' || x.k === 'f') && !/^-/.test(s) && !(ap && /[.E]/.test(s) && false) ? s : '(' + s + ')';
    }
    function prTerm(T, ap) {
      const g = bgcd(T.p, T.q) || 1n; let p = T.p / g, q = T.q / g;
      const num = T.num.slice().sort((a, b) => rankF(a) - rankF(b)), den = T.den.slice().sort((a, b) => rankF(a) - rankF(b));
      const sg = T.sg < 0 ? '-' : '';
      if (ap) {
        const c = Number(p) / Number(q) * (den.length ? 1 : 1);
        const fs = num.map(x => prFactor(x, ap));
        const ds = den.map(x => prFactor(x, ap));
        let body = (c !== 1 || !fs.length ? [fmt(c)] : []).concat(fs).join('*');
        if (ds.length) body += '/' + (ds.length > 1 ? '(' + ds.join('*') + ')' : ds[0]);
        return sg + body;
      }
      const fs = num.map(x => prFactor(x, ap)), ds = den.map(x => prFactor(x, ap));
      const top = (p !== 1n || !fs.length ? [String(p)] : []).concat(fs).join('*');
      const bot = (q !== 1n ? [String(q)] : []).concat(ds);
      if (!bot.length) return sg + top;
      return sg + top + '/' + (bot.length > 1 ? '(' + bot.join('*') + ')' : bot[0]);
    }
    function tidy(s) { return pr(parse(N(s).toString()), false); }
    function tidySafe(s) {
      s = String(s);
      if (/^-?\d+$/.test(s)) return s;
      try { const t = pr(parse(s), false); return t === s || sameValue(t, s) ? t : s; } catch (e) { return s; }
    }
    // numeric equivalence at sample points (nerdamer cannot always cancel rational differences to 0)
    function sameValue(a, b) {
      let vs; try { vs = Array.from(new Set(N(a).variables().concat(N(b).variables()))); } catch (e) { return false; }
      const fa = compile(a, vs), fb = compile(b, vs); let tested = 0;
      for (let k = 0; k < 6; k++) {
        const pt = vs.map((_, j) => [1.37, 2.71, 0.53, 4.19, -1.73, 3.29, -0.61][(k + 3 * j) % 7] + 0.07 * j), x = fa.apply(null, pt), y = fb.apply(null, pt);
        if (!isFinite(x) && !isFinite(y)) continue;
        if (!(Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)))) return false;
        tested++;
      }
      return tested > 0;
    }
    function approxStr(s) { try { return pr(parse(String(s)), true); } catch (e) { return null; } }

    // ------------------------------------------------------------ numerics
    function brent(f, a, b, fa, fb) {
      if (fa === undefined) fa = f(a); if (fb === undefined) fb = f(b);
      if (fa === 0) return a; if (fb === 0) return b;
      let c = a, fc = fa, d = b - a, e = d;
      for (let it = 0; it < 200; it++) {
        if (fb * fc > 0) { c = a; fc = fa; d = e = b - a; }
        if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
        const tol = 2e-16 * Math.abs(b) + 1e-300, m = 0.5 * (c - b);
        if (Math.abs(m) <= tol || fb === 0) return b;
        if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
          let p, q, r; const s = fb / fa;
          if (a === c) { p = 2 * m * s; q = 1 - s; }
          else { q = fa / fc; r = fb / fc; p = s * (2 * m * q * (q - r) - (b - a) * (r - 1)); q = (q - 1) * (r - 1) * (s - 1); }
          if (p > 0) q = -q; else p = -p;
          if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) { e = d; d = p / q; } else { d = m; e = m; }
        } else { d = m; e = m; }
        a = b; fa = fb;
        b += Math.abs(d) > tol ? d : (m > 0 ? tol : -tol);
        fb = f(b);
      }
      return b;
    }
    function goldenMin(f, a, b) {
      const g = (Math.sqrt(5) - 1) / 2; let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
      for (let i = 0; i < 120; i++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); } }
      return (a + b) / 2;
    }
    // all real roots of f on [lo, hi]; df optional (for touching roots)
    function findRoots(f, lo, hi, df, n) {
      n = n || 6000;
      const xs = [], ys = []; const h = (hi - lo) / n;
      for (let i = 0; i <= n; i++) { const x = lo + i * h; xs.push(x); ys.push(f(x)); }
      const roots = [];
      const add = r => { if (isFinite(r) && r >= lo - 1e-12 && r <= hi + 1e-12 && !roots.some(q => Math.abs(q - r) <= 1e-8 * Math.max(1, Math.abs(r)))) roots.push(r); };
      for (let i = 0; i < n; i++) {
        const y0 = ys[i], y1 = ys[i + 1];
        if (y0 === 0) { add(xs[i]); continue; }
        if (isFinite(y0) && isFinite(y1) && y0 * y1 < 0) {
          const r = brent(f, xs[i], xs[i + 1], y0, y1), fr = Math.abs(f(r));
          const local = Math.max(Math.abs(y0), Math.abs(y1));
          if (fr <= 1e-7 * Math.max(1, local) || fr < 1e-10) add(r);   // reject poles (sign change through an asymptote)
        }
      }
      // touching roots: strict local minima of |f| that reach zero (scale from nearby samples, not the whole range,
      // so flat regions like e^x-5 far left are not mistaken for roots)
      const W = 40;
      for (let i = 1; i < n; i++) {
        const a = Math.abs(ys[i - 1]), b = Math.abs(ys[i]), c = Math.abs(ys[i + 1]);
        if (!(isFinite(a) && isFinite(b) && isFinite(c))) continue;
        if (!(b <= a && b <= c && (b < a || b < c) && ys[i - 1] * ys[i + 1] > 0)) continue;
        let loc = 0; for (let j = Math.max(0, i - W); j <= Math.min(n, i + W); j++) if (isFinite(ys[j])) loc = Math.max(loc, Math.abs(ys[j]));
        if (!(b < 1e-2 * loc + 1e-12)) continue;
        let x;
        if (df) {
          const d0 = df(xs[i - 1]), d1 = df(xs[i + 1]);
          x = (isFinite(d0) && isFinite(d1) && d0 * d1 < 0) ? brent(df, xs[i - 1], xs[i + 1], d0, d1) : goldenMin(t => Math.abs(f(t)), xs[i - 1], xs[i + 1]);
        } else x = goldenMin(t => Math.abs(f(t)), xs[i - 1], xs[i + 1]);
        if (Math.abs(f(x)) < 1e-10 * Math.max(1e-3, loc)) add(x);
      }
      return roots.sort((p, q) => p - q);
    }
    // adaptive Gauss-Kronrod 7-15
    const GK = { x: [0.991455371120813, 0.949107912342759, 0.864864423359769, 0.741531185599394, 0.586087235467691, 0.405845151377397, 0.207784955007898, 0],
      wk: [0.022935322010529, 0.063092092629979, 0.104790010322250, 0.140653259715525, 0.169004726639267, 0.190350578064785, 0.204432940075298, 0.209482141084728],
      wg: [0, 0.129484966168870, 0, 0.279705391489277, 0, 0.381830050505119, 0, 0.417959183673469] };
    function gk(f, a, b) {
      const c = (a + b) / 2, h = (b - a) / 2; let k = 0, g = 0;
      for (let i = 0; i < 8; i++) {
        if (i === 7) { const v = f(c); k += GK.wk[7] * v; g += GK.wg[7] * v; continue; }
        const dx = h * GK.x[i], v = f(c - dx) + f(c + dx); k += GK.wk[i] * v; g += GK.wg[i] * v;
      }
      return [k * h, Math.abs((k - g) * h)];
    }
    let INT_BAD = false;
    function integrate(f, a, b, tol, depth) {
      tol = tol || 1e-11; depth = depth || 0;
      const [v, err] = gk(f, a, b);
      if (!isFinite(v)) return NaN;
      if (depth > 40 && err > 1e-6) INT_BAD = true;
      if (err <= Math.max(tol, 1e-14 * Math.abs(v)) || depth > 40) return v;
      const m = (a + b) / 2;
      return integrate(f, a, m, tol / 2, depth + 1) + integrate(f, m, b, tol / 2, depth + 1);
    }
    function nIntegrate(f, a, b) { INT_BAD = false; const v = nInt(f, a, b); return INT_BAD ? NaN : v; }
    function nInt(f, a, b) {
      if (a === b) return 0;
      if (a > b) return -nInt(f, b, a);
      if (a === -Infinity && b === Infinity) return nInt(f, -Infinity, 0) + nInt(f, 0, Infinity);
      if (b === Infinity) return integrate(t => { const x = a + t / (1 - t); return f(x) / ((1 - t) * (1 - t)); }, 0, 1 - 1e-12);
      if (a === -Infinity) return integrate(t => { const x = b - (1 - t) / t; return f(x) / (t * t); }, 1e-12, 1);
      return integrate(f, a, b);
    }

    // ------------------------------------------------------------ probability
    // erfc with Chebyshev fit (Numerical Recipes 3e), ~1.2e-16 relative
    const ERF_COF = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4, 3.66839497852761e-4,
      4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8, -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9,
      -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12, -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15,
      -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17];
    function erfccheb(z) {
      let d = 0, dd = 0; const t = 2 / (2 + z), ty = 4 * t - 2;
      for (let j = ERF_COF.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + ERF_COF[j]; dd = tmp; }
      return t * Math.exp(-z * z + 0.5 * (ERF_COF[0] + ty * d) - dd);
    }
    const erfc = x => x >= 0 ? erfccheb(x) : 2 - erfccheb(-x);
    const Phi = z => z === Infinity ? 1 : z === -Infinity ? 0 : 0.5 * erfc(-z / Math.SQRT2);
    function invPhi(p) {
      if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
      let x; const pl = 0.02425;
      if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
      else if (p <= 1 - pl) { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
      else { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
      for (let i = 0; i < 2; i++) { const e = Phi(x) - p, u = e * Math.sqrt(2 * PI) * Math.exp(x * x / 2); x = x - u / (1 + x * u / 2); }
      return x;
    }
    function lgamma(x) {
      const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
      if (x < 0.5) return Math.log(PI / Math.abs(Math.sin(PI * x))) - lgamma(1 - x);
      x -= 1; let a = c[0]; const t = x + g + 0.5;
      for (let i = 1; i < 9; i++) a += c[i] / (x + i);
      return 0.5 * Math.log(2 * PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
    }
    function binomPmf(n, p, k) {
      if (k < 0 || k > n || k !== Math.floor(k)) return 0;
      if (p === 0) return k === 0 ? 1 : 0; if (p === 1) return k === n ? 1 : 0;
      if (n <= 1000) { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c * Math.pow(p, k) * Math.pow(1 - p, n - k); }
      return Math.exp(lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p));
    }
    function factorialBig(n) { if (n < 0 || n !== Math.floor(n)) throw new Error('factorial needs a whole number'); let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r.toString(); }
    function nCrBig(n, r) { if (r < 0 || r > n) return '0'; r = Math.min(r, n - r); let a = 1n; for (let i = 1; i <= r; i++) a = a * BigInt(n - r + i) / BigInt(i); return a.toString(); }
    function nPrBig(n, r) { if (r < 0 || r > n) return '0'; let a = 1n; for (let i = 0; i < r; i++) a *= BigInt(n - i); return a.toString(); }

    // ------------------------------------------------------------ constraints after "|"
    function parseConstraints(c, vname) {
      const res = { subs: {}, lo: -Infinity, hi: Infinity, loInc: true, hiInc: true, has: false };
      if (!c) return res;
      splitTop(c.replace(/\band\b/g, '&&'), '&&').forEach(part => {
        part = part.trim(); if (!part) return;
        const chain = part.split(/(<=|>=|<|>)/).map(x => x.trim());
        if (chain.length === 5) { // a < x < b
          const [a, op1, v, op2, b] = chain;
          if (op1[0] === '<' && op2[0] === '<') { res.lo = num(a); res.hi = num(b); res.loInc = op1 === '<='; res.hiInc = op2 === '<='; }
          else { res.lo = num(b); res.hi = num(a); res.loInc = op2 === '>='; res.hiInc = op1 === '>='; }
          res.has = true; res.v = v; return;
        }
        if (chain.length === 3) {
          let [l, op, r] = chain;
          const isVar = t => /^[A-Za-z]\w*$/.test(t) && !isNumeric(t);
          if (!isVar(l) && isVar(r)) { [l, r] = [r, l]; op = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[op]; }
          const val = num(r);
          if (op[0] === '>') { res.lo = val; res.loInc = op === '>='; } else { res.hi = val; res.hiInc = op === '<='; }
          res.has = true; res.v = l; return;
        }
        const eq = part.split('=');
        if (eq.length === 2 && /^[A-Za-z]\w*$/.test(eq[0].trim())) { res.subs[eq[0].trim()] = eq[1].trim(); return; }
        throw new Error('Could not read the condition after |: ' + part);
      });
      return res;
    }
    function applySubs(expr, subs) {
      const keys = Object.keys(subs); if (!keys.length) return expr;
      const o = {}; keys.forEach(k => { o[k] = subs[k]; });
      return N(expr, o).toString();
    }

    // ------------------------------------------------------------ polynomial helpers
    // Coefficients (low -> high) of f as a polynomial in v, or null. Parsed from expand() output by hand:
    // nerdamer.coeffs() throws on non-polynomials and corrupts its global constant e while doing so.
    function polyCoeffs(f, v) {
      let e; try { e = N('expand(' + f + ')').toString(); } catch (err) { return null; }
      const powRe = new RegExp('^' + v + '(?:\\^(\\d+|\\(\\d+\\)))?$'), hasV = new RegExp('(^|[^A-Za-z0-9_])' + v + '([^A-Za-z0-9_]|$)');
      const co = [];
      for (let t of splitTerms(e)) {
        let sign = ''; if (t[0] === '+' || t[0] === '-') { sign = t[0] === '-' ? '-' : ''; t = t.slice(1); }
        let k = 0; const rest = []; let d = 0, start = 0, op = '*';
        const pieces = [];
        for (let j = 0; j <= t.length; j++) {
          const c = t[j];
          if (c !== undefined && OPEN.includes(c)) d++; else if (c !== undefined && CLOSE.includes(c)) d--;
          else if (j === t.length || (d === 0 && (c === '*' || c === '/'))) { pieces.push([op, t.slice(start, j)]); op = c; start = j + 1; }
        }
        for (const [o, fct] of pieces) {
          if (!hasV.test(fct)) { rest.push((rest.length ? o : (o === '/' ? '1/' : '')) + fct); continue; }
          const m = fct.match(powRe); if (!m || o === '/') return null;
          k += m[1] ? Number(m[1].replace(/[()]/g, '')) : 1;
        }
        if (k > 30) return null;
        const c = sign + (rest.length ? rest.join('') : '1');
        co[k] = co[k] === undefined ? c : co[k] + '+(' + c + ')';
      }
      if (!co.length) return null;
      for (let k = 0; k < co.length; k++) co[k] = co[k] === undefined ? '0' : N(co[k]).toString();
      // verify numerically at a few points (guards against anything the parser misread)
      try {
        const others = N(e).variables().filter(x => x !== v), fv = compile(e, [v].concat(others));
        for (let t = 0; t < 3; t++) {
          const xv = 0.37 + 1.13 * t, ov = others.map((_, i) => 0.71 + 0.29 * i + 0.17 * t), sub = {};
          others.forEach((o, i) => { sub[o] = String(ov[i]); });
          let p = 0; co.forEach((c, k) => { p += (isNumeric(c) ? num(c) : Number(N(c, sub).evaluate().text('decimals'))) * Math.pow(xv, k); });
          const q = fv.apply(null, [xv].concat(ov));
          if (!(Math.abs(p - q) <= 1e-8 * Math.max(1, Math.abs(q)))) return null;
        }
      } catch (err) { return null; }
      return co;
    }
    function rootsFromCoeffs(co, v) {
      // exact roots of a polynomial given low->high coefficient strings; returns {exact:[str], approx:[num]} or null
      const deg = co.length - 1; const c = co.map(x => N(x).toString());
      if (deg === 1) return [simp('-(' + c[0] + ')/(' + c[1] + ')')];
      if (deg === 2) {
        const [cc, b, a] = c; const disc = N('(' + b + ')^2-4*(' + a + ')*(' + cc + ')').toString();
        if (isNumeric(disc)) { const dv = num(disc); if (dv < -1e-14) return []; if (Math.abs(dv) < 1e-14) return [simp('-(' + b + ')/(2*(' + a + '))')]; }
        if (!c.every(isNumeric)) {
          const nb = N('-(' + b + ')').toString(), ta = N('2*(' + a + ')').toString(), dd = tidySafe(disc), P = x => /^[\w.]+$/.test(x) ? x : '(' + x + ')';
          return [(nb === '0' ? '-' : '(' + tidySafe(nb) + '-') + 'sqrt(' + dd + ')' + (nb === '0' ? '' : ')') + '/' + P(ta), (nb === '0' ? '' : '(' + tidySafe(nb) + '+') + 'sqrt(' + dd + ')' + (nb === '0' ? '' : ')') + '/' + P(ta)];
        }
        return [simp('(-(' + b + ')-sqrt(' + disc + '))/(2*(' + a + '))'), simp('(-(' + b + ')+sqrt(' + disc + '))/(2*(' + a + '))')];
      }
      return null;
    }
    function polyRealRoots(f, v, lo, hi) {
      const co = polyCoeffs(f, v); if (!co) return null;
      if (co.some(x => !isNumeric(x))) return { symbolic: true, co };
      const cv = co.map(num); while (cv.length > 1 && Math.abs(cv[cv.length - 1]) < 1e-300) cv.pop();
      const deg = cv.length - 1;
      if (deg === 0) return { roots: Math.abs(cv[0]) < 1e-14 ? 'all' : [] };
      const exact = [];
      // factor over the rationals, then solve each factor exactly where possible
      let factored = null; try { factored = N('factor(' + f + ')').toString(); } catch (e) { /* ignore */ }
      const pieces = factored ? splitFactors(factored) : [f];
      const numericLeft = [];
      pieces.forEach(pc => {
        if (!N(pc).variables().includes(v)) return;
        const pcc = polyCoeffs(pc, v);
        let r = pcc ? rootsFromCoeffs(pcc, v) : null;
        if (!r) { const iso = isolate(pc, v); if (iso) { const ok = checkCands(iso, pc, v, [], { lo: -Infinity, hi: Infinity, loInc: true, hiInc: true, subs: {} }); if (ok.length) r = ok.map(c => c.s); } }
        if (r) r.forEach(x => exact.push(x)); else numericLeft.push(pc);
      });
      const out = [];
      exact.forEach(s => { try { if (/\bi\b/.test(s)) return; const x = num(s); if (isFinite(x)) out.push({ s, x }); } catch (e) { /* complex */ } });
      numericLeft.forEach(pc => {
        const pv = polyCoeffs(pc, v).map(num); const an = pv[pv.length - 1];
        const R = 1 + Math.max.apply(null, pv.slice(0, -1).map(c => Math.abs(c / an)));
        const fn = compile(pc, [v]), dfn = compile(N('diff(' + pc + ',' + v + ')').toString(), [v]);
        findRoots(fn, -R - 1, R + 1, dfn, 20000).forEach(x => { const rec = recognize(x); out.push({ s: rec || fmt(x), x, approx: !rec }); });
      });
      return { roots: dedupe(out).filter(r => inRange(r.x, lo, hi)) };
    }
    function splitFactors(s) {
      // top-level product -> factors (powers kept once); strips leading numeric factors
      let parts = [];
      s = String(s).trim();
      if (splitTerms(s).length > 1) return [s];
      if (s[0] === '-') s = s.slice(1);
      splitTop(s, '*').forEach(p => {
        const m = p.match(/^\((.*)\)\^(\d+)$/); if (m && matchClose(p, 0) === p.lastIndexOf(')')) parts.push(m[1]);
        else parts.push(p.replace(/^\((.*)\)$/, (a, b) => (matchClose(a, 0) === a.length - 1 ? b : a)));
      });
      return parts;
    }
    function dedupe(rs) {
      const out = [];
      rs.sort((a, b) => a.x - b.x).forEach(r => { if (!out.some(q => Math.abs(q.x - r.x) <= 1e-8 * Math.max(1, Math.abs(r.x)))) out.push(r); });
      return out;
    }
    const inRange = (x, lo, hi) => x >= lo - 1e-12 * Math.max(1, Math.abs(lo)) && x <= hi + 1e-12 * Math.max(1, Math.abs(hi));

    // ------------------------------------------------------------ solve (one variable)
    function findPeriod(fn) {
      const base = ST.angle === 'deg' ? 360 : 2 * PI;
      const cands = [];
      for (let b = 1; b <= 24; b++) for (let a = 1; a <= 8; a++) cands.push(base * a / b);
      cands.sort((p, q) => p - q);
      const pts = [0.3, 1.1, 2.7, -0.9, 4.2];
      for (const P of cands) {
        if (pts.every(x => { const y0 = fn(x), y1 = fn(x + P); return isFinite(y0) && isFinite(y1) && Math.abs(y0 - y1) <= 1e-9 * Math.max(1, Math.abs(y0)); })) return P;
      }
      return null;
    }
    function periodStr(P) {
      if (ST.angle === 'deg') { const r = ratApprox(P, 100); return r ? fracStr(r[0], r[1]) : fmt(P); }
      return recognize(P) || fmt(P);
    }
    // ------------------------------------------------------------ isolate: v appears once, so undo each operation
    function isolate(f, v) {
      let tree; try { tree = parse(N(f).toString()); } catch (e) { return null; }
      if (countSym(tree, v) !== 1) return null;
      const outL = []; let ok = true;
      const S = nd => pr(nd, false), P = t => '(' + t + ')';
      (function go(nd, T) {
        if (!ok) return;
        if (nd.k === 's' && nd.v === v) { outL.push(T); return; }
        const L = nd.l, Rt = nd.r;
        switch (nd.k) {
          case '+': return hasSym(L, v) ? go(L, P(T) + '-' + P(S(Rt))) : go(Rt, P(T) + '-' + P(S(L)));
          case '-': return hasSym(L, v) ? go(L, P(T) + '+' + P(S(Rt))) : go(Rt, P(S(L)) + '-' + P(T));
          case '*': return hasSym(L, v) ? go(L, P(T) + '/' + P(S(Rt))) : go(Rt, P(T) + '/' + P(S(L)));
          case '/': return hasSym(L, v) ? go(L, P(T) + '*' + P(S(Rt))) : go(Rt, P(S(L)) + '/' + P(T));
          case 'neg': return go(nd.x, '-' + P(T));
          case '^': {
            if (hasSym(L, v)) {
              if (hasSym(Rt, v)) { ok = false; return; }
              const k = evalNode(Rt), root = P(T) + '^(1/' + P(S(Rt)) + ')';
              go(L, root);
              if (isFinite(k) && Number.isInteger(k) && k % 2 === 0) go(L, '-' + P(root));
              return;
            }
            return go(Rt, (L.k === 's' && L.v === 'e') ? 'log(' + T + ')' : 'log(' + T + ')/log(' + S(L) + ')');
          }
          case 'f': {
            if (nd.a.length !== 1) { ok = false; return; }
            const A = nd.a[0];
            switch (nd.v) {
              case 'log': return go(A, 'e^' + P(T));
              case 'exp': return go(A, 'log(' + T + ')');
              case 'log10': return go(A, '10^' + P(T));
              case 'sqrt': return go(A, P(T) + '^2');
              case 'cbrt': return go(A, P(T) + '^3');
              case 'abs': go(A, T); go(A, '-' + P(T)); return;
              case 'sin': case 'cos': case 'tan': return go(A, 'a' + nd.v + '(' + T + ')');
              case 'asin': case 'acos': case 'atan': return go(A, nd.v.slice(1) + '(' + T + ')');
            }
            ok = false; return;
          }
          default: ok = false;
        }
      })(tree, '0');
      return ok && outL.length ? outL : null;
    }
    const SAMPLE = [1.37, 2.71, 0.53, 4.19, -1.73, 1.83, 3.29, -0.61, 0.87];
    // keep candidate solutions that really satisfy f = 0 (and the domain); works for symbolic answers too
    function checkCands(cands, f, v, others, cons) {
      const fv = compile(f, [v].concat(others));
      const samples = others.length ? SAMPLE.map((_, k) => others.map((o, j) => SAMPLE[(k + 2 * j) % SAMPLE.length] + 0.13 * j)) : [[]];
      const res = [];
      cands.forEach(X => {
        let Xs; try { Xs = simp(X); } catch (e) { return; }
        if (/\bi\b/.test(Xs)) return;
        const xf = compile(Xs, others); let okc = 0, outc = 0, xv0 = NaN;
        samples.forEach(sv => {
          const xv = xf.apply(null, sv); if (!isFinite(xv)) return;
          const fx = fv.apply(null, [xv].concat(sv));
          if (!(Math.abs(fx) < 1e-8 * Math.max(1, Math.abs(xv)))) return;
          if (filterStrict([{ x: xv }], cons).length) { okc++; if (isNaN(xv0)) xv0 = xv; } else outc++;
        });
        if (!okc || outc) return;
        if (others.length) { const t = tidySafe(niceExact(Xs)); if (!res.some(r => r.s === t)) res.push({ s: t, x: NaN, symbolic: true }); }
        else if (!res.some(r => Math.abs(r.x - xv0) <= 1e-9 * Math.max(1, Math.abs(xv0)))) res.push({ s: niceExact(Xs), x: xv0 });
      });
      return res.sort((a, b) => (a.x - b.x) || 0);
    }

    function solveOne(eqStr, v, cons) {
      let [lhs, rhs] = splitEq(eqStr);
      lhs = applySubs(lhs, cons.subs); rhs = applySubs(rhs, cons.subs);
      const f = N('(' + lhs + ')-(' + rhs + ')').toString();
      const lo = cons.lo, hi = cons.hi;
      const vars = N(f).variables();
      if (!vars.includes(v)) {
        if (vars.length === 0) { const z = Math.abs(num(f)) < 1e-12; return { kind: 'bool', value: z }; }
        throw new Error(v + ' does not appear in the equation');
      }
      const others = vars.filter(x => x !== v);
      // polynomial route
      const pr = polyRealRoots(f, v, lo, hi);
      if (pr && pr.roots === 'all') return { kind: 'bool', value: true };
      if (pr && pr.roots) return { kind: 'roots', roots: filterStrict(pr.roots, cons, f, v) };
      const trig = TRIG.test(f);
      if (!trig || others.length) {
        const iso = isolate(f, v);
        if (iso) {
          const rs = checkCands(iso, f, v, others, cons);
          if (rs.length) return { kind: 'roots', roots: rs, note: trig ? 'Principal values only. For every solution, give values for ' + others.join(', ') + ' and a domain.' : null };
          if (!others.length) return { kind: 'roots', roots: [] };
        }
      }
      if (others.length) {
        // symbolic parameters: quadratic/linear formulas, else nerdamer
        if (pr && pr.symbolic && pr.co.length <= 3) {
          const r = rootsFromCoeffs(pr.co, v) || [];
          const keep = cons.has ? checkCands(r, f, v, others, cons).map(x => x.s) : null;
          return { kind: 'roots', roots: r.filter((s, i) => !keep || checkCands([s], f, v, others, cons).length).map(s => ({ s, x: NaN, symbolic: true })) };
        }
        let sols; try { sols = nerdamer.solve(f + '=0', v).toString(); } catch (e) { sols = null; }
        if (sols) { const arr = splitTop(sols.replace(/^\[|\]$/g, ''), ',').filter(Boolean); const rs = checkCands(arr, f, v, others, cons); if (rs.length) return { kind: 'roots', roots: rs }; }
        throw new Error('Could not solve symbolically. Give values for ' + others.join(', ') + ' (use | ' + others[0] + '=…)');
      }
      // numeric route with exact recognition
      const fn = compile(f, [v]);
      let dfn = null; try { dfn = compile(N('diff(' + f + ',' + v + ')').toString(), [v]); } catch (e) { /* none */ }
      if (!cons.has && TRIG.test(f)) {
        const P = findPeriod(fn);
        if (P) {
          let rs = findRoots(fn, 0, P, dfn, 6000).filter(x => x < P - 1e-9 * P), PP = P;
          if (rs.length > 1) { const step = P / rs.length; if (rs.every((x, i) => i === 0 || Math.abs(x - rs[i - 1] - step) < 1e-9 * P)) { rs = [rs[0]]; PP = step; } }
          const roots = rs.map(x => { const rec = recognize(x); return { s: rec || fmt(x), x, approx: !rec }; });
          return { kind: 'general', roots, period: periodStr(PP) };
        }
      }
      let L = isFinite(lo) ? lo : -1000, H = isFinite(hi) ? hi : 1000;
      const n = Math.min(400000, Math.max(8000, Math.round((H - L) * 40)));
      const rs = findRoots(fn, L, H, dfn, n);
      const roots = rs.map(x => { const rec = recognize(x); return { s: rec || fmt(x), x, approx: !rec }; });
      return { kind: 'roots', roots: filterStrict(roots, cons, f, v), searched: (!isFinite(lo) || !isFinite(hi)) ? [L, H] : null };
    }
    function filterStrict(roots, cons, f, v) {
      return roots.filter(r => {
        if (!isFinite(r.x)) return true;
        if (r.x < cons.lo || r.x > cons.hi) return false;
        if (!cons.loInc && Math.abs(r.x - cons.lo) < 1e-12 * Math.max(1, Math.abs(r.x))) return false;
        if (!cons.hiInc && Math.abs(r.x - cons.hi) < 1e-12 * Math.max(1, Math.abs(r.x))) return false;
        return true;
      });
    }
    function splitEq(s) {
      const [i] = topIndex(s, ['=']);
      if (i < 0) return [s, '0'];
      return [s.slice(0, i), s.slice(i + 1)];
    }
    function rootsOut(v, res, decimalOnly) {
      if (res.kind === 'bool') return { tex: res.value ? '\\text{true}' : '\\text{false}', text: res.value ? 'true' : 'false', note: res.value ? 'True for every value.' : 'No solution.' };
      const rs = res.roots;
      if (!rs.length) return { tex: '\\text{false}', text: 'false', note: 'No real solutions' + (res.searched ? ' found for ' + fmt(res.searched[0]) + ' ≤ ' + v + ' ≤ ' + fmt(res.searched[1]) + ' (add a domain with | to search elsewhere)' : '') + '.' };
      const one = r => decimalOnly || r.approx ? fmt(r.x) : tidySafe(r.s);
      if (res.kind === 'general') {
        const Pn = tidySafe(N('(' + res.period + ')*n').toString()), zero = r => Math.abs(r.x) < 1e-14;
        return { tex: rs.map(r => v + '=' + (zero(r) ? '' : (decimalOnly || r.approx ? fmtTex(r.x) : exactTex(r.s)) + '+') + exactTex(Pn)).join('\\ \\text{or}\\ ') + '\\quad(n\\in\\mathbb{Z})',
          text: rs.map(r => v + '=' + (zero(r) ? '' : one(r) + '+') + Pn).join(' or '), approx: rs.map(r => v + '≈' + fmt(r.x)).join(' or ') + ' (n = 0)', note: 'General solution: n is any integer (the Nspire shows this as n1).' };
      }
      return { tex: rs.map(r => v + '=' + (decimalOnly || r.approx ? fmtTex(r.x) : exactTex(r.s))).join('\\ \\text{or}\\ '), text: rs.map(r => v + '=' + one(r)).join(' or '),
        approx: rs.every(r => isFinite(r.x)) ? rs.map(r => v + '≈' + fmt(Math.abs(r.x) < 1e-13 ? 0 : r.x)).join(' or ') : null, roots: rs, note: res.note ? res.note : res.searched ? 'Searched ' + fmt(res.searched[0]) + ' ≤ ' + v + ' ≤ ' + fmt(res.searched[1]) + '. Add a domain with | to search elsewhere.' : null };
    }

    // inequalities in one variable
    function solveIneq(s, v, cons) {
      const [i, op] = topIndex(s, ['<=', '>=', '<', '>']);
      const lhs = applySubs(s.slice(0, i), cons.subs), rhs = applySubs(s.slice(i + op.length), cons.subs);
      const f = N('(' + lhs + ')-(' + rhs + ')').toString(); const fn = compile(f, [v]);
      let L = isFinite(cons.lo) ? cons.lo : -1000, H = isFinite(cons.hi) ? cons.hi : 1000;
      const res = solveOne(f + '=0', v, Object.assign({}, cons, { subs: {} }));
      const roots = (res.roots || []).filter(r => isFinite(r.x));
      // also breakpoints where the function is undefined / has poles
      const pts = [{ x: L, s: null, edge: !isFinite(cons.lo) }].concat(roots).concat([{ x: H, s: null, edge: !isFinite(cons.hi) }]);
      const want = y => op === '<' ? y < 0 : op === '>' ? y > 0 : op === '<=' ? y <= 1e-12 : y >= -1e-12;
      const segs = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1]; if (b.x - a.x < 1e-12) continue;
        const mid = (a.x + b.x) / 2, y = fn(mid);
        if (isFinite(y) && want(y)) segs.push([a, b]);
      }
      // merge touching segments (when the root itself satisfies a non-strict inequality)
      const strict = op === '<' || op === '>';
      const merged = [];
      segs.forEach(sg => { const last = merged[merged.length - 1]; if (last && last[1] === sg[0] && !strict) last[1] = sg[1]; else merged.push(sg.slice()); });
      if (!merged.length) return { tex: '\\text{false}', text: 'false', note: 'No real solutions.' };
      const lt = strict ? '<' : '\\le', ltT = strict ? '<' : '≤';
      const pt = (p, side) => p.edge ? null : (p.s ? p.s : fmt(p.x));
      const texParts = [], txtParts = [];
      merged.forEach(([a, b]) => {
        const A = pt(a), B = pt(b);
        const aStrict = a.edge ? strict : (a.s ? strict : !cons.loInc), bStrict = b.edge ? strict : (b.s ? strict : !cons.hiInc);
        const la = (a.s ? lt : (aStrict ? '<' : '\\le')), lb = (b.s ? lt : (bStrict ? '<' : '\\le'));
        if (A === null && B === null) { texParts.push('\\text{true}'); txtParts.push('true'); }
        else if (A === null) { texParts.push(v + lb + exactTex(B)); txtParts.push(v + (lb === '<' ? '<' : '≤') + B); }
        else if (B === null) { texParts.push(v + (la === '<' ? '>' : '\\ge') + exactTex(A)); txtParts.push(v + (la === '<' ? '>' : '≥') + A); }
        else { texParts.push(exactTex(A) + la + v + lb + exactTex(B)); txtParts.push(A + (la === '<' ? '<' : '≤') + v + (lb === '<' ? '<' : '≤') + B); }
      });
      return { tex: texParts.join('\\ \\text{or}\\ '), text: txtParts.join(' or '), note: (!isFinite(cons.lo) || !isFinite(cons.hi)) && !polyCoeffs(f, v) ? 'Checked ' + fmt(L) + ' ≤ ' + v + ' ≤ ' + fmt(H) + '.' : null };
    }

    // ---- linear systems: exact Gauss-Jordan over the rationals (BigInt fractions), parametric answers like the Nspire's c1
    const fr = (p, q) => { if (q < 0n) { p = -p; q = -q; } const g = bgcd(p, q) || 1n; return [p / g, q / g]; };
    const fadd = (a, b) => fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]), fsub = (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
    const fmul = (a, b) => fr(a[0] * b[0], a[1] * b[1]), fdiv = (a, b) => fr(a[0] * b[1], a[1] * b[0]);
    const fstr = a => a[1] === 1n ? String(a[0]) : a[0] + '/' + a[1];
    function linearParts(fs, vs) {
      const F = fs.map(f => compile(f, vs)), z = vs.map(() => 0), f0 = F.map(g => g.apply(null, z));
      if (f0.some(v => !isFinite(v))) return null;
      const A = F.map((g, i) => vs.map((_, j) => { const e = z.slice(); e[j] = 1; return g.apply(null, e) - f0[i]; }));
      if (A.some(r => r.some(v => !isFinite(v)))) return null;
      for (let t = 0; t < 3; t++) {
        const x = vs.map((_, j) => SAMPLE[(3 * t + j) % SAMPLE.length] * (t + 1));
        for (let i = 0; i < fs.length; i++) {
          const pred = f0[i] + A[i].reduce((m, a, j) => m + a * x[j], 0), act = F[i].apply(null, x);
          if (!(Math.abs(pred - act) <= 1e-9 * Math.max(1, Math.abs(act), Math.abs(pred)))) return null;
        }
      }
      return { A, b: f0.map(v => -v) };
    }
    function solveLinear(A, b, vs) {
      const m = A.length, n = vs.length;
      const toF = x => { const r = ratApprox(x, 1e7); return r ? [BigInt(r[0]), BigInt(r[1])] : null; };
      let M = A.map((row, i) => row.concat([b[i]]).map(toF));
      const exactOK = M.every(r => r.every(Boolean));
      if (!exactOK) return null;                                   // irrational coefficients: let the numeric route handle it
      const piv = []; let r = 0;
      for (let c = 0; c < n && r < m; c++) {
        let p = -1; for (let i = r; i < m; i++) if (M[i][c][0] !== 0n) { p = i; break; }
        if (p < 0) continue;
        [M[r], M[p]] = [M[p], M[r]];
        const inv = M[r][c]; M[r] = M[r].map(v => fdiv(v, inv));
        for (let i = 0; i < m; i++) if (i !== r && M[i][c][0] !== 0n) { const k = M[i][c]; M[i] = M[i].map((v, j) => fsub(v, fmul(k, M[r][j]))); }
        piv.push(c); r++;
      }
      for (let i = r; i < m; i++) if (M[i][n][0] !== 0n) return { none: true };
      const free = []; for (let c = 0; c < n; c++) if (!piv.includes(c)) free.push(c);
      const pname = {}; free.forEach((c, k) => { pname[c] = 'c' + (k + 1); });
      const sol = vs.map((v, c) => {
        if (pname[c]) return { v, s: pname[c], x: NaN, symbolic: true };
        const row = M[piv.indexOf(c)];
        let str = fstr(row[n]);
        free.forEach(f => { const k = row[f]; if (k[0] !== 0n) str += '-(' + fstr(k) + ')*' + pname[f]; });
        const val = free.length ? NaN : Number(row[n][0]) / Number(row[n][1]);
        return { v, s: free.length ? tidySafe(N(str).toString()) : fstr(row[n]), x: val, symbolic: !!free.length };
      });
      return { sol, free: free.length };
    }

    function detStr(M) { return M.length === 1 ? '(' + M[0][0] + ')' : '(' + M[0].map((c, j) => (j % 2 ? '-' : '+') + '(' + c + ')*' + detStr(M.slice(1).map(r => r.filter((_, k) => k !== j)))).join('') + ')'; }
    // square linear systems with letters in the coefficients: Cramer's rule
    function cramer(fs, vs) {
      const n = vs.length; if (fs.length !== n || n > 4) return null;
      const others = Array.from(new Set(fs.flatMap(f => N(f).variables()))).filter(x => !vs.includes(x)); if (!others.length) return null;
      const A = [], b = [];
      for (const f of fs) {
        const row = [];
        for (const v of vs) { const co = polyCoeffs(f, v); if (!co || co.length > 2) return null; const c1 = co[1] || '0'; if (N(c1).variables().some(x => vs.includes(x))) return null; row.push(c1); }
        const z = {}; vs.forEach(v => { z[v] = '0'; }); A.push(row); b.push(N('-(' + N(f, z).toString() + ')').toString());
      }
      const D = simp(detStr(A), true); if (D === '0') return null;
      const sol = vs.map((v, j) => { const Aj = A.map((r, i) => r.map((c, k) => (k === j ? b[i] : c))); return { v, s: tidySafe(simp('(' + detStr(Aj) + ')/(' + D + ')', true)), x: NaN, symbolic: true }; });
      let Dt = tidySafe(D); if (Dt[0] === '-') Dt = tidySafe(N('-(' + D + ')').toString());
      const o = [sol]; o.note = 'Valid when ' + Dt + ' ≠ 0.'; return o;
    }
    // systems of equations
    function solveSystem(eqs, vs) {
      const fs = eqs.map(e => { const [l, r] = splitEq(e); return N('(' + l + ')-(' + r + ')').toString(); });
      const lin = linearParts(fs, vs);
      if (lin) {
        const L = solveLinear(lin.A, lin.b, vs);
        if (L && L.none) { const o = []; o.note = 'No solution: the equations are inconsistent.'; return o; }
        if (L) { const o = [L.sol]; if (L.free) o.note = 'Infinitely many solutions: ' + Array.from({ length: L.free }, (_, k) => 'c' + (k + 1)).join(', ') + (L.free > 1 ? ' are any real numbers.' : ' is any real number.'); return o; }
      }
      const cr = cramer(fs, vs); if (cr) return cr;
      try {
        const sol = nerdamer.solveEquations(eqs.map(e => e.includes('=') ? e : e + '=0'), vs);
        const map = {}; sol.forEach(([k, val]) => { map[k] = String(val); });
        if (vs.every(k => map[k] !== undefined)) {
          const sub = {}; vs.forEach(k => { sub[k] = map[k]; });
          const ok = fs.every(f => { try { return Math.abs(num(N(f, sub).toString())) < 1e-9; } catch (e) { return false; } });
          if (ok) return [vs.map(k => ({ v: k, s: niceExact(N(map[k]).toString()), x: (() => { try { return num(map[k]); } catch (e) { return NaN; } })() }))];
        }
      } catch (e) { /* fall through to numeric */ }
      // numeric multi-start Newton
      const F = fs.map(f => compile(f, vs));
      const n = vs.length, sols = [];
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let s = 0; s < 400; s++) {
        let x = vs.map(() => (rnd() - 0.5) * (s < 200 ? 20 : 200));
        for (let it = 0; it < 80; it++) {
          const f0 = F.map(g => g.apply(null, x)); if (f0.some(y => !isFinite(y))) break;
          if (Math.max.apply(null, f0.map(Math.abs)) < 1e-13) break;
          const J = F.map(g => vs.map((_, j) => { const h = 1e-7 * Math.max(1, Math.abs(x[j])); const xp = x.slice(); xp[j] += h; return (g.apply(null, xp) - g.apply(null, x)) / h; }));
          // Levenberg-Marquardt step: (JᵀJ + λI) dx = -Jᵀf copes with singular or non-square systems
          const JtJ = vs.map((_, a) => vs.map((_, b) => J.reduce((m, row) => m + row[a] * row[b], 0) + (a === b ? 1e-10 + 1e-6 * J.reduce((m, row) => m + row[a] * row[a], 0) : 0)));
          const Jtf = vs.map((_, a) => -J.reduce((m, row, i) => m + row[a] * f0[i], 0));
          const dx = linSolve(JtJ, Jtf); if (!dx) break;
          let t = 1; for (let k = 0; k < 20; k++) { const xn = x.map((xi, j) => xi + t * dx[j]); const fn2 = F.map(g => g.apply(null, xn)); if (fn2.every(isFinite) && norm(fn2) < norm(f0) * (1 - 1e-4 * t) + 1e-300) { x = xn; break; } t /= 2; if (k === 19) x = xn; }
        }
        const res = F.map(g => g.apply(null, x)), sc = 1 + Math.max.apply(null, x.map(Math.abs));
        if (res.every(y => Math.abs(y) < 1e-9 * sc) && x.every(isFinite) && !sols.some(q => q.every((qv, j) => Math.abs(qv - x[j]) < 1e-7 * Math.max(1, Math.abs(x[j]))))) sols.push(x);
        if (sols.length >= 8) break;
      }
      // a singular Jacobian at the solutions means a curve of solutions, not isolated points: say so instead of listing samples
      if (sols.length && n > 1) {
        const x = sols[0], J = F.map(g => vs.map((_, j) => { const h = 1e-6 * Math.max(1, Math.abs(x[j])); const xp = x.slice(), xm = x.slice(); xp[j] += h; xm[j] -= h; return (g.apply(null, xp) - g.apply(null, xm)) / (2 * h); }));
        if (F.length < n || !linSolve(J, J.map(() => 1)) || sols.length >= 6) {
          const o = []; o.note = 'Infinitely many solutions (the equations are dependent or there are fewer equations than unknowns). Add an equation, or fix a variable with |.'; return o;
        }
      }
      return sols.sort((a, b) => a[0] - b[0]).map(x => vs.map((k, j) => { const rec = recognize(x[j]); return { v: k, s: rec || fmt(x[j]), x: x[j], approx: !rec }; }));
    }
    const norm = a => Math.sqrt(a.reduce((m, y) => m + y * y, 0));
    function linSolve(A, b) {
      const n = A.length, M = A.map((r, i) => r.concat([b[i]]));
      for (let c = 0; c < n; c++) {
        let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
        if (Math.abs(M[p][c]) < 1e-300) return null; [M[c], M[p]] = [M[p], M[c]];
        for (let r = 0; r < n; r++) if (r !== c) { const k = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j]; }
      }
      return M.map((r, i) => r[n] / r[i]);
    }

    // ------------------------------------------------------------ extrema
    function extremum(expr, v, cons, kind) {
      const f = applySubs(expr, cons.subs); const fn = compile(f, [v]);
      const bounded = isFinite(cons.lo) && isFinite(cons.hi);
      const L = isFinite(cons.lo) ? cons.lo : -1000, H = isFinite(cons.hi) ? cons.hi : 1000;
      const n = 20000, sgn = kind === 'min' ? 1 : -1; let best = Infinity, bx = NaN;
      for (let i = 0; i <= n; i++) { const x = L + (H - L) * i / n, y = sgn * fn(x); if (isFinite(y) && y < best) { best = y; bx = x; } }
      if (!isFinite(bx)) throw new Error('The function is undefined on that interval');
      const atEdge = Math.abs(bx - L) < 1e-12 || Math.abs(bx - H) < 1e-12;
      if (atEdge && ((bx === L && !isFinite(cons.lo)) || (bx === H && !isFinite(cons.hi)))) return { unbounded: true, dir: bx === L ? '-∞' : '∞' };
      let x = bx;
      if (!atEdge) {
        const h = (H - L) / n;
        let df = null; try { df = compile(N('diff(' + f + ',' + v + ')').toString(), [v]); } catch (e) { /* numeric */ }
        const a = Math.max(L, bx - h), b = Math.min(H, bx + h);
        if (df && isFinite(df(a)) && isFinite(df(b)) && df(a) * df(b) < 0) x = brent(df, a, b);
        else x = goldenMin(t => sgn * fn(t), a, b);
      }
      const rec = recognize(x);
      return { x, s: rec || fmt(x), approx: !rec, y: fn(x) };
    }

    // ------------------------------------------------------------ matrices + lists
    function convertMatrices(s) {
      // Nspire [1,2;3,4] or [[1,2][3,4]] -> nerdamer matrix([1,2],[3,4])
      return s.replace(/\[([^\[\]]*;[^\[\]]*)\]/g, (m, body) => 'matrix(' + body.split(';').map(r => '[' + r.trim() + ']').join(',') + ')')
        .replace(/\[\s*(\[[^\[\]]*\](?:\s*,?\s*\[[^\[\]]*\])+)\s*\]/g, (m, body) => 'matrix(' + body.replace(/\]\s*,?\s*\[/g, '],[') + ')');
    }
    function fixInverse(s) {
      // matrix(...)^(-1) means the inverse, not element-wise reciprocals
      let i = s.lastIndexOf('matrix(');
      while (i >= 0) {
        const c = matchClose(s, i + 6), rest = s.slice(c + 1), m = rest.match(/^\s*\^\s*(\(\s*-1\s*\)|-1)/);
        if (c > 0 && m) s = s.slice(0, i) + 'invert(' + s.slice(i, c + 1) + ')' + rest.slice(m[0].length);
        i = i > 0 ? s.lastIndexOf('matrix(', i - 1) : -1;
      }
      return s;
    }
    function listVals(arg) {
      const a = arg.trim();
      if (!/^\{.*\}$/.test(a)) throw new Error('Give a list like {1,2,3}');
      return splitTop(a.slice(1, -1), ',').filter(x => x !== '');
    }

    // ------------------------------------------------------------ command table
    const CMD = {};
    const out = (tex, text, extra) => Object.assign({ tex, text }, extra || {});
    const exact = (s, extra) => {
      const str = tidySafe(String(s)); let ap = null;
      try { ap = isNumeric(str) ? fmt(num(str)) : approxStr(str); } catch (e) { ap = null; }
      if (ap === str) ap = null;
      return out(exactTex(str), str, Object.assign({ approx: ap }, extra || {}));
    };
    const decimal = (x, extra) => out(fmtTex(x), fmt(x), Object.assign({ approx: fmt(x), value: x }, extra || {}));

    CMD.solve = (a, cons) => {
      if (a.length < 2) throw new Error('Use solve(equation, variable)');
      let eqs = a[0], vs = a.slice(1).join(',');
      vs = vs.replace(/^\{|\}$/g, '').split(',').map(x => x.trim()).filter(Boolean);
      if (/^\{.*\}$/.test(eqs) || /\band\b/.test(eqs)) {
        const list = /^\{.*\}$/.test(eqs) ? splitTop(eqs.slice(1, -1), ',') : eqs.split(/\band\b/).map(x => x.trim());
        const sols = solveSystem(list.map(e => applySubs(e, cons.subs)), vs);
        if (!sols.length) return out('\\text{false}', 'false', { note: sols.note || 'No solution found.' });
        const allNum = sols.every(sol => sol.every(r => isFinite(r.x)));
        return out(sols.map(sol => sol.map(r => r.v + '=' + (r.approx ? fmtTex(r.x) : exactTex(r.s))).join('\\ \\text{and}\\ ')).join('\\ \\text{or}\\ '),
          sols.map(sol => sol.map(r => r.v + '=' + r.s).join(' and ')).join(' or '), { approx: allNum ? sols.map(sol => sol.map(r => r.v + '≈' + fmt(r.x)).join(' and ')).join(' or ') : null, note: sols.note || null });
      }
      const v = vs[0];
      if (topIndex(eqs, ['<=', '>=', '<', '>'])[0] >= 0) return solveIneq(eqs, v, cons);
      const res = solveOne(eqs, v, cons);
      return rootsOut(v, res);
    };
    CMD.nsolve = (a, cons) => {
      const v = (a[1] || 'x').trim(); const guess = a[2] !== undefined ? num(a[2]) : null;
      const res = solveOne(a[0], v, cons);
      const rs = (res.roots || []).filter(r => isFinite(r.x));
      if (!rs.length) return out('\\text{No solution found}', 'No solution found', { note: 'Try a domain: nSolve(eq,x) | 0≤x≤5' });
      let r = rs[0]; if (guess !== null) r = rs.reduce((b, q) => Math.abs(q.x - guess) < Math.abs(b.x - guess) ? q : b, rs[0]);
      return decimal(r.x, { tex: v + '=' + fmtTex(r.x), text: v + '=' + fmt(r.x), note: rs.length > 1 ? 'Other solutions: ' + rs.filter(q => q !== r).map(q => fmt(q.x)).join(', ') : null });
    };
    CMD.zeros = (a, cons) => {
      const v = (a[1] || 'x').trim(); const res = solveOne(a[0] + '=0', v, cons);
      if (res.kind === 'general') { const o = rootsOut(v, res); return o; }
      const rs = res.roots || [];
      return out('\\left\\{' + rs.map(r => r.approx ? fmtTex(r.x) : exactTex(r.s)).join(',\\ ') + '\\right\\}', '{' + rs.map(r => r.s).join(',') + '}', { approx: '{' + rs.map(r => fmt(r.x)).join(', ') + '}' });
    };
    CMD.factor = a => { let r = N('factor(' + a[0] + ')').toString(); if (!sameValue(r, a[0])) r = N(a[0]).toString(); return exact(niceExact(r)); };
    CMD.expand = a => { let r = N('expand(' + a[0] + ')').toString(); if (!sameValue(r, a[0])) r = N(a[0]).toString(); return exact(niceExact(r)); };
    CMD.simplify = a => exact(simp(a[0], true));
    CMD.derivative = (a, cons) => {
      const v = (a[1] || 'x').trim(), n = a[2] ? Math.round(num(a[2])) : 1;
      let r = N('diff(' + a[0] + ',' + v + (n > 1 ? ',' + n : '') + ')').toString();
      r = simp(applySubs(r, cons.subs));
      return exact(r);
    };
    CMD.d = CMD.diff = CMD.derivative;
    CMD.integral = (a, cons) => {
      const f = applySubs(a[0], cons.subs), v = (a[1] || 'x').trim();
      let F = null; try { F = N('integrate(' + f + ',' + v + ')').toString(); if (/integrate\(/.test(F) || !antiderivOk(F, f, v)) F = null; } catch (e) { F = null; }
      if (a.length < 4) {
        if (!F) return out('\\text{No antiderivative found}', 'No antiderivative found', { note: 'Give limits for a numeric answer: ∫(f,x,a,b)' });
        return exact(simp(F), { note: 'Add your own + c.' });
      }
      if (!isNumeric(a[2]) || !isNumeric(a[3])) {
        if (!F) throw new Error('No antiderivative found, so symbolic limits cannot be used');
        return exact(simp(N('(' + F + ')', { [v]: a[3] }).toString() + '-(' + N('(' + F + ')', { [v]: a[2] }).toString() + ')'));
      }
      const A = num(a[2]), B = num(a[3]); const fn = compile(f, [v]);
      const nv = nIntegrate(fn, A, B);
      if (F && isFinite(A) && isFinite(B)) {
        try {
          const ex = simp(N('(' + F + ')', { [v]: a[3] }).toString() + '-(' + N('(' + F + ')', { [v]: a[2] }).toString() + ')');
          const ev = num(ex);
          if (isFinite(nv) && Math.abs(ev - nv) <= 1e-7 * Math.max(1, Math.abs(nv))) return exact(ex);
        } catch (e) { /* use numeric */ }
      }
      if (!isFinite(nv)) throw new Error('The integral does not converge');
      const rec = recognize(nv);
      return rec ? exact(rec, { note: 'Exact form recognised from the numeric value.' }) : decimal(nv);
    };
    CMD.int = CMD.integrate = CMD.integral;
    // check F' = f numerically (central differences) before trusting a symbolic antiderivative
    function antiderivOk(F, f, v) {
      const others = N(f).variables().filter(x => x !== v), vs = [v].concat(others), Fn = compile(F, vs), fn = compile(f, vs);
      let tested = 0;
      for (const x of [0.37, 1.21, 2.53, -0.83, 3.71, -1.9]) {
        const o = others.map((_, j) => 1.3 + 0.4 * j), h = 1e-5 * Math.max(1, Math.abs(x));
        const d = (Fn.apply(null, [x + h].concat(o)) - Fn.apply(null, [x - h].concat(o))) / (2 * h), y = fn.apply(null, [x].concat(o));
        if (!isFinite(d) || !isFinite(y)) continue;
        if (!(Math.abs(d - y) <= 1e-5 * Math.max(1, Math.abs(y)))) return false;
        tested++;
      }
      return tested > 0;
    }
    CMD.limit = (a, cons) => {
      const f = applySubs(a[0], cons.subs), v = (a[1] || 'x').trim(), x0s = (a[2] || '0').trim(), dir = a[3] !== undefined ? Math.sign(num(a[3])) : 0;
      const others = N(f).variables().filter(x => x !== v);
      if (others.length) {
        try { const r = N(f, { [v]: x0s }).toString(); if (!/Infinity|NaN/.test(r)) return exact(simp(r)); } catch (e) { /* not continuous there */ }
        throw new Error('This limit needs values for ' + others.join(', ') + ' (use | ' + others[0] + '=…)');
      }
      const fn = compile(f, [v]), x0 = num(x0s);
      // one-sided limit: Neville extrapolation over h = 2^-k (exact recognition when it converges), plain values otherwise
      const side = sgn => {
        const g = isFinite(x0) ? (h => fn(x0 + sgn * h * Math.max(1, Math.abs(x0)))) : (t => fn((x0 > 0 ? 1 : -1) / t));
        const tiny = [1e-4, 1e-6, 1e-8, 1e-10].map(g);
        if (tiny[3] === Infinity || tiny[3] === -Infinity) return { L: tiny[3] };
        if (tiny.slice(1).some(y => !isFinite(y))) return { L: NaN };
        const a1 = Math.abs(tiny[3]), a2 = Math.abs(tiny[1]);
        if (a1 > 1e6 && a1 > 50 * a2) return { L: tiny[3] > 0 ? Infinity : -Infinity };
        // two step ranges: small steps for most functions, larger ones where rounding (like 1-cos x) spoils small steps
        for (const [k0, k1] of [[3, 11], [1, 8]]) {
          const hs = [], ys = [];
          for (let k = k0; k <= k1; k++) { const h = Math.pow(2, -k), y = g(h); if (isFinite(y)) { hs.push(h); ys.push(y); } }
          if (ys.length < k1 - k0 + 1) continue;
          const nev = m => { const H = hs.slice(-m), P = ys.slice(-m); for (let j = 1; j < m; j++) for (let i = 0; i < m - j; i++) P[i] = (H[i] * P[i + 1] - H[i + j] * P[i]) / (H[i] - H[i + j]); return P[0]; };
          const n = ys.length, a = nev(n - 2), b = nev(n - 1), c = nev(n), sc = Math.max(1, Math.abs(c));
          if (Math.abs(b - c) <= 1e-10 * sc && Math.abs(a - c) <= 1e-8 * sc) return { L: c, good: true };
        }
        const L = tiny[3], scale = Math.max(1, Math.abs(L));
        if (Math.abs(tiny[3] - tiny[2]) > 1e-4 * scale) return { L: NaN };
        return { L: Math.abs(L) < 1e-8 ? 0 : L, good: Math.abs(L) < 1e-8 };
      };
      let L, good = false;
      if (dir) ({ L, good } = side(dir));
      else if (!isFinite(x0)) ({ L, good } = side(1));
      else {
        try { const r = N(f, { [v]: x0s }).toString(); if (!/Infinity|NaN|\bi\b/.test(r) && isNumeric(r)) { const d = num(r); if (isFinite(d) && Math.abs(fn(x0 + 1e-9) - d) < 1e-6 * Math.max(1, Math.abs(d))) return exact(niceExact(simp(r))); } } catch (e) { /* removable */ }
        const P = side(1), M = side(-1);
        if (P.L === M.L || (isFinite(P.L) && isFinite(M.L) && Math.abs(P.L - M.L) <= 1e-6 * Math.max(1, Math.abs(P.L)))) { L = P.L; good = P.good && M.good; }
        else if (!isNaN(P.L) && !isNaN(M.L)) return out('\\text{undef}', 'undef', { note: 'Left limit ≈ ' + fmt(M.L) + ', right limit ≈ ' + fmt(P.L) + '. Add 1 or -1 as a 4th argument for a one-sided limit.' });
        else L = NaN;
      }
      if (L === Infinity || L === -Infinity) return out(L > 0 ? '\\infty' : '-\\infty', L > 0 ? '∞' : '-∞');
      if (!isFinite(L)) return out('\\text{undef}', 'undef', { note: 'The limit does not exist.' });
      let rec = null;
      if (good) { REC_TOL = 1e-9; try { rec = recognize(L); } finally { REC_TOL = 1e-12; } }
      return rec ? exact(rec) : decimal(L, { note: 'Numeric limit (no exact form recognised).' });
    };
    CMD.tangentline = a => {
      const f = a[0], v = (a[1] || 'x').trim(), p = a[2];
      const m = slopeAt(f, v, p), y0 = simp(N(f, { [v]: p }).toString());
      return exact(simp('expand(' + m + '*(' + v + '-(' + p + '))+' + y0 + ')'), { prefix: 'y=' });
    };
    CMD.normalline = a => {
      const f = a[0], v = (a[1] || 'x').trim(), p = a[2];
      const m = slopeAt(f, v, p), y0 = simp(N(f, { [v]: p }).toString());
      if (Math.abs(num(m)) < 1e-14) return out(v + '=' + exactTex(p), v + '=' + p);
      return exact(simp('expand((-1/(' + m + '))*(' + v + '-(' + p + '))+' + y0 + ')'), { prefix: 'y=' });
    };
    function slopeAt(f, v, p) { const d = N('diff(' + f + ',' + v + ')').toString(); return simp(N(d, { [v]: p }).toString()); }
    CMD.fmin = (a, cons) => ext(a, cons, 'min');
    CMD.fmax = (a, cons) => ext(a, cons, 'max');
    function ext(a, cons, kind) {
      const v = (a[1] || 'x').trim(); const r = extremum(a[0], v, cons, kind);
      if (r.unbounded) return out(v + '=' + (r.dir === '∞' ? '\\infty' : '-\\infty'), v + '=' + r.dir, { note: 'No ' + (kind === 'min' ? 'minimum' : 'maximum') + ': the function is unbounded. Restrict the domain with |.' });
      return out(v + '=' + (r.approx ? fmtTex(r.x) : exactTex(r.s)), v + '=' + r.s, { approx: v + '≈' + fmt(r.x), note: (kind === 'min' ? 'Minimum' : 'Maximum') + ' value ≈ ' + fmt(r.y) + (recognize(r.y) && !r.approx ? ' (= ' + recognize(r.y) + ')' : '') });
    }
    CMD.approx = a => { const v = num(a[0]); return decimal(v); };
    CMD.exact = a => { const v = num(a[0]); const r = recognize(v); return r ? exact(r) : decimal(v); };
    // probability
    const P2 = (x, d) => x === undefined ? d : num(x);
    CMD.normcdf = a => { const lo = P2(a[0], -Infinity), hi = P2(a[1], Infinity), mu = P2(a[2], 0), sd = P2(a[3], 1); if (sd <= 0) throw new Error('σ must be positive'); return decimal(Phi((hi - mu) / sd) - Phi((lo - mu) / sd)); };
    CMD.normpdf = a => { const x = num(a[0]), mu = P2(a[1], 0), sd = P2(a[2], 1); return decimal(Math.exp(-0.5 * Math.pow((x - mu) / sd, 2)) / (sd * Math.sqrt(2 * PI))); };
    CMD.invnorm = a => { const p = num(a[0]), mu = P2(a[1], 0), sd = P2(a[2], 1); if (!(p > 0 && p < 1)) throw new Error('Area must be between 0 and 1'); return decimal(mu + sd * invPhi(p), { note: 'invNorm uses the area to the LEFT.' }); };
    CMD.binompdf = a => {
      const n = num(a[0]), p = num(a[1]);
      if (a[2] === undefined) { const arr = []; for (let k = 0; k <= n; k++) arr.push(binomPmf(n, p, k)); return out('\\{' + arr.map(fmtTex).join(',\\ ') + '\\}', '{' + arr.map(x => fmt(x)).join(',') + '}', { note: 'Probabilities for x = 0, 1, …, ' + n + '.' }); }
      if (/^\{/.test(a[2].trim())) { const ks = listVals(a[2]).map(num); const arr = ks.map(k => binomPmf(n, p, k)); return out('\\{' + arr.map(fmtTex).join(',\\ ') + '\\}', '{' + arr.map(x => fmt(x)).join(',') + '}'); }
      return decimal(binomPmf(n, p, num(a[2])));
    };
    CMD.binomcdf = a => {
      const n = num(a[0]), p = num(a[1]); let lo = 0, hi;
      if (a.length >= 4) { lo = Math.max(0, Math.ceil(num(a[2]) - 1e-9)); hi = Math.min(n, Math.floor(num(a[3]) + 1e-9)); } else hi = Math.min(n, Math.floor(num(a[2]) + 1e-9));
      let s = 0; for (let k = lo; k <= hi; k++) s += binomPmf(n, p, k);
      return decimal(Math.min(1, s), { note: 'binomCdf(n, p, lower, upper) = Pr(lower ≤ X ≤ upper).' });
    };
    CMD.invbinom = a => { const area = num(a[0]), n = num(a[1]), p = num(a[2]); let s = 0; for (let k = 0; k <= n; k++) { s += binomPmf(n, p, k); if (s >= area - 1e-12) return out(String(k), String(k), { note: 'Smallest k with Pr(X ≤ k) ≥ ' + fmt(area) + '.' }); } return out(String(n), String(n)); };
    CMD.poisspdf = a => { const l = num(a[0]), k = num(a[1]); return decimal(Math.exp(-l + k * Math.log(l) - lgamma(k + 1))); };
    CMD.poisscdf = a => {
      const l = num(a[0]), lo = a.length >= 3 ? Math.max(0, Math.ceil(num(a[1]) - 1e-9)) : 0, hi = Math.floor(num(a[a.length >= 3 ? 2 : 1]) + 1e-9);
      let s = 0; for (let k = lo; k <= Math.min(hi, 100000); k++) s += Math.exp(-l + k * Math.log(l) - lgamma(k + 1));
      return decimal(Math.min(1, s), { note: 'poissCdf(λ, lower, upper) = Pr(lower ≤ X ≤ upper).' });
    };
    CMD.ncr = a => { const n = num(a[0]), r = num(a[1]); return out(nCrBig(n, r), nCrBig(n, r), { approx: nCrBig(n, r) }); };
    CMD.npr = a => { const n = num(a[0]), r = num(a[1]); return out(nPrBig(n, r), nPrBig(n, r), { approx: nPrBig(n, r) }); };
    CMD.factorial = a => { const v = factorialBig(num(a[0])); return out(v, v, { approx: v }); };
    CMD.zinterval_1prop = a => {
      const x = num(a[0]), n = num(a[1]), cl = a[2] !== undefined ? num(a[2]) : 0.95;
      const ph = x / n, z = invPhi(1 - (1 - cl) / 2), me = z * Math.sqrt(ph * (1 - ph) / n);
      return out('\\left(' + fmtTex(ph - me) + ',\\ ' + fmtTex(ph + me) + '\\right)', '(' + fmt(ph - me) + ', ' + fmt(ph + me) + ')',
        { note: 'p̂ = ' + fmt(ph) + ', z* = ' + fmt(z, 6) + ', margin of error = ' + fmt(me) + ', n = ' + n + '. (Methods exams often use z ≈ 1.96 or 2 instead.)' });
    };
    // stats
    const listNums = a => listVals(a[0]).map(num);
    CMD.mean = a => { const xs = listVals(a[0]); return exact(simp('(' + xs.join('+') + ')/' + xs.length)); };
    CMD.sum = a => { if (a.length >= 4) return exact(simp(N('sum(' + a.join(',') + ')').toString())); const xs = listVals(a[0]); return exact(simp(xs.join('+'))); };
    CMD.median = a => { const xs = listNums(a).sort((p, q) => p - q), n = xs.length; const m = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2; const r = recognize(m); return r ? exact(r) : decimal(m); };
    const variance = (xs, samp) => { const m = xs.reduce((s, x) => s + x, 0) / xs.length; return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - (samp ? 1 : 0)); };
    CMD.varpop = a => decimal(variance(listNums(a), false));
    CMD.varsamp = CMD.variance = a => decimal(variance(listNums(a), true));
    CMD.stdevpop = a => decimal(Math.sqrt(variance(listNums(a), false)));
    CMD.stdevsamp = CMD.stdev = a => decimal(Math.sqrt(variance(listNums(a), true)));
    CMD.min = a => decimal(Math.min.apply(null, a.length === 1 && /^\{/.test(a[0]) ? listNums(a) : a.map(num)));
    CMD.max = a => decimal(Math.max.apply(null, a.length === 1 && /^\{/.test(a[0]) ? listNums(a) : a.map(num)));
    // matrices
    CMD.det = a => {
      const m = N(a[0]).toString().match(/^matrix\((.*)\)$/); if (!m) throw new Error('det needs a matrix like [1,2;3,4]');
      const rows = splitTop(m[1], ',').map(r => splitTop(r.replace(/^\[|\]$/g, ''), ','));
      if (rows.some(r => r.length !== rows.length) || rows.length > 5) throw new Error('det needs a square matrix (up to 5×5)');
      const D = M => M.length === 1 ? '(' + M[0][0] + ')' : '(' + M[0].map((c, j) => (j % 2 ? '-' : '+') + '(' + c + ')*' + D(M.slice(1).map(r => r.filter((_, k) => k !== j)))).join('') + ')';
      return exact(niceExact(N('expand(' + D(rows) + ')').toString()));
    };
    CMD.transpose = a => matOut(N('transpose(' + a[0] + ')').toString());
    function matOut(s) {
      const m = s.match(/^matrix\((.*)\)$/); if (!m) return exact(s);
      const rows = splitTop(m[1], ',').map(r => splitTop(r.replace(/^\[|\]$/g, ''), ',').map(x => niceExact(x)));
      return out('\\begin{bmatrix}' + rows.map(r => r.map(exactTex).join('&')).join('\\\\') + '\\end{bmatrix}', '[' + rows.map(r => r.join(',')).join(';') + ']');
    }

    // ------------------------------------------------------------ definitions
    function define(name, params, body) {
      if (/^(e|pi|i|x|Infinity)$/.test(name)) throw new Error('“' + name + '” is reserved');
      if (params) {
        let b = body; try { b = N(body).toString(); } catch (e) { /* keep as typed */ }   // like the Nspire: derivative(...) etc. evaluated now
        nerdamer.setFunction(name, params, b);
        ST.defs[name] = { params, body: b };
      } else {
        const val = N(body).toString();
        nerdamer.setVar(name, val);
        ST.vars[name] = val;
      }
    }
    function resetDefs() {
      try { nerdamer.clearVars(); } catch (e) { /* ignore */ }
      try { if (nerdamer.clearFunctions) nerdamer.clearFunctions(); } catch (e) { /* ignore */ }
      ST.defs = {}; ST.vars = {};
    }
    function restore(defs, vars) {
      Object.keys(defs || {}).forEach(k => { try { nerdamer.setFunction(k, defs[k].params, defs[k].body); ST.defs[k] = defs[k]; } catch (e) { /* skip */ } });
      Object.keys(vars || {}).forEach(k => { try { nerdamer.setVar(k, vars[k]); ST.vars[k] = vars[k]; } catch (e) { /* skip */ } });
    }

    // ------------------------------------------------------------ main entry
    const ALIAS = { nsolve: 'nsolve', solve: 'solve', zeros: 'zeros', factor: 'factor', expand: 'expand', simplify: 'simplify', derivative: 'derivative', d: 'derivative', diff: 'derivative',
      integral: 'integral', int: 'integral', integrate: 'integral', '∫': 'integral', limit: 'limit', lim: 'limit', tangentline: 'tangentline', normalline: 'normalline', fmin: 'fmin', fmax: 'fmax',
      approx: 'approx', exact: 'exact', normcdf: 'normcdf', normpdf: 'normpdf', invnorm: 'invnorm', binompdf: 'binompdf', binomcdf: 'binomcdf', invbinom: 'invbinom', poisspdf: 'poisspdf', poisscdf: 'poisscdf',
      ncr: 'ncr', npr: 'npr', factorial: 'factorial', zinterval_1prop: 'zinterval_1prop', mean: 'mean', sum: 'sum', median: 'median', varpop: 'varpop', varsamp: 'varsamp', variance: 'varsamp',
      stdevpop: 'stdevpop', stdevsamp: 'stdevsamp', stdev: 'stdevsamp', min: 'min', max: 'max', det: 'det', transpose: 'transpose' };

    const CMDNAMES = new Set(Object.keys(ALIAS).concat(['zinterval_1prop']));
    function run(input, opts) {
      opts = opts || {};
      const raw = String(input || '').trim();
      if (!raw) return null;
      try {
        let s = raw.replace(/^∫\s*\(/, 'integral(').replace(/d\/d([a-z])\s*\(/g, (m, v) => 'DDX__' + v + '(');
        // clear / delvar
        if (/^(clear\s*all|clearall|delvar\s+all)$/i.test(s)) { resetDefs(); return { tex: '\\text{Done}', text: 'Done', note: 'Cleared every definition.' }; }
        let m = s.match(/^delvar\s+([A-Za-z]\w*)$/i);
        if (m) { delete ST.defs[m[1]]; delete ST.vars[m[1]]; const d = ST.defs, v = ST.vars; resetDefs(); restore(d, v); return { tex: '\\text{Done}', text: 'Done' }; }
        if (/^define\b/i.test(s) && !/^define\s+[A-Za-z]\w*\s*(\([^)]*\))?\s*=\s*\S/i.test(s)) throw new Error('Write it like define f(x)=x^2-3x');
        // definitions
        m = s.match(/^define\s+([A-Za-z]\w*)\s*\(([^)]*)\)\s*=\s*([\s\S]+)$/i) || s.match(/^([A-Za-z]\w*)\s*\(([^)]*)\)\s*:=\s*([\s\S]+)$/);
        if (m) { const params = m[2].split(',').map(x => x.trim()).filter(Boolean); const body = prep(convertMatrices(m[3])); N(body); define(m[1], params, body); return { tex: '\\text{Done}', text: 'Done', note: m[1] + '(' + params.join(',') + ') = ' + tidySafe(ST.defs[m[1]].body) }; }
        m = s.match(/^define\s+([A-Za-z]\w*)\s*=\s*([\s\S]+)$/i) || s.match(/^([A-Za-z]\w*)\s*:=\s*([\s\S]+)$/);
        if (m) { const body = prep(convertMatrices(m[2])); define(m[1], null, body); const val = ST.vars[m[1]]; const o = exact(niceExact(val)); o.note = 'Stored in ' + m[1] + '.'; return o; }
        m = s.match(/^([\s\S]+)->\s*([A-Za-z]\w*)$/) || s.match(/^([\s\S]+)→\s*([A-Za-z]\w*)$/);
        if (m) { const body = prep(convertMatrices(m[1])); define(m[2], null, body); const o = exact(niceExact(ST.vars[m[2]])); o.note = 'Stored in ' + m[2] + '.'; return o; }

        // split off "| constraint"
        const [bar] = topIndex(s, ['|']);
        let main = bar >= 0 ? s.slice(0, bar) : s, cstr = bar >= 0 ? s.slice(bar + 1) : '';
        main = fixInverse(prep(convertMatrices(main))); cstr = cstr ? prep(cstr) : '';
        const autoApprox = /(^|[^\w.])\d*\.\d/.test(main);
        main = main.replace(/DDX__([a-z])\(/g, (mm, v) => 'derivative__' + v + '(');
        let res;
        // d/dx(expr) template
        const dm = main.match(/^derivative__([a-z])\(([\s\S]*)\)$/);
        const cm = main.match(/^([A-Za-z_][\w]*)\(([\s\S]*)\)$/);
        const cons = parseConstraints(cstr);
        if (dm && matchClose(main, main.indexOf('(')) === main.length - 1) res = CMD.derivative([dm[2], dm[1]], cons);
        else if (cm && matchClose(main, cm[1].length) === main.length - 1 && ALIAS[cm[1].toLowerCase()]) {
          const args = splitTop(cm[2], ',');
          res = CMD[ALIAS[cm[1].toLowerCase()]](args, cons);
        } else {
          // generic expression / equation (with optional substitutions)
          let e = applySubs(main.replace(/derivative__([a-z])\(/g, 'diff__$1('), cons.subs);
          e = e.replace(/diff__([a-z])\(/g, 'diff(');
          if (topIndex(e, ['<=', '>=', '<', '>', '!='])[0] >= 0) throw new Error('Use solve( … , x) for inequalities');
          const [eqI] = topIndex(e, ['=']);
          if (eqI >= 0) {
            const l = simp(e.slice(0, eqI)), r = simp(e.slice(eqI + 1));
            if (isNumeric(l) && isNumeric(r)) { const t = Math.abs(num(l) - num(r)) < 1e-12; res = out(t ? '\\text{true}' : '\\text{false}', t ? 'true' : 'false'); }
            else res = out(exactTex(l) + '=' + exactTex(r), l + '=' + r);
          } else {
            let r = N(e).toString();
            if (/^matrix\(/.test(r)) res = matOut(r);
            else {
              if (/factorial\(/.test(r) && isNumeric(r)) r = N(r).evaluate().toString();
              r = isNumeric(r) ? niceExact(r) : simp(r);
              res = exact(r);
            }
          }
        }
        if (res.prefix) { res.tex = res.prefix.replace('=', '=') + res.tex; res.text = res.prefix + res.text; }
        if (!res.error && /\bi\b/.test(res.text || '') && !/\bi\b/.test(main)) return { error: true, tex: '\\text{Error: Non-real result}', text: 'Error', note: 'Non-real result. Like an Nspire in Real mode, complex answers are not shown.' };
        if (opts.approx || ST.mode === 'approx' || autoApprox) {
          if (res.approx) res = Object.assign({}, res, { tex: approxTex(res).replace(/\\approx /g, '='), text: String(res.approx).replace(/≈/g, '='), wasExact: res.text, approx: null });
        }
        if (res.text && !/^(true|false|Done)$/.test(res.text) && !/[=<>≤≥]/.test(res.text) && !/^\{/.test(res.text)) ST.ans = res.wasExact || res.text;
        return res;
      } catch (err) {
        return { error: true, tex: '\\text{Error}', text: 'Error', note: friendly(err) };
      } finally { healthCheck(); }
    }
    // some nerdamer routines mutate its global constants on failure; detect that and start from a fresh copy
    function healthCheck() {
      let ok = false; try { ok = nerdamer('e').toString() === 'e' && nerdamer('pi').toString() === 'pi'; } catch (e) { ok = false; }
      if (ok || typeof reloader !== 'function') return;
      try { const fresh = reloader(); if (fresh) { nerdamer = fresh; const d = ST.defs, v = ST.vars; ST.defs = {}; ST.vars = {}; restore(d, v); } } catch (e) { /* keep going */ }
    }
    function valTex(a) {
      a = String(a).trim();
      if (/^-?[\d.]+(E-?\d+)?$/.test(a)) return fmtTex(Number(a.replace('E', 'e')));
      try { return cleanTex(nerdamer.convertToLaTeX(a)); } catch (e) { return '\\text{' + a + '}'; }
    }
    function approxTex(res) {
      const a = String(res.approx);
      if (/^\{.*\}$/.test(a)) return '\\left\\{' + splitTop(a.slice(1, -1), ',').map(valTex).join(',\\ ') + '\\right\\}';
      if (/^\(.*\)$/.test(a) && splitTop(a.slice(1, -1), ',').length === 2) return '\\left(' + splitTop(a.slice(1, -1), ',').map(valTex).join(',\\ ') + '\\right)';
      const tail = a.match(/\s\(n = 0\)$/); const body = tail ? a.slice(0, -tail[0].length) : a;
      return body.split(/ (or|and) /).map((part, i) => i % 2 ? '\\ \\text{' + part + '}\\ ' : part.includes('≈') ? part.split('≈').map((x, j) => j ? valTex(x) : x.trim()).join('\\approx ') : (res.prefix || '') + valTex(part)).join('') + (tail ? '\\quad(n=0)' : '');
    }
    function friendly(err) {
      const m = String(err && err.message || err);
      if (/Division by zero/i.test(m)) return 'Undefined: division by zero.';
      if (/undefined/i.test(m)) return 'Undefined: ' + m.replace(/^Error:\s*/, '').replace(/!?:\s*\d+$/, '').replace(/\(1\/2\)\*pi/g, 'π/2') + '.';
      if (/Unexpected|parse|unrecognized|not defined|Expected/i.test(m)) return 'Syntax: ' + m.replace(/^Error:\s*/, '');
      return m;
    }

    return {
      run, state: ST, prep, recognize, fmt, reset: resetDefs, restore,
      setAngle: a => { ST.angle = a === 'deg' ? 'deg' : 'rad'; }, setMode: m => { ST.mode = m; },
      // numeric helpers reused by the graph view
      compile: (expr, vars) => compile(prep(expr), vars || ['x']), findRoots, brent, goldenMin, nIntegrate, num: s => num(prep(s)),
      deriv: (expr, v) => N('diff(' + prep(expr) + ',' + (v || 'x') + ')').toString(),
    };
  }

  if (typeof module === 'object' && module.exports) module.exports = make;
  else root.CASEngine = make;
})(typeof window !== 'undefined' ? window : this);
