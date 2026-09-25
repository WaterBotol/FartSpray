// Build script: bundles the guide into ONE self-contained HTML file.
//   node build.mjs            -> writes ./index.html (works offline, host anywhere)
//   node build.mjs --artifact <out.html>  -> also writes a fragment for claude.ai Artifacts
// Topic sources live in src/topics/*.html with a leading metadata comment.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => join(here, 'src', ...p);
const KATEX_VERSION = JSON.parse(readFileSync(join(here, 'node_modules/katex/package.json'), 'utf8')).version;
const katexDir = join(here, 'node_modules/katex/dist');

// ---------------------------------------------------------------- topics
function parseTopic(file) {
  const raw = readFileSync(src('topics', file), 'utf8');
  const m = raw.match(/^\s*<!--([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: missing metadata comment`);
  const meta = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k) meta[k] = v;
  });
  const html = raw.slice(m[0].length).trim();
  if (!meta.id || !meta.title) throw new Error(`${file}: needs id and title`);
  // light structural checks so a broken tag never ships
  const count = (re) => (html.match(re) || []).length;
  for (const tag of ['div', 'aside', 'figure', 'table', 'ol', 'ul', 'details', 'svg', 'dl', 'p']) {
    const open = count(new RegExp(`<${tag}[\\s>]`, 'g'));
    const close = count(new RegExp(`</${tag}>`, 'g'));
    if (open !== close) throw new Error(`${file}: <${tag}> open ${open} vs close ${close}`);
  }
  const dm = count(/\\\(/g), dmc = count(/\\\)/g);
  if (dm !== dmc) throw new Error(`${file}: inline math \\( ${dm} vs \\) ${dmc}`);
  const dd = count(/\\\[/g), ddc = count(/\\\]/g);
  if (dd !== ddc) throw new Error(`${file}: display math \\[ ${dd} vs \\] ${ddc}`);
  $checkMcq(file, html);
  return {
    id: meta.id,
    title: meta.title,
    short: meta.short || meta.title,
    summary: meta.summary || '',
    keywords: (meta.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
    dotpoints: (meta.dotpoints || '').split('|').map(s => s.trim()).filter(Boolean),
    special: meta.special || undefined,
    html
  };
}
function $checkMcq(file, html) {
  const re = /<div class="mcq"([^>]*)>([\s\S]*?)<div class="mcq-x">/g;
  let mm;
  while ((mm = re.exec(html))) {
    const ans = (mm[1].match(/data-ans="([A-E])"/) || [])[1];
    if (!ans) throw new Error(`${file}: an MCQ is missing data-ans`);
    const lis = (mm[2].match(/<li>/g) || []).length;
    if (lis < 2) throw new Error(`${file}: MCQ has ${lis} options`);
    if (ans.charCodeAt(0) - 65 >= lis) throw new Error(`${file}: MCQ answer ${ans} out of range (${lis} options)`);
  }
}

const groups = JSON.parse(readFileSync(src('groups.json'), 'utf8'));
const files = readdirSync(src('topics')).filter(f => f.endsWith('.html')).sort();
const topics = files.map(parseTopic);
const ids = new Set();
topics.forEach(t => { if (ids.has(t.id)) throw new Error(`duplicate id ${t.id}`); ids.add(t.id); });
const missing = [];
groups.forEach(g => g.topics.forEach(id => { if (!ids.has(id)) missing.push(id); }));
if (missing.length) console.warn('⚠ topics listed in groups.json but not written yet:', missing.join(', '));
groups.forEach(g => { g.topics = g.topics.filter(id => ids.has(id)); });
topics.forEach(t => { if (!groups.some(g => g.topics.includes(t.id))) console.warn('⚠ topic not in any group:', t.id); });

const data = { groups, topics, built: new Date().toISOString().slice(0, 10) };
const dataJson = JSON.stringify(data).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

// ---------------------------------------------------------------- KaTeX (inline fonts as data URIs)
let katexCss = readFileSync(join(katexDir, 'katex.min.css'), 'utf8');
katexCss = katexCss.replace(/src:\s*url\(fonts\/([^)]+?)\.woff2\)\s*format\("woff2"\)(?:,\s*url\([^)]+\)\s*format\("[^"]+"\))*/g, (all, name) => {
  const b64 = readFileSync(join(katexDir, 'fonts', name + '.woff2')).toString('base64');
  return `src:url(data:font/woff2;base64,${b64}) format("woff2")`;
});
if (/url\(fonts\//.test(katexCss)) throw new Error('KaTeX CSS still references external fonts');
const katexJs = readFileSync(join(katexDir, 'katex.min.js'), 'utf8');
const autoRenderJs = readFileSync(join(katexDir, 'contrib/auto-render.min.js'), 'utf8');

const styles = readFileSync(src('styles.css'), 'utf8');
const bodyHtml = readFileSync(src('body.html'), 'utf8');
const appJs = readFileSync(src('app.js'), 'utf8');
const simsJs = readdirSync(src('sims')).filter(f => f.endsWith('.js')).sort().map(f => `/* ---- ${f} ---- */\n` + readFileSync(src('sims', f), 'utf8')).join('\n');
const safeScript = s => s.replace(/<\/script/gi, '<\\/script');

const TITLE = 'VCE Physics 3/4 Field Guide';
const DESC = 'Interactive study guide for VCE Physics Units 3 & 4 (2024–2027 study design): detailed explanations, step-by-step worked solutions, trick questions, simulations and a searchable formula sheet.';
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap">';

const full = `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0b7f78">
${FONTS}
<style>${katexCss}</style>
<style>${styles}</style>
</head>
<body>
${bodyHtml}
<noscript><p style="padding:24px">This guide needs JavaScript switched on.</p></noscript>
<script id="guide-data" type="application/json">${dataJson}</script>
<script>${safeScript(katexJs)}</script>
<script>${safeScript(autoRenderJs)}</script>
<script>${safeScript(simsJs)}</script>
<script>${safeScript(appJs)}</script>
</body>
</html>
`;
writeFileSync(join(here, 'index.html'), full);
console.log(`✓ index.html  ${(full.length / 1024).toFixed(0)} KB  · ${topics.length} topics · KaTeX ${KATEX_VERSION}`);

const ai = process.argv.indexOf('--artifact');
if (ai !== -1 && process.argv[ai + 1]) {
  const cdn = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
  const frag = `<title>${TITLE}</title>
${FONTS}
<style>${katexCss}</style>
<style>${styles}</style>
${bodyHtml}
<script id="guide-data" type="application/json">${dataJson}</script>
<script src="${cdn}/katex.min.js"></script>
<script src="${cdn}/contrib/auto-render.min.js"></script>
<script>${safeScript(simsJs)}</script>
<script>${safeScript(appJs)}</script>
`;
  writeFileSync(process.argv[ai + 1], frag);
  console.log(`✓ artifact fragment ${(frag.length / 1024).toFixed(0)} KB -> ${process.argv[ai + 1]}`);
}
