# VCE 3/4 Field Guide

An interactive study guide for **VCE Units 3 & 4** in five subjects: **Mathematical Methods, Physics, Chemistry, Biology and English Language**. It has detailed explanations, step-by-step worked solutions, about 1,100 practice questions (basic → exam-level → trick), a cross-subject trick-question quiz, a review list, glossaries, 38 interactive simulations and a search bar across every subject.

The whole site is one self-contained file, `index.html`. It needs no server, no login and no build step to use.

## Sharing it

| Option | How |
|---|---|
| **GitHub Pages** (public link, no sign-in) | Repo **Settings → Pages → Deploy from a branch**, pick the branch and `/ (root)`. The guide is then at `https://<user>.github.io/<repo>/vce/`. |
| **Any static host** | Upload `index.html` to Netlify Drop, Cloudflare Pages or a school web server. |
| **Offline** | Send or save `index.html` and open it in any browser. Maths renders offline; web fonts fall back to system fonts. |

## What's inside

| Subject | Pages | Highlights |
|---|---|---|
| Mathematical Methods | 30 | Functions and transformations, calculus, probability and statistics; Exam 1 (tech-free) and Exam 2 (CAS) practice; transformation, tangent, Newton's method, trapezium, binomial, normal and confidence-interval simulations |
| Physics | 38 | Motion (incl. rollercoasters and tension), fields, generation and transmission, light and matter, relativity, practical investigation; 16 simulations |
| Chemistry | 28 | Fuels, galvanic and electrolytic cells, rates and equilibrium, organic reactions and analysis, food chemistry; galvanic cell, Maxwell–Boltzmann, equilibrium and NMR simulations |
| Biology | 24 | Nucleic acids and proteins, DNA tools, enzymes, photosynthesis and respiration, immunity, disease, evolution; translation/mutation, gel, enzyme, photosynthesis and genetic drift simulations |
| English Language | 20 | Metalanguage, informal and formal language, Australian English and its varieties, identity; Section A/B/C practice with original transcripts, a model commentary and essay plans; HCE vowel chart and feature-spotting drill |

Progress (completed topics, self-marks, quiz answers) is stored in the browser's `localStorage` only.

## Editing the content

- `src/subjects.json`: subject order.
- `src/subjects/<subject>/subject.json`: id, topic-id prefix, name, study design and course-map groups.
- `src/subjects/<subject>/topics/*.html`: one file per page, with a metadata comment at the top (`id`, `title`, `short`, `summary`, `keywords`, `dotpoints`, optional `special: overview|reference`). Links like `href="#id"` are prefixed with the subject automatically. Maths uses `\( … \)` and `\[ … \]` (KaTeX, with mhchem `\ce{}`).
- `src/app.js`, `src/styles.css`, `src/body.html`, `src/hub/`: the app shell (hub, router, search, quiz, review, theme).
- `src/sims/*.js`: the simulations (shared toolkit in `00-kit.js`).

Component markup (worked examples, practice questions, MCQs, callouts, sims) is the same as in `../physics/README.md`.

```bash
cd vce
npm install        # once, fetches KaTeX
node build.mjs     # writes index.html (checks tag balance, maths delimiters and MCQ answers)
node build.mjs --artifact out.html [--artifact-url <url>]   # CDN-KaTeX fragment for claude.ai Artifacts
```

## Sources

Aligned to the key knowledge in the current VCAA study designs for each subject. All explanations, diagrams, worked examples, transcripts and questions are original to this guide, written in the style of VCAA exams. Nothing is copied from Edrolo, VCAA exams or other publishers, so use the guide alongside the real past exams and examiners' reports on the [VCAA website](https://www.vcaa.vic.edu.au/assessment/vce-assessment/past-examinations). Numerical answers were checked by computation. Constants follow the VCAA data books, and English Language examples are real and dated.
