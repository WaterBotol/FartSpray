# VCE Physics 3/4 Field Guide

An interactive study guide for **VCE Physics Units 3 & 4** (VCAA 2024–2027 study design): detailed explanations, step-by-step worked solutions, trick questions, 16 simulations, a quiz mode, a formula sheet, a glossary and a search bar.

The whole site is one self-contained file, `index.html`. It needs no server, no login and no build step to use.

## Sharing it

| Option | How |
|---|---|
| **GitHub Pages** (public link, no sign-in) | Repo **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch and the `/ (root)` folder, save. The guide is then at `https://<user>.github.io/<repo>/physics/`. The repo must be public on a free GitHub plan. |
| **Any static host** | Upload `index.html` to Netlify Drop, Cloudflare Pages, Google Sites (as an embed), or a school web server. |
| **Offline** | Send or save `index.html` and open it in any browser. Maths renders offline; only the web fonts fall back to system fonts. |

## What's inside

- **Start here:** usage manual, exam technique, formula sheet and constants
- **Unit 3 AoS 1:** Newton's laws, tension & connected bodies, circular motion & banked tracks, vertical circles & rollercoasters, projectiles, momentum & impulse, work & energy, springs & bungee jumping
- **Unit 3 AoS 2:** the field model, gravitational fields, satellites, electric fields, magnetic fields, motors, charged particles & synchrotrons
- **Unit 3 AoS 3:** flux & Faraday's law, Lenz's law, generators, AC & RMS, transformers, transmission
- **Unit 4 AoS 1:** EM waves, Young's double slit, diffraction, photoelectric effect, wave–particle duality, matter waves, energy levels & spectra, special relativity (postulates, time dilation & length contraction, E = mc²)
- **Unit 4 AoS 2:** key science skills, graphs & linearisation, the practical investigation & poster
- **Practice:** trick question gauntlet (random quiz), review list, glossary

Progress (completed topics, self-marks, quiz answers) is stored in the browser's `localStorage` only.

## Editing the content

Content lives in `src/`:

- `src/topics/*.html`: one file per page, with a metadata comment at the top (`id`, `title`, `summary`, `keywords`, `dotpoints`). Maths uses `\( … \)` inline and `\[ … \]` display (KaTeX).
- `src/groups.json`: the course map order.
- `src/app.js`, `src/styles.css`, `src/body.html`: the app shell (router, search, quiz engine, theme).
- `src/sims/*.js`: the simulations.

Markup the app turns into interactive components:

```html
<aside class="c-trap">…</aside>              <!-- also c-key, c-exam, c-def, c-deep -->
<div class="we" data-title="…" data-marks="3"> <!-- worked example, revealed step by step -->
  <div class="we-q">question</div><div class="we-s">step</div><div class="we-a">answer</div>
</div>
<div class="pq" data-level="hard" data-marks="2"><div class="pq-q">…</div><div class="pq-s">…</div></div>
<div class="mcq" data-ans="B" data-level="trick"><div class="mcq-q">…</div><ol><li>…</li></ol><div class="mcq-x">…</div></div>
<div class="sim" data-sim="loop"></div>
```

Rebuild the single file after editing:

```bash
cd physics
npm install        # once, fetches KaTeX
npm run build      # writes index.html (checks tag balance, maths delimiters and MCQ answers)
```

## Sources

Aligned to the key knowledge in the VCAA *VCE Physics Study Design 2024–2027*. All explanations, diagrams, worked examples and questions are original to this guide (not copied from Edrolo, VCAA exams or other publishers). Numerical values use the VCAA data-sheet constants.
