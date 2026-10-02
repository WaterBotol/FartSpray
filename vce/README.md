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

Progress (completed topics, self-marks, quiz answers, the review queue) is stored in the browser's `localStorage` only.

## Review queue and blurting

- **Spaced review queue.** Every question you flag ("Review later"), get wrong in multiple choice, or send from a practice exam joins a queue. Get it right and it comes back after 1 day, then 3, 7 and 14; right again after 14 days and it's mastered. Get it wrong and it starts again tomorrow. **Start review** runs the due questions one at a time, inline.
- **Practice-exam mistakes.** Wrong multiple-choice answers join the queue when you finish a paper. After marking, written parts you answered but scored under half on can be sent with one button.
- **Blurt.** On any topic or quick-notes card: write everything you remember with the page hidden, then check it against the topic's key points. With Claude, each point is marked got / partly / missed (a "got" has to quote your words) plus anything you got wrong. Without Claude, you tick the points yourself. Gaps can be saved to My notes.

## Claude in the guide

When the guide is opened as an Artifact on claude.ai, it can call Claude through the Artifact `sample` capability:

- **Ask Claude** on any practice question, topic, quick-notes card or review-list item. It explains the theory behind the question, quizzes you on it one step at a time, or explains why your multiple-choice pick was wrong. Answers can be saved to **My notes** for that topic.
- **Mark with Claude** on practice exams. After you finish, Claude reads each written answer against the marking guide, ticks the points you earned (you can change any tick), and says what to fix.

Each call uses the viewer's own Claude usage, and the first one asks their permission. Opened anywhere else (GitHub Pages, a saved file), the Claude controls stay hidden and everything else works the same. The **Notes** pop-out on the review list works everywhere.

## Editing the content

- `src/subjects.json`: subject order.
- `src/subjects/<subject>/subject.json`: id, topic-id prefix, name, study design and course-map groups.
- `src/subjects/<subject>/topics/*.html`: one file per page, with a metadata comment at the top (`id`, `title`, `short`, `summary`, `keywords`, `dotpoints`, optional `special: overview|reference`). Links like `href="#id"` are prefixed with the subject automatically. Maths uses `\( … \)` and `\[ … \]` (KaTeX, with mhchem `\ce{}`).
- `src/app.js`, `src/styles.css`, `src/body.html`, `src/hub/`: the app shell (hub, router, search, quiz, review, theme).
- `src/motion.js`: spring animations and gestures. `src/ai.js`: the Claude features (chat sheet, notes pop-out, exam marking).
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
