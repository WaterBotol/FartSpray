// Build script: bundles every subject into ONE self-contained HTML file.
//   node build.mjs                          -> ./index.html (works offline, host anywhere)
//   node build.mjs --artifact <out.html> [--artifact-url <url>] [--no-papers]  -> fragment for claude.ai Artifacts
//     (includes papers.json, the private copy's official-paper map, unless --no-papers)
// Sources: src/hub/*.html (global pages) and src/subjects/<id>/{subject.json,topics/*.html}.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = (...p) => join(here, 'src', ...p);
const katexDir = join(here, 'node_modules/katex/dist');
const KATEX_VERSION = JSON.parse(readFileSync(join(here, 'node_modules/katex/package.json'), 'utf8')).version;
const arg = name => { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; };

// ---------------------------------------------------------------- parsing + checks
function parseTopic(path, label) {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^\s*<!--([\s\S]*?)-->/);
  if (!m) throw new Error(`${label}: missing metadata comment`);
  const meta = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
    if (k) meta[k] = v;
  });
  const html = raw.slice(m[0].length).trim();
  if (!meta.id || !meta.title) throw new Error(`${label}: needs id and title`);
  const count = re => (html.match(re) || []).length;
  for (const tag of ['div', 'aside', 'figure', 'table', 'ol', 'ul', 'details', 'svg', 'dl', 'p', 'tbody', 'thead']) {
    const open = count(new RegExp(`<${tag}[\\s>]`, 'g')), close = count(new RegExp(`</${tag}>`, 'g'));
    if (open !== close) throw new Error(`${label}: <${tag}> open ${open} vs close ${close}`);
  }
  const a = count(/\\\(/g), b = count(/\\\)/g);
  if (a !== b) throw new Error(`${label}: inline math \\( ${a} vs \\) ${b}`);
  const c = count(/\\\[/g), d = count(/\\\]/g);
  if (c !== d) throw new Error(`${label}: display math \\[ ${c} vs \\] ${d}`);
  const re = /<div class="mcq"([^>]*)>([\s\S]*?)<div class="mcq-x">/g;
  let mm;
  while ((mm = re.exec(html))) {
    const ans = (mm[1].match(/data-ans="([A-E])"/) || [])[1];
    if (!ans) throw new Error(`${label}: an MCQ is missing data-ans`);
    const lis = (mm[2].match(/<li>/g) || []).length;
    if (lis < 2) throw new Error(`${label}: MCQ has ${lis} options`);
    if (ans.charCodeAt(0) - 65 >= lis) throw new Error(`${label}: MCQ answer ${ans} out of range (${lis} options)`);
  }
  return {
    id: meta.id, title: meta.title, short: meta.short || meta.title, summary: meta.summary || '',
    keywords: (meta.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
    dotpoints: (meta.dotpoints || '').split('|').map(s => s.trim()).filter(Boolean),
    special: meta.special || undefined, html,
    counts: {
      we: count(/class="we"/g), mcq: count(/class="mcq"/g), pq: count(/class="pq"/g),
      trick: count(/data-level="trick"/g) + count(/class="c-trap"/g), sims: count(/class="sim"/g)
    }
  };
}

const topics = [];
const ids = new Set();
const add = t => { if (ids.has(t.id)) throw new Error('duplicate id ' + t.id); ids.add(t.id); topics.push(t); };

// hub (global) pages
const hubIds = [];
readdirSync(src('hub')).filter(f => f.endsWith('.html')).sort().forEach(f => {
  const t = parseTopic(src('hub', f), 'hub/' + f); t.subject = null; add(t); hubIds.push(t.id);
});

// subjects
const order = JSON.parse(readFileSync(src('subjects.json'), 'utf8'));
const subjects = [];
for (const sid of order) {
  const dir = src('subjects', sid);
  if (!existsSync(join(dir, 'subject.json'))) { console.warn('⚠ skipping subject (no subject.json):', sid); continue; }
  const cfg = JSON.parse(readFileSync(join(dir, 'subject.json'), 'utf8'));
  const files = readdirSync(join(dir, 'topics')).filter(f => f.endsWith('.html')).sort();
  if (!files.length) { console.warn('⚠ skipping subject (no topics yet):', sid); continue; }
  const local = files.map(f => parseTopic(join(dir, 'topics', f), sid + '/' + f));
  const localIds = new Set(local.map(t => t.id));
  const P = cfg.prefix + '-';
  const rewrite = html => html.replace(/href="#([a-z0-9-]+)((?:~[a-z0-9-]*)?)"/g, (all, id, anc) => localIds.has(id) ? `href="#${P}${id}${anc}"` : all);
  local.forEach(t => { t.id = P + t.id; t.subject = sid; t.html = rewrite(t.html); add(t); });
  const missing = [];
  cfg.groups.forEach(g => {
    g.topics = g.topics.filter(id => { if (localIds.has(id)) return true; missing.push(id); return false; }).map(id => P + id);
  });
  if (missing.length) console.warn(`⚠ ${sid}: listed but not written yet:`, missing.join(', '));
  const listed = new Set(cfg.groups.flatMap(g => g.topics));
  local.forEach(t => { if (!listed.has(t.id)) console.warn(`⚠ ${sid}: topic not in any group:`, t.id); });
  cfg.groups = cfg.groups.filter(g => g.topics.length);
  subjects.push(cfg);
}

