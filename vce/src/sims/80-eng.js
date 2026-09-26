/* English Language interactives: feature-flash hero, Australian English (HCE) vowel chart with quiz,
   and a metalanguage feature-spotting drill. */
(function () {
  'use strict';
  const K = window.SIMKIT, S = window.SIMS;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ------------------------------------------------------------------ hero: feature flash */
  const FLASH = [
    ['arvo', 'hypocorism', 'Morphology'],
    ['Mistakes were made.', 'agentless passive', 'Syntax'],
    ['yeah nah', 'discourse marker', 'Discourse'],
    ['/kɐː/', 'non-rhotic “car”', 'Phonology'],
    ['passed away', 'euphemism', 'Semantics'],
    ['strollout', 'blend (stroll + rollout)', 'Morphology'],
    ['So I went to the shops↑', 'high rising terminal', 'Phonology'],
    ['the implementation of', 'nominalisation', 'Syntax'],
    ['Could you pass the salt?', 'indirect speech act', 'Discourse'],
    ['cozzie livs', 'hypocorism · Macquarie 2023', 'Morphology'],
    ['rizz', 'clipping · Oxford 2023', 'Morphology'],
    ['carked it', 'dysphemism', 'Semantics'],
    ['gimme', 'assimilation', 'Phonology'],
    ['I now declare this library open', 'performative speech act', 'Discourse'],
    ['Pass me that.', 'exophoric reference', 'Discourse'],
    ['to google', 'conversion', 'Morphology']
  ];
  const GLYPHS = ['iː', 'ɪ', 'e', 'eː', 'æ', 'ɐː', 'ɐ', 'ɔ', 'oː', 'ʊ', 'ʉː', 'ɜː', 'ə', 'æɪ', 'ɑe', 'oɪ', 'æɔ', 'əʉ', 'ɪə', 'θ', 'ð', 'ʃ', 'ʒ', 'ŋ', 'tʃ', 'dʒ'];

  S.heroEng = function (el) {
    el.innerHTML = '';
    const cvs = K.canvas(el, 0.8, { maxH: 440, minH: 260, label: 'Examples of language features with their metalanguage labels. Tap for the next example.' });
    cvs.wrap.style.border = '0'; cvs.wrap.style.borderRadius = '0';
    const cap = document.createElement('div'); cap.className = 'cap'; el.appendChild(cap);
    const { ctx } = cvs;
    let idx = Math.floor(Math.random() * FLASH.length), t = 0;
    const HOLD = 3.4, FADE = 0.45;
    const floats = GLYPHS.map((g, i) => ({ g, x: Math.random(), y: Math.random(), s: 13 + Math.random() * 14, v: 0.012 + Math.random() * 0.02, p: i }));
    function fit(str, maxW, size, font) {
      ctx.font = size + 'px ' + font;
      const w = ctx.measureText(str).width;
      return w > maxW ? Math.max(14, size * maxW / w) : size;
    }
    function draw() {
      const W = cvs.W, H = cvs.H, c = K.col();
      ctx.fillStyle = c.surface; ctx.fillRect(0, 0, W, H);
      K.grid(ctx, W, H, 28, c);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      floats.forEach(f => {
        ctx.globalAlpha = 0.16; ctx.fillStyle = f.p % 3 ? c.muted : c.acc;
        ctx.font = f.s + 'px "Charis SIL","Doulos SIL","Noto Serif","Times New Roman",serif';
        ctx.fillText(f.g, f.x * W, f.y * H);
      });
      ctx.restore();
      const it = FLASH[idx];
      const a = t < FADE ? t / FADE : t > HOLD - FADE ? Math.max(0, (HOLD - t) / FADE) : 1;
      const serif = 'Georgia,"Noto Serif","Times New Roman",serif';
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // subsystem tag
      const tag = it[2].toUpperCase();
      ctx.font = '600 11.5px ' + c.mono;
      const tw = ctx.measureText(tag).width + 18;
      ctx.fillStyle = c.accSoft; ctx.strokeStyle = c.acc; ctx.lineWidth = 1;
      const ty = H * 0.3;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - tw / 2, ty - 11, tw, 22, 11); else ctx.rect(W / 2 - tw / 2, ty - 11, tw, 22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c.acc; ctx.fillText(tag, W / 2, ty + 1);
      // example
      const size = fit(it[0], W * 0.86, Math.min(54, W * 0.1), serif);
      ctx.font = 'italic ' + size + 'px ' + serif; ctx.fillStyle = c.ink;
      ctx.fillText(it[0], W / 2, H * 0.48);
      // underline
      const ew = ctx.measureText(it[0]).width;
      ctx.strokeStyle = c.acc; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(W / 2 - ew / 2, H * 0.48 + size * 0.55); ctx.lineTo(W / 2 + ew / 2, H * 0.48 + size * 0.55); ctx.stroke();
      // label
      const ls = fit(it[1], W * 0.86, Math.min(22, W * 0.05), c.mono);
      ctx.font = '600 ' + ls + 'px ' + c.mono; ctx.fillStyle = c.ink2;
      ctx.fillText(it[1], W / 2, H * 0.48 + size * 0.55 + ls + 18);
      ctx.restore();
      cap.textContent = (idx + 1) + ' / ' + FLASH.length + ' · tap for next';
    }
    const next = () => { idx = (idx + 1) % FLASH.length; t = 0; draw(); };
    cvs.draw = draw;
    cvs.cv.addEventListener('pointerdown', () => { next(); if (K.reduced()) { t = FADE; draw(); } });
    let stop = null;
    if (K.reduced()) { t = FADE; draw(); }
    else stop = K.loop(dt => {
      t += dt; if (t > HOLD) { idx = (idx + 1) % FLASH.length; t = 0; }
      floats.forEach(f => { f.y -= f.v * dt; if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); } });
      draw();
    }, cvs.cv);
    const off = K.onTheme(draw);
    return () => { if (stop) stop(); off(); cvs.destroy(); };
  };

  /* ------------------------------------------------------------------ HCE vowel chart */
  // f: frontness (0 front, 1 back), h: height (0 close, 1 open). Positions are approximate, after Cox & Palethorpe.
  const MONO = [
    { s: 'iː', f: 0.04, h: 0.03, kw: 'heed', ex: ['see', 'beat', 'key'], d: 'close front unrounded, long' },
    { s: 'ɪ', f: 0.16, h: 0.14, kw: 'hid', ex: ['bit', 'fish', 'sit'], d: 'near-close front unrounded, short' },
    { s: 'e', f: 0.07, h: 0.31, kw: 'head', ex: ['bed', 'said', 'step'], d: 'close-mid front unrounded, short (raised in Australian English)' },
    { s: 'eː', f: 0.22, h: 0.43, kw: 'haired', ex: ['air', 'there', 'bear'], d: 'mid front unrounded, long; where rhotic accents have a vowel + /r/, non-rhotic AusE has a long vowel' },
    { s: 'æ', f: 0.08, h: 0.64, kw: 'had', ex: ['cat', 'man', 'trap'], d: 'near-open front unrounded' },
    { s: 'ɐː', f: 0.52, h: 0.97, kw: 'hard', ex: ['car', 'start', 'calm'], d: 'open central unrounded, long; contrasts with ɐ mainly in length' },
    { s: 'ɐ', f: 0.36, h: 0.84, kw: 'hud', ex: ['cup', 'but', 'love'], d: 'near-open central unrounded, short' },
    { s: 'ɔ', f: 0.93, h: 0.70, kw: 'hod', ex: ['hot', 'lot', 'wash'], d: 'open-mid back rounded, short' },
    { s: 'oː', f: 0.95, h: 0.36, kw: 'hoard', ex: ['saw', 'law', 'thought'], d: 'close-mid back rounded, long' },
    { s: 'ʊ', f: 0.74, h: 0.17, kw: 'hood', ex: ['put', 'book', 'good'], d: 'near-close back rounded, short' },
    { s: 'ʉː', f: 0.5, h: 0.03, kw: 'who’d', ex: ['food', 'goose', 'true'], d: 'close central rounded, long (strongly fronted in Australian English)' },
    { s: 'ɜː', f: 0.47, h: 0.36, kw: 'heard', ex: ['bird', 'nurse', 'word'], d: 'mid central, long' },
    { s: 'ə', f: 0.55, h: 0.57, kw: 'about (unstressed a)', ex: ['about', 'sofa', 'banana (1st and 3rd a)'], d: 'mid central; schwa occurs only in unstressed syllables, the most common vowel in connected speech' }
  ];
  const DIPH = [
    { s: 'æɪ', a: [0.26, 0.74], b: [0.13, 0.17], kw: 'hay', ex: ['day', 'face', 'rain'], d: 'glides from a near-open central start towards near-close front' },
    { s: 'ɑe', a: [0.80, 0.95], b: [0.12, 0.38], kw: 'high', ex: ['my', 'price', 'time'], d: 'glides from open back towards front; a backer start sounds broader' },
    { s: 'oɪ', a: [0.86, 0.42], b: [0.2, 0.12], kw: 'hoy', ex: ['boy', 'choice', 'noise'], d: 'glides from back rounded towards near-close front' },
    { s: 'æɔ', a: [0.05, 0.74], b: [0.83, 0.62], kw: 'how', ex: ['now', 'mouth', 'loud'], d: 'glides from front towards back rounded' },
    { s: 'əʉ', a: [0.62, 0.64], b: [0.58, 0.12], kw: 'hoe', ex: ['go', 'goat', 'show'], d: 'glides from mid central towards close central rounded' },
    { s: 'ɪə', a: [0.24, 0.25], b: [0.46, 0.55], kw: 'here', ex: ['near', 'beer', 'ear'], d: 'centring diphthong; often realised as a long monophthong [ɪː] in AusE' }
  ];

  S.ipa = function (el) {
    return K.mount(el, 'Australian English vowel chart (HCE)', 'Tap a vowel to hear where it sits and see example words. Front–back runs left to right; close–open runs top to bottom. Use Quiz to test yourself: find the vowel in the word shown.', ({ body, add }) => {
      const cv = K.canvas(body, 0.66, { maxH: 430, minH: 260, label: 'Vowel quadrilateral showing Australian English vowels in the HCE system' });
      const ctl = K.controls(body);
      let mode = 'mono', sel = null, quiz = null, score = 0, tries = 0;
      K.select(ctl, { label: 'Show', value: mode, options: [['mono', 'Monophthongs'], ['diph', 'Diphthongs'], ['both', 'Both']], onChange: v => { mode = v; sel = null; quiz = null; hits = []; upd(); } });
      K.buttons(ctl, [
        { label: 'Quiz me', primary: true, onClick: newQuiz },
        { label: 'Clear', onClick: () => { sel = null; quiz = null; upd(); } }
      ]);
      const ro = K.readout(body, [['sym', 'Vowel'], ['kw', 'HCE keyword'], ['ex', 'Examples'], ['score', 'Quiz score']]);
      const note = K.note(body);
      let hits = [];
      const pool = () => mode === 'mono' ? MONO : mode === 'diph' ? DIPH : MONO.concat(DIPH);
      function newQuiz() {
        const p = pool(), v = p[Math.floor(Math.random() * p.length)];
        const w = v.ex[Math.floor(Math.random() * v.ex.length)].replace(/ \(.*\)$/, '');
        quiz = { v, w, done: false }; sel = null; upd();
      }
      function geom(W, H) {
        const pad = { l: Math.max(58, W * 0.12), r: 26, t: 34, b: 22 };
        const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
        const P = (f, ht) => { const xl = 0.5 * ht; return [pad.l + (xl + f * (1 - xl)) * w, pad.t + ht * h]; };
        return { P, pad, w, h };
      }
      function draw() {
        const { ctx, W, H } = cv, c = K.col(); K._c = c;
        K.clear(ctx, W, H, c);
        const { P, pad } = geom(W, H);
        // quadrilateral
        ctx.save(); ctx.strokeStyle = c.line2; ctx.lineWidth = 1.6;
        const q = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)];
        ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
        [1 / 3, 2 / 3].forEach(ht => { const a = P(0, ht), b = P(1, ht); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); });
        { const a = P(0.5, 0), b = P(0.5, 1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        ctx.restore();
        const small = W < 460;
        K.text(ctx, 'front', P(0, 0)[0], pad.t - 12, { size: 11.5, color: c.muted, align: 'center', mono: true });
        K.text(ctx, 'central', P(0.5, 0)[0], pad.t - 12, { size: 11.5, color: c.muted, align: 'center', mono: true });
        K.text(ctx, 'back', P(1, 0)[0], pad.t - 12, { size: 11.5, color: c.muted, align: 'center', mono: true });
        [['close', 0], [small ? 'c-mid' : 'close-mid', 1 / 3], [small ? 'o-mid' : 'open-mid', 2 / 3], ['open', 1]].forEach(([s, ht]) => {
          const p = P(0, ht); K.text(ctx, s, p[0] - 10, p[1] + 4, { size: 11.5, color: c.muted, align: 'right', mono: true });
        });
        hits = [];
        const ipaFont = s => s + 'px "Charis SIL","Doulos SIL","Gentium Plus","Noto Serif","Times New Roman",serif';
        const fs = small ? 17 : 21;
        const label = (v, x, y, col, isSel) => {
          ctx.save(); ctx.font = ipaFont(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const tw = ctx.measureText(v.s).width + 12;
          if (isSel) { ctx.fillStyle = c.accSoft; ctx.strokeStyle = c.acc; ctx.lineWidth = 1.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - tw / 2, y - fs * 0.72, tw, fs * 1.44, 6); else ctx.rect(x - tw / 2, y - fs * 0.72, tw, fs * 1.44); ctx.fill(); ctx.stroke(); }
          else { ctx.fillStyle = c.bg; ctx.globalAlpha = 0.85; ctx.fillRect(x - tw / 2 + 3, y - fs * 0.55, tw - 6, fs * 1.1); ctx.globalAlpha = 1; }
          ctx.fillStyle = col; ctx.fillText(v.s, x, y + 1);
          ctx.restore();
          hits.push({ v, x, y, r: Math.max(18, tw / 2 + 4) });
        };
        if (mode !== 'mono') {
          DIPH.forEach(v => {
            const a = P(v.a[0], v.a[1]), b = P(v.b[0], v.b[1]);
            const isSel = sel === v;
            ctx.save(); ctx.globalAlpha = sel && !isSel ? 0.35 : 1;
            K.arrow(ctx, a[0], a[1], b[0], b[1], isSel ? c.acc : c.v, isSel ? 2.6 : 1.8, 9);
            ctx.restore();
          });
        }
        if (mode !== 'diph') MONO.forEach(v => { const p = P(v.f, v.h); label(v, p[0], p[1], sel === v ? c.acc : c.ink, sel === v); });
        if (mode !== 'mono') DIPH.forEach(v => { const p = P(v.a[0], v.a[1]); label(v, p[0], p[1], sel === v ? c.acc : c.v, sel === v); });
      }
      function upd() {
        if (sel) {
          ro.set('sym', '/' + sel.s + '/'); ro.set('kw', sel.kw); ro.set('ex', sel.ex.join(', '));
        } else { ro.set('sym', '–'); ro.set('kw', '–'); ro.set('ex', '–'); }
        ro.set('score', tries ? score + ' / ' + tries : '–');
        if (quiz && !quiz.done) { note.className = 'sim-note'; note.innerHTML = 'Quiz: which vowel is in <strong>' + K.esc(quiz.w) + '</strong>? Tap it on the chart.'; }
        else if (quiz && quiz.done) {
          note.className = 'sim-note' + (quiz.ok ? '' : ' bad');
          note.innerHTML = (quiz.ok ? 'Correct: ' : 'Not quite. ') + '<strong>' + K.esc(quiz.w) + '</strong> has /' + quiz.v.s + '/ (' + K.esc(quiz.v.d) + '). Tap Quiz me for another.';
        } else if (sel) { note.className = 'sim-note'; note.textContent = '/' + sel.s + '/: ' + sel.d + '.'; }
        else { note.className = 'sim-note'; note.textContent = 'Tap any vowel symbol. Diphthongs are shown as arrows from their starting point to where they glide.'; }
        draw();
      }
      cv.cv.addEventListener('pointerdown', e => {
        const r = cv.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = null, bd = 1e9;
        hits.forEach(hh => { const d = Math.hypot(hh.x - x, hh.y - y); if (d < hh.r && d < bd) { bd = d; best = hh; } });
        if (!best) return;
        sel = best.v;
        if (quiz && !quiz.done) { quiz.done = true; quiz.ok = best.v === quiz.v; tries++; if (quiz.ok) score++; else sel = quiz.v; }
        upd();
      });
      cv.cv.style.cursor = 'pointer';
      cv.draw = draw; add(K.onTheme(draw)); add(cv.destroy);
      upd();
    });
  };

  /* ------------------------------------------------------------------ feature spotter */
  // [subsystem, utterance with [[highlight]], answer, [3 distractors], explanation]
  const SPOT = [
    ['Phonology', 'We had [[fish ’n’ chips]] at the beach.', 'elision', ['assimilation', 'insertion', 'high rising terminal'], 'Sounds in “and” are omitted: elision, typical of fast casual speech.'],
    ['Phonology', '[[Gimme]] a sec.', 'assimilation', ['elision only', 'vowel lengthening', 'non-rhoticity'], '/v/ in “give” becomes /m/ to match the following /m/ of “me”.'],
    ['Phonology', 'It was [[so::]] good.', 'vowel lengthening for emphasis', ['elision', 'schwa', 'assimilation'], 'The :: in the transcript marks a lengthened sound, adding emotional emphasis.'],
    ['Phonology', 'I [[SAID]] no.', 'emphatic stress', ['high rising terminal', 'elision', 'insertion'], 'CAPS mark extra loudness or stress, showing frustration.'],
    ['Phonology', 'So I went to the shops[[↑]]', 'high rising terminal', ['falling intonation', 'emphatic stress', 'latching'], 'Rising intonation on a statement, often to check the listener is following.'],
    ['Phonology', 'Meet you at the [[car]] park /kɐː/.', 'non-rhoticity', ['assimilation', 'elision', 'insertion'], 'No /r/ after the vowel: Australian English is non-rhotic.'],
    ['Phonology', 'See you [[Sat’dy]].', 'elision', ['assimilation', 'vowel lengthening', 'insertion'], 'A syllable of “Saturday” is dropped in fast speech.'],
    ['Morphology & lexicology', 'Meet you at the [[servo]].', 'hypocorism', ['blend', 'acronym', 'conversion'], 'A clipped form with the -o suffix (service station), typical of Australian English.'],
    ['Morphology & lexicology', 'Let’s grab [[brunch]].', 'blend', ['compound', 'clipping', 'hypocorism'], 'Parts of “breakfast” and “lunch” are fused.'],
    ['Morphology & lexicology', 'Just [[google]] it.', 'conversion', ['blend', 'borrowing', 'back-formation'], 'A proper noun used as a verb with no change in form.'],
    ['Morphology & lexicology', 'The [[ABC]] reported it first.', 'initialism', ['acronym', 'clipping', 'blend'], 'Said letter by letter, so it is an initialism, not an acronym.'],
    ['Morphology & lexicology', 'Lest we forget, [[ANZAC]] Day.', 'acronym', ['initialism', 'hypocorism', 'compound'], 'Initial letters pronounced as a word.'],
    ['Morphology & lexicology', 'That’s so [[sus]].', 'clipping', ['blend', 'initialism', 'affixation'], 'Shortened from “suspicious”.'],
    ['Morphology & lexicology', 'Can you [[babysit]] Friday?', 'back-formation', ['compound', 'conversion', 'blend'], 'Formed by removing -er from the older noun “babysitter”.'],
    ['Morphology & lexicology', 'Her [[unhappiness]] was obvious.', 'derivational affixation', ['inflection', 'compounding', 'clipping'], 'Prefix un- and suffix -ness create new words and change word class.'],
    ['Morphology & lexicology', 'The vaccine [[strollout]] frustrated everyone.', 'blend', ['compound', 'hypocorism', 'acronym'], '“Stroll” + “rollout”: Macquarie and ANDC word of the year 2021.'],
    ['Syntax', '[[Mistakes were made.]]', 'agentless passive', ['active voice', 'imperative', 'nominalisation'], 'The doer is omitted, backgrounding responsibility.'],
    ['Syntax', '[[The implementation]] of the policy begins today.', 'nominalisation', ['passive voice', 'ellipsis', 'conversion'], 'The verb “implement” becomes a noun, creating an abstract, formal style.'],
    ['Syntax', 'A: Tea? B: [[Love one.]]', 'ellipsis', ['imperative', 'passive voice', 'cleft sentence'], '“I would love one” with recoverable words omitted.'],
    ['Syntax', '[[Close the door]], please.', 'imperative', ['declarative', 'interrogative', 'exclamative'], 'A command, softened by “please”.'],
    ['Syntax', '[[What a game!]]', 'exclamative', ['imperative', 'interrogative', 'minor sentence with ellipsis'], 'The “What a…!” structure expresses strong feeling.'],
    ['Syntax', '[[It was Sam who]] broke it.', 'cleft sentence', ['passive voice', 'tag question', 'nominalisation'], 'An it-cleft moves “Sam” into focus.'],
    ['Syntax', '[[Although it rained,]] we played on.', 'subordinate clause', ['independent clause', 'noun phrase', 'coordinating conjunction'], 'It cannot stand alone; the sentence is complex.'],
    ['Syntax', 'You’re coming, [[aren’t you]]?', 'tag question', ['ellipsis', 'imperative', 'cleft'], 'A short question added to a statement, seeking agreement.'],
    ['Syntax', '[[Me and Jas]] went to the footy.', 'non-standard pronoun in a coordinated subject', ['passive voice', 'ellipsis', 'nominalisation'], 'Standard written form would be “Jas and I”; very common in speech.'],
    ['Semantics', 'Grandpa [[passed away]] last year.', 'euphemism', ['dysphemism', 'orthophemism', 'hyperbole'], 'A softer way of saying “died”.'],
    ['Semantics', 'The old fridge finally [[carked it]].', 'dysphemism', ['euphemism', 'orthophemism', 'metaphor only'], 'A blunt, flippant Australian term for dying or breaking down.'],
    ['Semantics', 'I’ve told you [[a million times]].', 'hyperbole', ['litotes', 'euphemism', 'irony'], 'Deliberate exaggeration for emphasis.'],
    ['Semantics', '[[Great]], another flat tyre.', 'irony (sarcasm)', ['amelioration', 'euphemism', 'hyponymy'], 'The literal meaning is the opposite of what is meant.'],
    ['Semantics', 'She’s [[not bad]] at chess (she’s the state champion).', 'litotes (understatement)', ['hyperbole', 'dysphemism', 'euphemism'], 'Understatement by negating the opposite; very Australian.'],
    ['Semantics', '[[Car, bus and tram]] are all kinds of vehicle.', 'hyponyms', ['hypernyms', 'antonyms', 'synonyms'], '“Vehicle” is the hypernym; the specific kinds are hyponyms.'],
    ['Semantics', '[[Nice]] once meant “foolish”.', 'amelioration', ['pejoration', 'broadening', 'narrowing'], 'The meaning became more positive over time.'],
    ['Discourse', '[[Yeah nah]], that’s fine.', 'discourse marker', ['adjacency pair', 'minimal response', 'hedge'], 'An Australian discourse marker: acknowledges, then signals “no problem”.'],
    ['Discourse', 'It’s [[like]] really far.', 'discourse particle', ['simile', 'conjunction', 'preposition'], '“Like” here doesn’t compare; it hedges and holds the floor.'],
    ['Discourse', 'The report was released. [[It]] criticised the council.', 'anaphoric reference', ['cataphoric reference', 'exophoric reference', 'substitution'], '“It” refers back to “the report”.'],
    ['Discourse', 'Pass me [[that]].', 'exophoric reference', ['anaphoric reference', 'cataphoric reference', 'ellipsis'], 'Refers to something in the physical context, outside the text.'],
    ['Discourse', 'Here’s [[the thing]]: we’re out of time.', 'cataphoric reference', ['anaphoric reference', 'exophoric reference', 'substitution'], 'Points forward to what follows the colon.'],
    ['Discourse', 'We went Tues– [[Wednesday]].', 'self-repair', ['overlap', 'latching', 'topic shift'], 'The speaker corrects their own error mid-utterance.'],
    ['Discourse', '[[Anyway]], how was the footy?', 'topic shift marker', ['backchannel', 'repair', 'hedge'], 'Signals a change of topic.'],
    ['Discourse', 'A: …and then she left. B: [[mm]]', 'minimal response (backchannel)', ['interruption', 'repair', 'filler'], 'Shows attention and encourages the speaker to continue.'],
    ['Discourse', '[[Could you pass the salt?]]', 'indirect speech act', ['direct speech act', 'performative speech act', 'exclamative'], 'Interrogative form, request function: softens the imposition.'],
    ['Discourse', '[[um]] (.) I think so.', 'filler (voiced pause)', ['minimal response', 'latching', 'repair'], 'Holds the floor while the speaker plans.'],
    ['Discourse', 'The trial worked. [[However]], costs rose.', 'connective (contrast)', ['anaphoric reference', 'ellipsis', 'discourse particle'], 'A cohesive conjunction signalling contrast.']
  ];

  S.spotter = function (el) {
    return K.mount(el, 'Feature spotter', 'Name the highlighted feature. Filter by subsystem, build a streak, and read the explanation after each answer.', ({ body }) => {
      const ctl = K.controls(body);
      let sub = 'all', deck = [], cur = null, score = 0, tries = 0, streak = 0, best = 0;
      const subs = [['all', 'All subsystems']].concat(['Phonology', 'Morphology & lexicology', 'Syntax', 'Semantics', 'Discourse'].map(s => [s, s]));
      K.select(ctl, { label: 'Subsystem', value: sub, options: subs, onChange: v => { sub = v; deck = []; next(); } });
      K.buttons(ctl, [{ label: 'Next', primary: true, onClick: () => next() }, { label: 'Reset score', onClick: () => { score = tries = streak = best = 0; stats(); } }]);
      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:16px 16px 12px;';
      body.appendChild(card);
      const opts = document.createElement('div'); opts.className = 'mcq-opts'; opts.style.padding = '0';
      body.appendChild(opts);
      const note = K.note(body);
      const ro = K.readout(body, [['score', 'Score'], ['streak', 'Streak'], ['best', 'Best streak'], ['left', 'Left in deck']]);
      function stats() {
        ro.set('score', tries ? score + ' / ' + tries : '–');
        ro.set('streak', String(streak), streak >= 5 ? 'good' : '');
        ro.set('best', String(best));
        ro.set('left', String(deck.length));
      }
      function render(item) {
        const html = K.esc(item[1]).replace(/\[\[(.+?)\]\]/g, '<mark style="background:var(--accent-soft);color:var(--ink);border-bottom:2px solid var(--accent);padding:0 2px;border-radius:3px">$1</mark>');
        card.innerHTML = '<div style="font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px">' + K.esc(item[0]) + '</div>' +
          '<div style="font-size:clamp(18px,4.2vw,23px);line-height:1.45;font-family:Georgia,\'Noto Serif\',serif">' + html + '</div>';
        const choices = shuffle([item[2]].concat(item[3]));
        opts.innerHTML = '';
        choices.forEach((ch, i) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
          b.innerHTML = '<span class="L">' + 'ABCD'[i] + '</span><span>' + K.esc(ch) + '</span>';
          b.addEventListener('click', () => answer(b, ch === item[2]));
          opts.appendChild(b);
        });
        note.className = 'sim-note'; note.textContent = 'What is the highlighted feature?';
      }
      function answer(btn, ok) {
        if (!cur || cur.done) return;
        cur.done = true; tries++;
        if (ok) { score++; streak++; best = Math.max(best, streak); } else streak = 0;
        [...opts.children].forEach(b => {
          b.disabled = true;
          if (b.textContent.slice(1) === cur.item[2]) b.classList.add('correct');
        });
        if (!ok) btn.classList.add('wrong');
        note.className = 'sim-note' + (ok ? '' : ' bad');
        note.innerHTML = '<strong>' + (ok ? 'Correct.' : 'Answer: ' + K.esc(cur.item[2]) + '.') + '</strong> ' + K.esc(cur.item[4]);
        stats();
      }
      function next() {
        if (!deck.length) deck = shuffle(SPOT.filter(s => sub === 'all' || s[0] === sub));
        cur = { item: deck.pop(), done: false };
        render(cur.item); stats();
      }
      next();
    });
  };
})();
