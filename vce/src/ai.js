/* ==========================================================================
   Claude in the guide: a tutor you can ask about any question, topic or set
   of notes, and a marker for practice-exam written answers.
   Runs on claude.ai through the artifact `sample` capability. Each call uses
   the viewer's own Claude usage, and the first one asks their permission.
   Anywhere else (a saved copy, another host) there is no `window.claude`:
   every Claude control stays hidden and the rest works as before.
   The notes pop-out on the review list works everywhere.
   ========================================================================== */
(function () {
  'use strict';
  const A = window.GUIDE_APP;
  if (!A) return;
  const doc = document, root = doc.documentElement, body = doc.body;
  const $ = (s, r) => (r || doc).querySelector(s), $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));
  const esc = A.esc, store = A.store, SPARK = A.AI_SPARK;
  const MOTION = () => window.GUIDE_MOTION;
  const phone = () => window.innerWidth <= 720;

  /* ---------------------------------------------------------------- availability */
  let sample = null;
  const HIDE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
  const setAvail = on => root.classList.toggle('has-claude', !!on);
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      window.claude.use('sample').then(s => { sample = s || null; setAvail(!!s); }, () => setAvail(false));
    }
  } catch (e) { setAvail(false); }

  // viewer-facing copy for each failure; `keep` = whatever streamed may stay on screen
  function failCopy(e) {
    const code = e && e.code;
    if (HIDE.includes(code)) { sample = null; setAvail(false); return { msg: 'Claude isn’t available in this view, so the Claude buttons are hidden for now.', keep: false }; }
    switch (code) {
      case 'cancelled': return { msg: '', keep: true };
      case 'rate_limited': return { msg: 'You’ve hit a Claude usage or rate limit. Give it a minute, then try again.', keep: true, retry: true };
      case 'session_expired': return { msg: 'Your claude.ai session expired. Sign in again, then retry.', keep: true, retry: true };
      case 'refused': return { msg: 'Claude declined that one. Try asking it a different way.', keep: false };
      case 'prompt_too_large': return { msg: 'That’s more than Claude can read at once. Start a new chat.', keep: true };
      case 'empty_completion': return { msg: 'Claude didn’t write anything back. Try rephrasing.', keep: false };
      case 'invalid_json': return { msg: 'Claude’s reply didn’t come back in a form the page could read.', keep: false, retry: true };
      default: return { msg: 'Something went wrong reaching Claude.', keep: true, retry: true };
    }
  }

  /* ---------------------------------------------------------------- markdown + maths */
  // Claude writes Markdown with LaTeX; maths is lifted out first so nothing mangles it, then KaTeX renders it
  function md(src) {
    const math = [], code = [];
    const keepM = (m, disp) => { math.push(disp ? '\\[' + m + '\\]' : '\\(' + m + '\\)'); return '\u0000' + (math.length - 1) + '\u0000'; };
    let s = String(src || '').replace(/\r/g, '');
    s = s.replace(/```[\w+-]*\n?([\s\S]*?)(?:```|$)/g, (_, c) => { code.push('<pre class="md-pre"><code>' + esc(c.replace(/\n$/, '')) + '</code></pre>'); return '\n\u0001' + (code.length - 1) + '\u0001\n'; });
    s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => keepM(m, true))
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => keepM(m, true))
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => keepM(m, false))
      .replace(/(^|[^\\$\w])\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?![\w$])/g, (_, pre, m) => pre + keepM(m, false));
    s = esc(s);
    const inline = t => t
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
    const lines = s.split('\n');
    let out = '', para = [], list = null;
    const flushP = () => { if (para.length) { out += '<p>' + inline(para.join(' ')) + '</p>'; para = []; } };
    const flushL = () => { if (list) { out += '<' + list.tag + '>' + list.items.map(x => '<li>' + inline(x) + '</li>').join('') + '</' + list.tag + '>'; list = null; } };
    const flush = () => { flushP(); flushL(); };
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i], tr = ln.trim();
      let m;
      if (!tr) { flush(); continue; }
      if (/^\u0001\d+\u0001$/.test(tr)) { flush(); out += tr; continue; }
      if ((m = tr.match(/^(#{1,6})\s+(.*)$/))) { flush(); const lv = m[1].length <= 2 ? 'h4' : 'h5'; out += '<' + lv + '>' + inline(m[2].replace(/\s*#+$/, '')) + '</' + lv + '>'; continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(tr)) { flush(); out += '<hr>'; continue; }
      if (/^\|.*\|$/.test(tr) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
        flush();
        const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        let t = '<div class="md-tbl"><table><thead><tr>' + row(tr).map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { t += '<tr>' + row(lines[i]).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>'; i++; }
        i--; out += t + '</tbody></table></div>'; continue;
      }
      if ((m = ln.match(/^\s*(?:[-*•+])\s+(.*)$/))) { flushP(); if (!list || list.tag !== 'ul') { flushL(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = ln.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (!list || list.tag !== 'ol') { flushL(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = tr.match(/^&gt;\s?(.*)$/))) { flush(); out += '<blockquote>' + inline(m[1]) + '</blockquote>'; continue; }
      if (list && /^\s{2,}\S/.test(ln)) { list.items[list.items.length - 1] += ' ' + tr; continue; }
      flushL(); para.push(tr);
    }
    flush();
    return out.replace(/\u0001(\d+)\u0001/g, (_, n) => code[+n]).replace(/\u0000(\d+)\u0000/g, (_, n) => esc(math[+n]));
  }
  function paint(el, text) { el.innerHTML = md(text); A.renderMath(el); }

  /* ---------------------------------------------------------------- the sheet */
  // phones: a floating bottom sheet that follows the finger and settles on a spring
  // wider screens: an inspector panel on the right; the page stays usable beside it
  let cur = null;
  const X_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  function openSheet({ title, sub, icon, cls, modal }) {
    closeSheet(true);
    const scrim = doc.createElement('div'); scrim.className = 'ai-scrim' + (modal ? ' modal' : '');
    const el = doc.createElement('section');
    el.className = 'ai-sheet' + (cls ? ' ' + cls : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', phone() || modal ? 'true' : 'false'); el.setAttribute('aria-labelledby', 'aiSheetT');
    el.innerHTML = '<div class="ai-grab" aria-hidden="true"></div><header class="ai-head">' + (icon || '') + '<div class="ai-tt"><b id="aiSheetT">' + title + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' +
      '<button class="ai-x" type="button" aria-label="Close">' + X_ICON + '</button></header><div class="ai-body"></div><div class="ai-foot"></div>';
    body.append(scrim, el);
    const s = { el, scrim, body: $('.ai-body', el), foot: $('.ai-foot', el), last: doc.activeElement, onClose: null, anim: null };
    cur = s;
    void el.offsetWidth;
    el.classList.add('open'); scrim.classList.add('open');
    if (phone() || modal) root.classList.add('sheet-lock');
    $('.ai-x', el).addEventListener('click', () => closeSheet());
    scrim.addEventListener('click', () => closeSheet());
    dragToDismiss(s);
    setTimeout(() => { if (cur === s) $('.ai-x', el).focus({ preventScroll: true }); }, 60);
    return s;
  }
  function closeSheet(instant) {
    const s = cur; if (!s) return;
    cur = null;
    if (s.anim) s.anim.stop();
    if (s.onClose) try { s.onClose(); } catch (e) { /* noop */ }
    root.classList.remove('sheet-lock');
    const gone = () => { s.el.remove(); s.scrim.remove(); };
    if (instant || (MOTION() && MOTION().calm())) gone();
    else {
      s.el.style.transform = ''; s.scrim.style.opacity = '';
      s.el.classList.remove('open', 'dragging'); s.scrim.classList.remove('open');
      s.el.addEventListener('transitionend', gone, { once: true }); setTimeout(gone, 700);
    }
    if (s.last && s.last.focus && doc.contains(s.last)) try { s.last.focus({ preventScroll: true }); } catch (e) { /* noop */ }
  }
  function dragToDismiss(s) {
    const grip = [$('.ai-grab', s.el), $('.ai-head', s.el)];
    let y0 = 0, pos = 0, drag = false, samples = [];
    const h = () => s.el.getBoundingClientRect().height;
    const place = y => { pos = y; s.el.style.transform = 'translateY(' + y.toFixed(1) + 'px)'; s.scrim.style.opacity = String(Math.max(0, 1 - y / h())); };
    const start = e => {
      if (!phone() || e.target.closest('button')) return;
      if (s.anim) { s.anim.stop(); s.anim = null; }
      y0 = e.touches[0].clientY - pos; drag = true; samples = []; s.el.classList.add('dragging');
    };
    const move = e => {
      if (!drag) return;
      const raw = e.touches[0].clientY - y0, M = MOTION();
      place(raw >= 0 ? raw : -(M ? M.rubber(-raw) : 0));
      samples.push([performance.now(), raw]); if (samples.length > 6) samples.shift();
    };
    const end = () => {
      if (!drag) return;
      drag = false;
      let v = 0;
      if (samples.length > 1) { const a = samples[0], b = samples[samples.length - 1]; v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]) * 1000; }
      const close = pos + v * 0.2 > h() * 0.38, M = MOTION();
      if (close) {
        if (!M || M.calm()) { closeSheet(true); return; }
        s.anim = M.spring({ from: pos, to: h() + 30, velocity: v, response: 0.34, damping: 1, onUpdate: place, onDone: () => closeSheet(true) });
      } else {
        if (!M || M.calm()) { place(0); s.el.classList.remove('dragging'); s.el.style.transform = ''; return; }
        s.anim = M.spring({ from: pos, to: 0, velocity: v, response: 0.42, damping: 0.82, onUpdate: place, onDone: () => { s.anim = null; s.el.classList.remove('dragging'); s.el.style.transform = ''; s.scrim.style.opacity = ''; pos = 0; } });
      }
    };
    grip.forEach(g => { if (!g) return; g.addEventListener('touchstart', start, { passive: true }); g.addEventListener('touchmove', move, { passive: true }); g.addEventListener('touchend', end); g.addEventListener('touchcancel', end); });
  }
  doc.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) { e.stopPropagation(); closeSheet(); } }, true);
  window.addEventListener('hashchange', () => { if (cur && !cur.keep) closeSheet(); });

  const aiIcon = '<span class="ai-ic" aria-hidden="true">' + SPARK + '</span>';
  const PEN = '<svg class="pen" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

  /* ---------------------------------------------------------------- saved notes */
  const NOTES = 'mynotes';
  const mine = tid => (store.get(NOTES, {})[tid] || []);
  function saveNote(tid, title, text) {
    const all = store.get(NOTES, {}), list = all[tid] || [];
    list.unshift({ id: Date.now().toString(36), t: Date.now(), title: String(title).slice(0, 120), md: text });
    all[tid] = list.slice(0, 40); store.set(NOTES, all);
    A.toast('Saved to My notes');
    refreshMine();
  }
  function dropNote(tid, id) {
    const all = store.get(NOTES, {});
    all[tid] = (all[tid] || []).filter(n => n.id !== id);
    if (!all[tid].length) delete all[tid];
    store.set(NOTES, all); refreshMine();
  }
  function mineHTML(tid) {
    const list = mine(tid);
    if (!list.length) return '';
    return '<div class="my-notes" data-mine="' + tid + '"><div class="my-h">My notes <span>' + list.length + '</span></div>' + list.map(n =>
      '<details class="my-n" data-id="' + n.id + '"><summary><span>' + esc(n.title) + '</span><time>' + new Date(n.t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + '</time></summary><div class="md" data-md="' + n.id + '"></div>' +
      '<div class="my-acts"><button class="btn ghost" type="button" data-copy-note="' + n.id + '">Copy</button><button class="btn ghost" type="button" data-drop-note="' + n.id + '">Delete</button></div></details>').join('') + '</div>';
  }
  function fillMine(scope) {
    $$('.my-notes', scope).forEach(box => {
      const list = mine(box.dataset.mine);
      $$('.md[data-md]', box).forEach(d => { const n = list.find(x => x.id === d.dataset.md); if (n && !d.dataset.done) { paint(d, n.md); d.dataset.done = '1'; } });
    });
  }
  function refreshMine() {
    $$('[data-mine-slot]').forEach(slot => { slot.innerHTML = mineHTML(slot.dataset.mineSlot); fillMine(slot); });
  }

  /* ---------------------------------------------------------------- chat */
  const preamble = subj => 'You’re Claude, built into a VCE study guide as a tutor for ' + (subj ? subj + ' Units 3 & 4' : 'VCE Units 3 & 4') + ' (Victoria, Australia). The student is in Year 12, preparing for the end-of-year VCAA exam.\n' +
    'How to answer:\n' +
    '- Be accurate to the current VCAA study design and to how VCAA assessors mark. If something is beyond the course, say so in a sentence.\n' +
    '- Teach the why, not just the steps: name the principle, then show how it applies here.\n' +
    '- Friendly, plain language and Australian spelling. Short paragraphs and bullet points, **bold** for key terms. Headings only for long answers.\n' +
    '- Put every formula, calculation and chemical equation in LaTeX: inline between \\( and \\), display between \\[ and \\]. Use \\ce{} for chemical equations.\n' +
    '- Keep it tight, about 150 to 350 words, unless the student asks for more.\n' +
    '- When you ask the student a question, stop there and wait for their answer.';
  const MAX_CTX = 40000;
  const clip = (s, n) => (s.length > n ? s.slice(0, n) + '\n[…trimmed]' : s);

  function openChat(cfg) {
    const s = openSheet({ title: cfg.title, sub: cfg.sub, icon: aiIcon, cls: 'ai-chat' });
    s.body.innerHTML = (cfg.card ? '<div class="ai-card">' + cfg.card + '</div>' : '') +
      '<div class="ai-msgs" aria-live="polite"></div>' +
      '<div class="ai-starters">' + (cfg.starters || []).map((st, i) => '<button type="button" class="ai-chip' + (st.primary ? ' primary' : '') + '" data-i="' + i + '">' + (st.primary ? SPARK : '') + '<span>' + esc(st.label) + '</span></button>').join('') + '</div>';
    s.foot.innerHTML = '<form class="ai-compose"><textarea rows="1" placeholder="' + esc(cfg.placeholder || 'Ask anything about this…') + '" aria-label="Message Claude"></textarea>' +
      '<button class="ai-send" type="submit" aria-label="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>' +
      '<p class="ai-note">Uses your own Claude usage. Claude can be wrong, so check it against the notes.</p>';
    if (cfg.cardMath) A.renderMath($('.ai-card', s.body));
    const msgs = $('.ai-msgs', s.body), starters = $('.ai-starters', s.body), form = $('form', s.foot), ta = $('textarea', form), send = $('.ai-send', form);
    const turns = [];        // what Claude has seen: user / assistant, alternating
    let ctl = null, busy = false;
    s.onClose = () => { if (ctl) ctl.abort(); };
    const nearBottom = () => s.body.scrollHeight - s.body.scrollTop - s.body.clientHeight < 80;
    const toBottom = () => { s.body.scrollTop = s.body.scrollHeight; };
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
    const setBusy = on => {
      busy = on; send.classList.toggle('stop', on);
      send.setAttribute('aria-label', on ? 'Stop' : 'Send');
      send.innerHTML = on ? '<i></i>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    };
    const firstTurn = text => preamble(cfg.subject) + (cfg.context ? '\n\nHere is what the student is looking at in the guide:\n<context>\n' + clip(cfg.context, MAX_CTX) + '\n</context>' : '') + '\n\n' + text;
    const fit = list => {   // keep the opening turn (it carries the context) and the most recent ones
      let out = list.slice(), size = () => out.reduce((a, t) => a + t.content.length, 0);
      while (size() > 180000 && out.length > 3) out.splice(1, 2);
      return out;
    };

    function bubble(role, html) {
      const m = doc.createElement('div'); m.className = 'ai-msg ' + role;
      m.innerHTML = role === 'user' ? '<div class="ai-u">' + html + '</div>' : '<div class="ai-who">' + SPARK + '<span>Claude</span></div><div class="md"></div><div class="ai-msg-acts"></div>';
      msgs.appendChild(m); return m;
    }
    async function ask(prompt, label) {
      if (busy) return;
      if (!sample) { A.toast('Claude isn’t available here'); return; }
      starters.hidden = true;
      const u = bubble('user', esc(label || prompt).replace(/\n/g, '<br>'));
      turns.push({ role: 'user', content: turns.length ? prompt : firstTurn(prompt) });
      const m = bubble('assistant'), out = $('.md', m), acts = $('.ai-msg-acts', m);
      out.innerHTML = '<span class="ai-think">Thinking…</span>';
      toBottom();
      setBusy(true);
      ctl = new AbortController();
      let shown = '', raf = 0;
      const draw = () => { raf = 0; const stick = nearBottom(); paint(out, shown); if (stick) toBottom(); };
      try {
        const res = await sample(fit(turns), {
          signal: ctl.signal, cache: false,
          onText: ({ text }) => { shown = text; if (!raf) raf = requestAnimationFrame(draw); }
        });
        if (raf) cancelAnimationFrame(raf);
        shown = res.text; draw();
        turns.push({ role: 'assistant', content: res.text });
        if (res.truncated) m.insertBefore(Object.assign(doc.createElement('p'), { className: 'ai-warn', textContent: 'Claude ran out of room here. Ask it to keep going, or to go shorter.' }), acts);
        addActions(acts, res.text, label || prompt);
        if (nearBottom() || s.body.scrollHeight - s.body.scrollTop - s.body.clientHeight < 160) toBottom();
      } catch (e) {
        if (raf) cancelAnimationFrame(raf);
        const f = failCopy(e), part = f.keep && e && e.text ? e.text : '';
        if (part) {                       // keep what streamed; the conversation carries on from it
          paint(out, part); turns.push({ role: 'assistant', content: part }); addActions(acts, part, label || prompt);
          if (e.code === 'cancelled') m.insertBefore(Object.assign(doc.createElement('p'), { className: 'ai-warn', textContent: 'Stopped.' }), acts);
        } else {                          // nothing usable: take the question back off the conversation
          turns.pop();
          if (!f.msg) { m.remove(); u.remove(); }
          else out.innerHTML = '';
        }
        if (f.msg) {
          m.insertBefore(Object.assign(doc.createElement('p'), { className: 'ai-warn', textContent: f.msg }), acts);
          if (f.retry && !part) {
            const b = doc.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Try again';
            b.addEventListener('click', () => { m.remove(); u.remove(); ask(prompt, label); });
            acts.appendChild(b);
          }
        }
      } finally {
        setBusy(false); ctl = null;
      }
    }
    function addActions(acts, text, title) {
      const copy = doc.createElement('button'); copy.type = 'button'; copy.className = 'btn ghost'; copy.textContent = 'Copy';
      copy.addEventListener('click', () => A.copyText(text, 'Copied'));
      acts.appendChild(copy);
      if (cfg.tid) {
        const sv = doc.createElement('button'); sv.type = 'button'; sv.className = 'btn ghost'; sv.textContent = 'Save to my notes';
        sv.addEventListener('click', () => { saveNote(cfg.tid, (cfg.noteTitle ? cfg.noteTitle + ': ' : '') + title, text); sv.textContent = 'Saved ✓'; sv.disabled = true; });
        acts.appendChild(sv);
      }
    }
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (busy) { if (ctl) ctl.abort(); return; }
      const v = ta.value.trim(); if (!v) { ta.focus(); return; }
      ta.value = ''; grow(); ask(v);
    });
    starters.addEventListener('click', e => { const b = e.target.closest('.ai-chip'); if (!b) return; const st = cfg.starters[+b.dataset.i]; ask(st.prompt, st.label); });
    if (cfg.intro) { const m = bubble('assistant'); paint($('.md', m), cfg.intro); }
    if (!phone()) setTimeout(() => ta.focus({ preventScroll: true }), 80);
    return { ask, sheet: s };
  }

  /* ---------------------------------------------------------------- what Claude gets told */
  const tTitle = t => (t.short || t.title).replace(/<[^>]+>/g, '');
  function topicText(t, budget) {
    const np = A.noteParts(t), box = doc.createElement('div');
    box.innerHTML = np.summary || '';
    let s = 'Topic: ' + tTitle(t) + (t.subj ? ' (' + t.subj.name + (t.groupObj && t.groupObj.eyebrow ? ', ' + t.groupObj.eyebrow : '') + ')' : '') + '\n';
    if (t.dotpoints && t.dotpoints.length) { const d = doc.createElement('div'); d.innerHTML = t.dotpoints.map(x => '<li>' + x + '</li>').join(''); s += '\nStudy design key knowledge (summarised):\n' + A.htmlText(d) + '\n'; }
    if (np.summary) s += '\nThe guide’s summary:\n' + A.htmlText(box) + '\n';
    if (budget > 2000) { const f = doc.createElement('div'); f.innerHTML = np.full; $$('.sim, .sim-panel', f).forEach(x => x.remove()); s += '\nThe guide’s full notes:\n' + clip(A.htmlText(f), budget) + '\n'; }
    return s;
  }
  function questionText(q) {
    const t = q.topic;
    return 'Subject: ' + (t.subj ? t.subj.name : '') + '\nTopic: ' + tTitle(t) + '\n\n' +
      (q.exam ? 'Practice-exam question ' + q.label.replace('Question ', '') + ' (from “' + tTitle(t) + '”, ' + (q.mcq ? 'multiple choice' : 'written') : 'Practice question ' + q.n + ' (' + (q.mcq ? 'multiple choice' : 'short answer')) + (q.marks ? ', ' + q.marks + ' mark' + (q.marks === '1' ? '' : 's') : '') + ', level: ' + q.level + '):\n' + q.stem + '\n' +
      (q.options.length ? '\nOptions:\n' + q.options.join('\n') + '\n' : '') +
      (q.mcq ? '\nCorrect answer: ' + q.answer + '\n' : '') +
      (q.chosen && q.chosen !== q.answer ? 'The student chose ' + q.chosen + ', which is wrong.\n' : '') +
      (q.formulas ? '\nFormulas the guide lists for it: ' + q.formulas + '\n' : '') +
      (q.solution ? '\nThe guide’s solution:\n' + q.solution + '\n' : '');
  }
  const qCard = q => '<div class="ai-card-h">' + (q.topic.subj ? A.subjIcon(q.topic.subj.id) : '') + '<span>' + esc(q.label) + ' · ' + esc(tTitle(q.topic)) + '</span></div>' +
    '<div class="ai-card-q md">' + md(q.stem.length > 700 ? q.stem.slice(0, 700) + ' …' : q.stem) + (q.options.length ? '<ol class="ai-opts" type="A">' + q.options.map(o => '<li>' + md(o.replace(/^[A-Z]\.\s*/, '')).replace(/^<p>|<\/p>$/g, '') + '</li>').join('') + '</ol>' : '') + '</div>';

  function askQuestion(key) {
    const q = A.question(key);
    if (!q) { A.toast('Couldn’t find that question any more'); return; }
    const t = q.topic, wrong = q.chosen && q.chosen !== q.answer, bg = A.topic(q.notesTid);
    const starters = [
      { label: 'Explain the theory behind it', primary: true, prompt: 'Explain the theory behind this question. Cover: the core concept or principle it is really testing; why that principle is true (from first principles, briefly); how the method in the solution follows from it, step by step; how to recognise this kind of question in an exam; and the trap or misconception it is designed to catch. Finish with one quick check question for me, and wait for my answer.' },
      { label: 'Quiz me on the theory', prompt: 'Quiz me on the theory behind this question, one question at a time, Socratic style. Start with the most basic idea it depends on. After each of my answers, tell me straight whether I’m right, fix any misconception in a sentence or two, then ask the next question, building up to the full question. Don’t give the full solution away. Ask your first question now.' }
    ];
    if (wrong) starters.push({ label: 'Why isn’t ' + q.chosen + ' right?', prompt: 'I picked ' + q.chosen + '. Explain what thinking leads to ' + q.chosen + ', exactly why it is wrong, and why ' + q.answer + ' is right, using the underlying theory.' });
    starters.push(
      { label: 'Walk me through the solution', prompt: 'Walk me through the solution step by step, saying what principle justifies each step and what an assessor needs to see written down to award each mark.' },
      { label: 'Give me a similar question', prompt: 'Write one new exam-style question that tests the same theory in a different context or with different numbers, with a mark allocation. Don’t show the answer: let me try it first and wait for my answer, then mark it.' }
    );
    openChat({
      title: 'Ask Claude', sub: esc((t.subj ? t.subj.short + ' · ' : '') + q.label + ' · ' + tTitle(t)),
      subject: t.subj && t.subj.name, tid: q.notesTid || t.id, noteTitle: (q.exam ? tTitle(t) + ' ' : '') + 'Q' + q.label.replace('Question ', ''),
      context: questionText(q) + (bg && !bg.special ? '\n\nBackground from the topic:\n' + topicText(bg, 6000) : ''),
      card: qCard(q), cardMath: true, starters, placeholder: 'Ask about this question…'
    });
  }
  function askTopic(tid) {
    const t = A.topic(tid);
    if (!t) return;
    openChat({
      title: 'Ask Claude', sub: esc((t.subj ? t.subj.short + ' · ' : '') + tTitle(t)),
      subject: t.subj && t.subj.name, tid: t.id,
      context: topicText(t, 30000),
      card: '<div class="ai-card-h">' + (t.subj ? A.subjIcon(t.subj.id) : '') + '<span>' + esc(tTitle(t)) + '</span></div>' + (t.summary ? '<p class="ai-card-p">' + t.summary + '</p>' : ''), cardMath: true,
      starters: [
        { label: 'Explain this topic simply', primary: true, prompt: 'Explain this topic to me as if I’m seeing it properly for the first time: the big idea, the few principles everything else follows from, and how they connect. Then list the formulas or key terms I must know cold.' },
        { label: 'Quiz me on it', prompt: 'Quiz me on this topic, one question at a time, mixing recall, reasoning and short calculations at VCAA exam level. After each answer, tell me straight if I’m right and why, then ask the next. Start now.' },
        { label: 'Make a one-page summary', prompt: 'Make me a one-page revision summary of this topic: key ideas, formulas with when to use them, the classic traps, and what examiners reward. Use headings and bullets.' },
        { label: 'What do examiners look for?', prompt: 'What do VCAA assessors look for on this topic? Cover the typical question types, the wording and working that earn marks, and the common ways students lose marks.' }
      ],
      placeholder: 'Ask about ' + tTitle(t) + '…'
    });
  }
  function askPage() {
    const t = A.current();
    if (t && t.subject && !t.special) { askTopic(t.id); return; }
    const subj = t && t.subj ? t.subj.name : '';
    openChat({
      title: 'Ask Claude', sub: esc(t ? tTitle(t) : 'VCE Field Guide'), subject: subj,
      context: t ? 'The student is on the page “' + tTitle(t) + '”' + (t.summary ? ': ' + t.summary.replace(/<[^>]+>/g, '') : '') + '.' : '',
      starters: [
        { label: 'Plan my revision', primary: true, prompt: 'Help me plan my revision from now until my exams. Ask me what subjects I’m doing, my exam dates and where I’m weakest, one question at a time, then build a plan.' },
        { label: 'Explain a concept', prompt: 'I want a concept explained. Ask me which one, then explain it clearly with an example.' },
        { label: 'Exam technique tips', prompt: 'Give me the most useful exam technique for ' + (subj || 'my VCE exams') + ': reading time, planning, showing working, and how marks are lost.' }
      ]
    });
  }

  /* ---------------------------------------------------------------- notes pop-out */
  function openNotes(tid, fromKey, inSession) {
    const t = A.topic(tid);
    if (!t) return;
    const np = A.noteParts(t);
    const s = openSheet({ title: esc(tTitle(t)), sub: esc((t.subj ? t.subj.name : '') + (t.groupObj && t.groupObj.eyebrow ? ' · ' + t.groupObj.eyebrow : '')), icon: t.subj ? A.subjIcon(t.subj.id) : '', cls: 'ai-notes' });
    s.body.innerHTML = '<div class="np prose">' + (np.summary ? '<div class="np-sum">' + np.summary + '</div>' : (t.summary ? '<p>' + t.summary + '</p>' : '')) +
      (np.boxes.length ? '<div class="np-boxes">' + np.boxes.join('') + '</div>' : '') +
      '<div data-mine-slot="' + t.id + '">' + mineHTML(t.id) + '</div>' +
      '<button class="btn np-more" type="button" aria-expanded="false">Full notes</button><div class="np-full" hidden></div></div>';
    A.enhance(s.body); fillMine(s.body);
    const more = $('.np-more', s.body), full = $('.np-full', s.body);
    more.addEventListener('click', () => {
      const on = full.hidden;
      if (on && !full.dataset.ready) {
        full.innerHTML = np.full; $$('.sim, .sim-panel', full).forEach(x => x.remove()); $$('[id]', full).forEach(x => x.removeAttribute('id'));
        A.enhance(full); full.dataset.ready = '1';
      }
      full.hidden = !on; more.textContent = on ? 'Hide full notes' : 'Full notes'; more.setAttribute('aria-expanded', on);
    });
    const fq = fromKey && A.question(fromKey);
    s.foot.innerHTML = '<div class="np-acts">' + (inSession ? '' : '<a class="btn" href="#' + (fq ? fq.topic.id + '~' + fq.anchor : t.id) + '">' + (fq ? 'Go to the question' : 'Open the topic') + '</a>') +
      (fromKey ? '<button class="btn primary ai-only" type="button" data-ask-q="' + fromKey + '">' + SPARK + '<span>Ask Claude about it</span></button>' : '<button class="btn primary ai-only" type="button" data-ask-topic="' + t.id + '">' + SPARK + '<span>Ask Claude</span></button>') + '</div>';
  }

  /* ---------------------------------------------------------------- exam marking */
  const MKEY = tid => 'aimark:' + tid;
  function partInfo(exp) {
    const q = exp.closest('.exq'), stem = q && $('.exq-stem', q), qn = q ? ($('.exq-h .pq-tag', q) || {}).textContent || '' : '';
    const pq = $(':scope > .exp-q', exp), ans = $(':scope > .ex-mark .ex-ans', exp) || $('.ex-ans', exp);
    const rows = $$('.mk-row', exp).map(r => ({ cb: $('input', r), m: +(($('.mk-m', r) || {}).textContent || 1), text: A.htmlText($('.mk-t', r)) }));
    return { pid: exp.dataset.pid, exp, label: qn.replace('Question ', '') + ((($('.exp-l', exp) || {}).textContent || '').replace('.', '')), marks: +exp.dataset.marks || 0,
      stem: stem ? A.htmlText(stem) : '', part: pq ? A.htmlText(pq) : '', rows, model: ans ? A.htmlText(ans) : '', answer: ($('.ex-ta', exp) || {}).value || '' };
  }
  function markPrompt(subj, list) {
    return 'You are a senior VCAA assessor marking a Year 12 student’s practice-exam answers for VCE ' + (subj || '') + ' Units 3 & 4. Mark strictly, exactly as VCAA assessors do. A generous mark is worse than useless to this student: it hides marks they would lose in the real exam.\n\n' +
      'Rules:\n' +
      '1. Award a marking point only when the student’s answer itself clearly and correctly states that idea. Never award it for what the student probably meant, for a key term without the reasoning around it, or for restating the question.\n' +
      '2. No benefit of the doubt. If the answer is ambiguous or incomplete, or you would have to read it generously, the point is not met.\n' +
      '3. A wrong or contradictory statement next to the right one cancels that point.\n' +
      '4. "Explain" and "justify" points need the cause-and-effect link stated, not just the right terms. "Describe" and "identify" points need the specific feature, not a general statement.\n' +
      '5. "Show that" parts: the working must lead to the given value. Writing the given value without working earns nothing.\n' +
      '6. Calculations: a method point needs the correct relationship with the correct values substituted; an answer point needs the correct value, with correct units where the guide expects them. A wrong value carried forward from an earlier part and used correctly can earn the later marks (consequential marking); a wrong method never does.\n' +
      '7. For every point you award, quote the exact words from the student’s answer that earn it, copied character for character (3 to 20 words). If you cannot find words to quote, the point is not met.\n' +
      '8. If a part needs a diagram or graph, mark only what the student writes in words, and say the diagram could not be marked.\n' +
      '9. A part with no itemised points is marked holistically out of its marks, just as strictly.\n\n' +
      'Reply with JSON only, in exactly this shape:\n{"parts":[{"id":"<part id>","points":[{"met":true,"quote":"<exact words from the student’s answer>","why":"<under 15 words>"},{"met":false,"quote":"","why":"<what is missing or wrong, under 15 words>"}],"score":<number>,"feedback":"<2 to 4 sentences to the student: what earned marks and what lost them>","improve":"<one concrete sentence: what to write next time for full marks>"}]}\n' +
      '"points" has exactly one entry per marking point, in the order given (an empty list if the part has no itemised points). "score" is the total you award. Use Australian spelling and LaTeX between \\( and \\) for any maths outside the quotes.\n\nPARTS\n\n' +
      list.map(p => '### Part id "' + p.pid + '" (Question ' + p.label + ', ' + p.marks + ' mark' + (p.marks === 1 ? '' : 's') + ')\n' +
        (p.stem ? 'Question context: ' + clip(p.stem, 3000) + '\n' : '') + (p.part ? 'This part: ' + p.part + '\n' : '') +
        (p.rows.length ? 'Marking guide (marks for each point in brackets):\n' + p.rows.map((r, i) => (i + 1) + '. [' + r.m + '] ' + r.text).join('\n') + '\n' : 'No itemised marking points: mark it holistically out of ' + p.marks + '.\n') +
        (p.model ? 'Guide’s answer notes: ' + clip(p.model, 2500) + '\n' : '') +
        'Student’s answer:\n"""\n' + clip(p.answer.trim(), 9000) + '\n"""\n').join('\n');
  }
  // the evidence check: a point only stands if the words Claude quotes are really in the answer
  const words = s => String(s || '').toLowerCase().replace(/\\[a-z]+/g, ' ').replace(/[^a-z0-9.]+/g, ' ').replace(/(^|\s)\.+|\.+(\s|$)/g, ' ').trim();
  function quoted(quote, answer) {
    const q = words(quote), a = words(answer);
    if (!q) return false;
    if ((' ' + a + ' ').includes(' ' + q + ' ') || a.includes(q)) return true;
    const qs = q.split(' '), as = new Set(a.split(' '));
    return qs.length >= 3 && qs.filter(w => as.has(w)).length / qs.length >= 0.8;
  }
  function checkPoints(info, r) {
    const raw = Array.isArray(r.points) ? r.points : [];
    let removed = 0;
    const pts = info.rows.map((row, i) => {
      const p = raw[i], o = p && typeof p === 'object' ? { met: !!p.met, quote: String(p.quote || ''), why: String(p.why || '') } : { met: !!p, quote: '', why: '', old: true };
      if (o.met && !o.old && !quoted(o.quote, info.answer)) { o.met = false; o.why = 'Claude couldn’t quote where your answer says this, so no mark.'; o.removed = true; removed++; }
      return o;
    });
    const score = info.rows.length ? Math.min(info.marks, pts.reduce((a, p, i) => a + (p.met ? info.rows[i].m : 0), 0)) : Math.max(0, Math.min(info.marks, Math.round(+r.score || 0)));
    return { pts, score, removed };
  }
  function showMark(exp, r, info) {
    const out = $('.ai-mk-out', exp);
    if (!out) return;
    const { pts, score, removed } = checkPoints(info, r);
    $$('.ai-pt', exp).forEach(x => x.remove());
    info.rows.forEach((row, i) => {
      const p = pts[i], li = row.cb && row.cb.closest('.mk-row');
      if (!li || !p || (!p.quote && !p.why)) return;
      li.insertAdjacentHTML('beforeend', '<div class="ai-pt ' + (p.met ? 'ok' : 'no') + '">' + (p.met ? '✓ ' : '✗ ') + (p.met && p.quote ? '<q>' + esc(p.quote) + '</q>' + (p.why ? ' · ' : '') : '') + esc(p.why) + '</div>');
    });
    out.hidden = false;
    out.innerHTML = '<div class="ai-mk-h">' + SPARK + '<span>Claude’s marking</span><b>' + score + ' / ' + info.marks + '</b></div><div class="md"></div>' +
      (removed ? '<p class="ai-mk-cut">' + removed + ' point' + (removed === 1 ? '' : 's') + ' removed: Claude couldn’t quote the words in your answer that earn ' + (removed === 1 ? 'it' : 'them') + '.</p>' : '') +
      '<p class="ai-mk-tip">' + (info.rows.length ? 'Strict VCAA-style marking: a point only counts if Claude can quote the words that earn it. You’re still the final judge, so change any tick you disagree with.' : 'This part has no itemised points, so Claude’s mark isn’t added to your total.') + '</p>';
    paint($('.md', out), (r.feedback || '') + (r.improve ? '\n\n**Next time:** ' + r.improve : ''));
    return pts;
  }
  function applyMark(info, r, persist) {
    const pts = showMark(info.exp, r, info) || [];
    info.rows.forEach((row, i) => { const v = !!(pts[i] && pts[i].met); if (row.cb && row.cb.checked !== v) { row.cb.checked = v; row.cb.dispatchEvent(new Event('change', { bubbles: true })); } });
    if (persist) {
      const t = A.current(); if (!t) return;
      const all = store.get(MKEY(t.id), {});
      all[info.pid] = { points: Array.isArray(r.points) ? r.points : [], score: r.score, feedback: r.feedback || '', improve: r.improve || '', a: info.answer, t: Date.now() };
      store.set(MKEY(t.id), all);
    }
  }
  let marking = null;
  async function markParts(exps, statusEl, btn) {
    if (marking) { A.toast('Claude is already marking'); return; }
    if (!sample) { A.toast('Claude isn’t available here'); return; }
    const t = A.current(), subj = t && t.subj ? t.subj.name : '';
    const infos = exps.map(partInfo), todo = infos.filter(p => p.answer.trim()), blank = infos.length - todo.length;
    if (!todo.length) { A.toast(infos.length > 1 ? 'Write some answers first' : 'Write an answer first'); return; }
    const say = msg => { if (statusEl) statusEl.textContent = msg; };
    const ctl = new AbortController(); marking = ctl;
    const lbl = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span>Stop</span>'; btn.classList.add('stop'); btn.onclick = ev => { ev.stopPropagation(); ctl.abort(); }; }
    todo.forEach(p => { const o = $('.ai-mk-out', p.exp); if (o) { o.hidden = false; o.innerHTML = '<span class="ai-think">Claude is marking…</span>'; } });
    const BATCH = 4;
    let done = 0, failed = '';
    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        const chunk = todo.slice(i, i + BATCH);
        say(todo.length > 1 ? 'Marking ' + (i + 1) + (chunk.length > 1 ? '–' + (i + chunk.length) : '') + ' of ' + todo.length + '…' : 'Marking…');
        let res;
        try { res = await sample.json(markPrompt(subj, chunk), { signal: ctl.signal, cache: false, modelTier: 'complex' }); }   // the most capable tier: marking accuracy matters more than speed
        catch (e) {
          const f = failCopy(e);
          chunk.concat(todo.slice(i + BATCH)).forEach(p => { const o = $('.ai-mk-out', p.exp); if (o && o.querySelector('.ai-think')) { o.innerHTML = ''; o.hidden = true; } });
          failed = e && e.code === 'cancelled' ? 'Stopped.' : f.msg;
          if (HIDE.includes(e && e.code)) A.toast(f.msg);
          break;
        }
        const got = res && Array.isArray(res.parts) ? res.parts : [];
        chunk.forEach(p => {
          const r = got.find(x => String(x.id) === String(p.pid));
          if (r) { applyMark(p, r, true); done++; }
          else { const o = $('.ai-mk-out', p.exp); if (o) { o.hidden = false; o.innerHTML = '<p class="ai-warn">Claude skipped this part. Try marking it on its own.</p>'; } }
        });
      }
    } finally {
      marking = null;
      if (btn) { btn.innerHTML = lbl; btn.classList.remove('stop'); btn.onclick = null; }
    }
    say(failed ? failed + (done ? ' Marked ' + done + ' part' + (done === 1 ? '' : 's') + ' before that.' : '') : 'Marked ' + done + ' part' + (done === 1 ? '' : 's') + (blank ? ' · ' + blank + ' left blank' : '') + '. Check the ticks, then your total updates.');
    if (done) A.toast('Claude marked ' + done + ' part' + (done === 1 ? '' : 's'));
  }


  /* ---------------------------------------------------------------- blurt (free recall) */
  // notes hidden, write everything you remember, then see exactly which key points you missed
  const BL = 'blurts';
  function keyPoints(t) {
    const box = doc.createElement('div'); box.innerHTML = A.noteParts(t).summary || '';
    let items = $$('li', box).filter(li => !li.parentElement.closest('li'));
    if (!items.length) items = $$('p', box);
    return items.map(li => ({ html: li.innerHTML, text: A.htmlText(li).replace(/^- /, '') })).filter(x => x.text);
  }
  function lastBlurt(tid) {
    const h = (store.get(BL, {})[tid] || [])[0]; if (!h) return '';
    const d = Math.floor((Date.now() - h.t) / 864e5);
    return 'Last blurt ' + h.cov + '% · ' + (d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
  }
  function blurtPrompt(t, pts, text) {
    return 'A Year 12 student studying VCE ' + (t.subj ? t.subj.name : '') + ' Units 3 & 4 did a "blurt": with their notes closed, they wrote everything they could remember about the topic “' + tTitle(t) + '”. Check it against the guide’s key points.\n\n' +
      'For each key point decide:\n- "got": the blurt states this idea correctly (different wording is fine)\n- "partial": some of it is there, or it is vague or missing an important detail\n- "missed": it is not there\n' +
      'Be strict. A key term on its own, without the idea behind it, is "partial" at best. Something the student did not write is "missed", even if they probably know it. For "got" and "partial", quote the exact words from the blurt that show it, copied character for character (2 to 20 words).\n' +
      'Then list anything in the blurt that is wrong: misconceptions, wrong formulas, wrong units or definitions. Ignore spelling and style.\n\n' +
      'Reply with JSON only:\n{"points":[{"status":"got","quote":"<exact words from the blurt>","note":"<under 15 words>"}],"wrong":[{"claim":"<their words>","fix":"<one sentence, LaTeX between \\( and \\) for maths>"}],"tip":"<one sentence: what to focus on next>"}\n' +
      '"points" has exactly one entry per key point, in the order given. For a missed point, "note" says in a few words what the idea is.\n\n' +
      'KEY POINTS\n' + pts.map((p, i) => (i + 1) + '. ' + p.text).join('\n') + '\n\nTHE STUDENT’S BLURT\n"""\n' + clip(text, 12000) + '\n"""';
  }
  function openBlurt(tid) {
    const t = A.topic(tid); if (!t) return;
    const pts = keyPoints(t);
    if (!pts.length) { A.toast('This page has no summary to check a blurt against'); return; }
    const s = openSheet({ title: 'Blurt: ' + esc(tTitle(t)), sub: esc((t.subj ? t.subj.name + ' · ' : '') + 'write it all from memory'), icon: t.subj ? A.subjIcon(t.subj.id) : '', cls: 'ai-blurt', modal: true });   // the page is blurred out: no peeking
    const draftKey = 'blurtDraft:' + tid, last = lastBlurt(tid);
    let ctl = null, iv = 0;
    s.onClose = () => { clearInterval(iv); if (ctl) ctl.abort(); };
    s.body.innerHTML = '<div class="bl-intro"><p>Write down <b>everything</b> you remember about <b>' + esc(tTitle(t)) + '</b>: the key ideas, formulas, definitions, how they connect, and the traps. Bullet points are fine. No peeking at the notes.</p>' + (last ? '<p class="bl-last">' + last + '</p>' : '') + '</div>' +
      '<textarea class="bl-ta" placeholder="Start typing everything you know…" aria-label="Your blurt"></textarea>' +
      '<div class="bl-meta"><span class="bl-wc">0 words</span><span class="bl-time">0:00</span></div>';
    s.foot.innerHTML = '<div class="np-acts"><button class="btn primary" type="button" data-bl-check>Done, check it</button></div>';
    const ta = $('.bl-ta', s.body), wc = $('.bl-wc', s.body), tm = $('.bl-time', s.body), t0 = Date.now();
    ta.value = store.get(draftKey, '') || '';
    iv = setInterval(() => { const sec = Math.floor((Date.now() - t0) / 1000); tm.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }, 1000);
    const count = () => { const n = (ta.value.match(/\S+/g) || []).length; wc.textContent = n + ' word' + (n === 1 ? '' : 's'); return n; };
    let dt; ta.addEventListener('input', () => { count(); clearTimeout(dt); dt = setTimeout(() => store.set(draftKey, ta.value), 400); });
    count();
    if (!phone()) setTimeout(() => ta.focus({ preventScroll: true }), 120);
    $('[data-bl-check]', s.foot).addEventListener('click', () => {
      if (count() < 5) { A.toast('Write a bit more first'); ta.focus(); return; }
      clearInterval(iv); clearTimeout(dt); store.set(draftKey, ta.value);
      results(ta.value);
    });

    function record(cov) {
      const all = store.get(BL, {});
      all[tid] = [{ t: Date.now(), cov }].concat(all[tid] || []).slice(0, 10);
      store.set(BL, all); store.set(draftKey, '');
      $$('[data-bl-last="' + tid + '"]').forEach(x => { x.textContent = lastBlurt(tid); x.hidden = false; });
    }
    function ring(cov, label) {
      const r = $('.bl-ring', s.body); if (!r) return;
      r.style.setProperty('--p', cov);
      r.className = 'bl-ring ' + (cov >= 80 ? 'hi' : cov >= 50 ? 'mid' : 'lo');
      $('b', r).textContent = cov + '%';
      if (label) $('.bl-head', s.body).textContent = label;
    }
    function results(text) {
      s.body.innerHTML = '<div class="bl-score"><div class="bl-ring"><b>–</b><span>recalled</span></div><div class="bl-score-t"><b class="bl-head"></b><p class="bl-sub"></p></div></div>' +
        '<ol class="bl-pts">' + pts.map((p, i) => '<li class="bl-pt" data-i="' + i + '"><span class="bl-ic" aria-hidden="true"></span><div class="bl-pt-b"><div class="bl-pt-t">' + p.html + '</div><div class="bl-note"></div></div></li>').join('') + '</ol>' +
        '<div class="bl-wrong" hidden></div><p class="bl-tip" hidden></p><details class="bl-mine"><summary>Your blurt</summary><div class="bl-text"></div></details>';
      $('.bl-text', s.body).textContent = text;
      A.renderMath(s.body);
      s.foot.innerHTML = '';
      if (sample) withClaude(text); else selfCheck(false);
    }
    function footer(extra) {
      s.foot.innerHTML = '<div class="np-acts"><button class="btn" type="button" data-bl-notes>Open the notes</button><button class="btn" type="button" data-bl-again>Blurt again</button>' + (extra || '') + '</div>';
      $('[data-bl-notes]', s.foot).addEventListener('click', () => openNotes(tid));
      $('[data-bl-again]', s.foot).addEventListener('click', () => openBlurt(tid));
    }
    function selfCheck(failed) {
      $('.bl-head', s.body).textContent = 'Tick the points you had';
      $('.bl-sub', s.body).textContent = (failed ? 'Claude couldn’t check it, so check it yourself. ' : '') + 'Compare your blurt (at the bottom) with each key point, and only tick it if you actually wrote the idea.';
      $$('.bl-pt', s.body).forEach(li => { li.classList.add('self'); const ic = $('.bl-ic', li); const cb = doc.createElement('input'); cb.type = 'checkbox'; cb.className = 'bl-cb'; cb.setAttribute('aria-label', 'I had this'); ic.replaceWith(cb); });
      $('.bl-mine', s.body).open = true;
      const upd = () => ring(Math.round(100 * $$('.bl-cb:checked', s.body).length / pts.length));
      s.body.addEventListener('change', upd); upd();
      footer('<button class="btn primary" type="button" data-bl-save>Save result</button>');
      $('[data-bl-save]', s.foot).addEventListener('click', e => {
        const n = $$('.bl-cb:checked', s.body).length, cov = Math.round(100 * n / pts.length);
        record(cov); e.target.textContent = 'Saved ✓'; e.target.disabled = true;
        const miss = $$('.bl-pt', s.body).filter(li => !$('.bl-cb', li).checked).map(li => '- ' + pts[+li.dataset.i].text);
        if (miss.length) gapsButton('**Missed in my blurt (' + cov + '%)**\n' + miss.join('\n'), cov);
      });
    }
    function gapsButton(text, cov) {
      if ($('[data-bl-gaps]', s.foot)) return;
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'btn'; b.dataset.blGaps = '1'; b.textContent = 'Save gaps to my notes';
      b.addEventListener('click', () => { saveNote(tid, 'Blurt gaps (' + cov + '%)', text); b.textContent = 'Saved ✓'; b.disabled = true; });
      $('.np-acts', s.foot).appendChild(b);
    }
    async function withClaude(text) {
      $('.bl-head', s.body).innerHTML = '<span class="ai-think">Claude is checking your blurt…</span>';
      $('.bl-sub', s.body).textContent = 'Every point it says you got has to be quoted from what you wrote.';
      ctl = new AbortController();
      let res;
      try { res = await sample.json(blurtPrompt(t, pts, text), { signal: ctl.signal, cache: false }); }
      catch (e) {
        if (e && e.code === 'cancelled') return;
        const f = failCopy(e); if (f.msg) A.toast(f.msg);
        selfCheck(true); return;
      } finally { ctl = null; }
      const got = res && Array.isArray(res.points) ? res.points : [];
      const st = pts.map((p, i) => {
        const r = got[i] || {};
        let status = ['got', 'partial', 'missed'].includes(r.status) ? r.status : 'missed', note = String(r.note || ''), quote = String(r.quote || '');
        if (status !== 'missed' && !quoted(quote, text)) { status = 'missed'; note = 'Claude couldn’t find this in what you wrote.'; quote = ''; }
        return { status, note, quote: status === 'missed' ? '' : quote };
      });
      const n = k => st.filter(x => x.status === k).length;
      const cov = Math.round(100 * (n('got') + 0.5 * n('partial')) / pts.length);
      st.forEach((x, i) => {
        const li = $('.bl-pt[data-i="' + i + '"]', s.body);
        li.classList.add(x.status);
        $('.bl-ic', li).textContent = x.status === 'got' ? '✓' : x.status === 'partial' ? '½' : '✗';
        $('.bl-note', li).innerHTML = (x.quote ? '<q>' + esc(x.quote) + '</q>' + (x.note ? ' · ' : '') : '') + esc(x.note);
      });
      ring(cov, cov >= 80 ? 'Strong recall' : cov >= 50 ? 'Getting there' : 'Big gaps: worth another go');
      $('.bl-sub', s.body).textContent = n('got') + ' got · ' + n('partial') + ' partly · ' + n('missed') + ' missed, out of ' + pts.length + ' key points.';
      const wrong = (res && Array.isArray(res.wrong) ? res.wrong : []).filter(w => w && (w.claim || w.fix));
      if (wrong.length) {
        const w = $('.bl-wrong', s.body); w.hidden = false;
        w.innerHTML = '<div class="bl-wrong-h">Things you got wrong</div><ul>' + wrong.map(x => '<li>' + (x.claim ? '<q>' + esc(String(x.claim)) + '</q>' : '') + '<div class="md"></div></li>').join('') + '</ul>';
        $$('.md', w).forEach((d, i) => paint(d, String(wrong[i].fix || '')));
      }
      if (res && res.tip) { const tp = $('.bl-tip', s.body); tp.hidden = false; tp.innerHTML = '<b>Next:</b> '; tp.appendChild(doc.createTextNode(String(res.tip))); }
      record(cov);
      footer();
      const gaps = st.map((x, i) => x.status === 'got' ? '' : '- ' + (x.status === 'partial' ? '(partly) ' : '') + pts[i].text).filter(Boolean)
        .concat(wrong.map(x => '- Wrong: “' + (x.claim || '') + '” → ' + (x.fix || '')));
      if (gaps.length) gapsButton('**Gaps from my blurt (' + cov + '%)**\n' + gaps.join('\n'), cov);
    }
  }

  /* ---------------------------------------------------------------- put the controls on the page */
  function decorate(scope) {
    scope = scope || $('#main');
    if (!scope) return;
    const t = A.current();
    // topic header: ask about the topic, and saved notes
    const head = $('.t-head', scope);
    if (head && t && t.subject && !t.special && !$('.t-ai', head)) {
      const n = mine(t.id).length;
      const canBlurt = keyPoints(t).length > 0;
      head.insertAdjacentHTML('beforeend', '<div class="t-ai">' + (canBlurt ? '<button class="btn bl-btn" type="button" data-blurt="' + t.id + '">' + PEN + '<span>Blurt this topic</span></button>' : '') +
        '<button class="btn ai-only ai-ask" type="button" data-ask-topic="' + t.id + '">' + SPARK + '<span>Ask Claude about this topic</span></button>' +
        (n ? '<button class="btn" type="button" data-notes="' + t.id + '">My notes · ' + n + '</button>' : '') + '</div>');
    }
    // practice questions on topic pages
    if (t && t.subject && t.special !== 'exam') {
      $$('.mcq[id^="a-q"], .pq[id^="a-q"]', scope).forEach(q => {
        const h = $(':scope > .pq-h', q); if (!h || $('.ai-q', h)) return;
        h.insertAdjacentHTML('beforeend', '<button class="ai-q ai-only" type="button" data-ask-q="' + t.id + ':q' + q.id.slice(3) + '" aria-label="Ask Claude about question ' + q.id.slice(3) + '">' + SPARK + '<span>Ask</span></button>');
      });
    }
    // quick-notes cards
    $$('.nt-card', scope).forEach(c => {
      if ($('.nt-ai', c)) return;
      const tid = c.dataset.t, more = $('.nt-more', c);
      const lb = lastBlurt(tid);
      if (more) more.insertAdjacentHTML('afterend', '<button class="btn bl-btn nt-ai" type="button" data-blurt="' + tid + '">' + PEN + '<span>Blurt</span></button>' +
        '<button class="btn ai-only ai-ask nt-ai" type="button" data-ask-topic="' + tid + '">' + SPARK + '<span>Ask Claude</span></button>' +
        '<span class="bl-last-chip" data-bl-last="' + tid + '"' + (lb ? '' : ' hidden') + '>' + esc(lb) + '</span>');
      const slot = doc.createElement('div'); slot.dataset.mineSlot = tid; slot.innerHTML = mineHTML(tid);
      (more || c.lastChild).before(slot); fillMine(slot);
    });
    // practice exams: mark each written part, or all of them
    if (t && t.special === 'exam') {
      const saved = store.get(MKEY(t.id), {});
      $$('.exp[data-pid]', scope).forEach(exp => {
        const box = $(':scope > .ex-mark', exp); if (!box || $('.ai-mk', box)) return;
        box.insertAdjacentHTML('afterbegin', '<div class="ai-mk ai-only"><button class="btn ai-ask" type="button" data-ai-mark="' + exp.dataset.pid + '">' + SPARK + '<span>Mark with Claude</span></button><span class="ai-mk-s"></span></div>');
        const out = doc.createElement('div'); out.className = 'ai-mk-out'; out.hidden = true;
        const list = $('.mk-list', box); (list || box.firstChild).after(out);
        const r = saved[exp.dataset.pid], info = r && partInfo(exp);
        if (r && info && info.answer === r.a) showMark(exp, r, info);
      });
      const res = $('.ex-results', scope);
      if (res && $('.exp[data-pid]', scope) && !$('.ai-markall', scope)) {
        res.insertAdjacentHTML('afterend', '<div class="ai-markall ai-only"><span class="ai-ic" aria-hidden="true">' + SPARK + '</span><div class="ai-ma-t"><b>Mark my written answers with Claude</b><p>Claude marks like a strict VCAA assessor: a point only counts if it can quote the words in your answer that earn it. It ticks what you earned and tells you what lost marks. You can change any tick.</p><p class="ai-ma-s" aria-live="polite"></p></div><button class="btn primary" type="button" data-ai-markall>' + SPARK + '<span>Mark all</span></button></div>');
      }
    }
  }

  /* ---------------------------------------------------------------- clicks */
  doc.addEventListener('click', e => {
    const b = e.target.closest('[data-blurt], [data-notes], [data-ask-q], [data-ask-topic], [data-ai-mark], [data-ai-markall], #aiBtn, [data-copy-note], [data-drop-note]');
    if (!b) return;
    if (b.matches('[data-notes]')) { const it = b.closest('.rv-item'), q = it && $('[data-ask-q]', it); openNotes(b.dataset.notes, b.dataset.from || (q ? q.dataset.askQ : null), !!b.dataset.from); return; }
    if (b.matches('[data-ask-q]')) { askQuestion(b.dataset.askQ); return; }
    if (b.matches('[data-ask-topic]')) { askTopic(b.dataset.askTopic); return; }
    if (b.matches('[data-blurt]')) { openBlurt(b.dataset.blurt); return; }
    if (b.matches('#aiBtn')) { askPage(); return; }
    if (b.matches('[data-ai-mark]')) { const exp = b.closest('.exp'); markParts([exp], $('.ai-mk-s', exp), null); return; }
    if (b.matches('[data-ai-markall]')) { if (b.classList.contains('stop')) return; const exps = $$('#main .exp[data-pid]'), wrap = b.closest('.ai-markall'); markParts(exps, $('.ai-ma-s', wrap), b); return; }
    const box = b.closest('.my-notes');
    if (!box) return;
    const tid = box.dataset.mine, n = mine(tid).find(x => x.id === (b.dataset.copyNote || b.dataset.dropNote));
    if (!n) return;
    if (b.matches('[data-copy-note]')) A.copyText(n.md, 'Copied');
    else if (b.dataset.armed) dropNote(tid, n.id);
    else { b.dataset.armed = '1'; b.textContent = 'Tap again to delete'; setTimeout(() => { if (doc.contains(b)) { delete b.dataset.armed; b.textContent = 'Delete'; } }, 3000); }
  });

  window.GUIDE_AI = { decorate, openNotes, openBlurt, askQuestion, askTopic, md };
  window.addEventListener('guide:render', () => decorate());
  decorate();
})();