const artifactUrl = arg('--artifact-url') || '';
const data = { subjects, hub: hubIds, topics, built: new Date().toISOString().slice(0, 10), artifactUrl };
const dataJson = JSON.stringify(data).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

// ---------------------------------------------------------------- assets
let katexCss = readFileSync(join(katexDir, 'katex.min.css'), 'utf8');
katexCss = katexCss.replace(/src:\s*url\(fonts\/([^)]+?)\.woff2\)\s*format\("woff2"\)(?:,\s*url\([^)]+\)\s*format\("[^"]+"\))*/g, (all, name) =>
  `src:url(data:font/woff2;base64,${readFileSync(join(katexDir, 'fonts', name + '.woff2')).toString('base64')}) format("woff2")`);
if (/url\(fonts\//.test(katexCss)) throw new Error('KaTeX CSS still references external fonts');
const katexJs = readFileSync(join(katexDir, 'katex.min.js'), 'utf8');
const mhchemJs = readFileSync(join(katexDir, 'contrib/mhchem.min.js'), 'utf8');
const autoRenderJs = readFileSync(join(katexDir, 'contrib/auto-render.min.js'), 'utf8');
const styles = readFileSync(src('styles.css'), 'utf8');
const bodyHtml = readFileSync(src('body.html'), 'utf8');
const appJs = readFileSync(src('app.js'), 'utf8');
const motionJs = readFileSync(src('motion.js'), 'utf8');
const aiJs = readFileSync(src('ai.js'), 'utf8');
const papersJs = readFileSync(src('papers.js'), 'utf8');
const simsJs = readdirSync(src('sims')).filter(f => f.endsWith('.js')).sort().map(f => `/* ---- ${f} ---- */\n` + readFileSync(src('sims', f), 'utf8')).join('\n');
const safe = s => s.replace(/<\/script/gi, '<\\/script');

const TITLE = 'VCE 3/4 Field Guide';
const DESC = 'Free interactive study guide for VCE Units 3 & 4 Mathematical Methods, Physics, Chemistry, Biology and English Language: explanations, worked solutions, exam-style questions, simulations and search.';
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">';

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
<meta name="theme-color" content="#f2f2f7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
${FONTS}
<style>${katexCss}</style>
<style>${styles}</style>
</head>
<body>
${bodyHtml}
<noscript><p style="padding:24px">This guide needs JavaScript switched on.</p></noscript>
<script id="guide-data" type="application/json">${dataJson}</script>
<script>${safe(katexJs)}</script>
<script>${safe(mhchemJs)}</script>
<script>${safe(autoRenderJs)}</script>
<script>${safe(simsJs)}</script>
<script>${safe(appJs)}</script>
<script>${safe(papersJs)}</script>
<script>${safe(motionJs)}</script>
<script>${safe(aiJs)}</script>
</body>
</html>
`;
writeFileSync(join(here, 'index.html'), full);
const n = s => topics.filter(t => t.subject === s).length;
console.log(`✓ index.html ${(full.length / 1024).toFixed(0)} KB · ${subjects.map(s => s.short + ' ' + n(s.id)).join(' · ')} · KaTeX ${KATEX_VERSION}`);

const out = arg('--artifact');
if (out) {
  const cdn = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
  // the private artifact holds the official VCAA papers in its own storage: papers.json maps each paper to its
  // stored copy plus the crop box of every linked question (numbers only). The public index.html never gets it.
  const papersMap = existsSync(join(here, 'papers.json')) ? readFileSync(join(here, 'papers.json'), 'utf8') : '';
  const papersOk = !process.argv.includes('--no-papers') && papersMap && Object.keys(JSON.parse(papersMap).papers || {}).length > 0;   // --no-papers for a public copy
  const frag = `<title>${TITLE}</title>
${FONTS}
<style>${katexCss}</style>
<style>${styles}</style>
${bodyHtml}
<script id="guide-data" type="application/json">${dataJson}</script>
${papersOk ? '<script>window.VCAA_PAPERS = ' + safe(papersMap.trim()) + ';</script>' : ''}
<script src="${cdn}/katex.min.js"></script>
<script src="${cdn}/contrib/mhchem.min.js"></script>
<script src="${cdn}/contrib/auto-render.min.js"></script>
<script>${safe(simsJs)}</script>
<script>${safe(appJs)}</script>
<script>${safe(papersJs)}</script>
<script>${safe(motionJs)}</script>
<script>${safe(aiJs)}</script>
`;
  writeFileSync(out, frag);
  console.log(`✓ artifact fragment ${(frag.length / 1024).toFixed(0)} KB -> ${out}`);
}
