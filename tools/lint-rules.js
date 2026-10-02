#!/usr/bin/env node
// Static rule lint for the hard rules in CLAUDE.md. No dependencies.
// Usage: node tools/lint-rules.js [rootDir]
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const problems = [];

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function report(file, line, msg) { problems.push(`${file}${line ? ':' + line : ''}  ${msg}`); }

// skipBuilt: leave out .git, node_modules and build output (for the whole-repo secret scan).
function walk(dir, out, skipBuilt) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!(skipBuilt && /^(\.git|node_modules|dist|test-results|playwright-report)$/.test(entry.name))) walk(full, out, skipBuilt);
    }
    else out.push(full);
  }
  return out;
}

// Runtime files = what ships to users.
const runtimeFiles = [path.join(ROOT, 'index.html')]
  .concat(walk(path.join(ROOT, 'js'), []))
  .concat(walk(path.join(ROOT, 'css'), []))
  .concat(walk(path.join(ROOT, 'assets', 'svg'), []))
  .filter((f) => /\.(html|js|css|svg)$/.test(f) && fs.existsSync(f));

// XML namespace identifiers are not network requests.
const URL_ALLOW = [/^https?:\/\/www\.w3\.org\//];

const RULES = [
  { re: /type\s*=\s*["']module["']/i, msg: 'ES modules are not allowed (blocked on file://). Use classic scripts.' },
  { re: /\bfetch\s*\(/, msg: 'fetch() is not allowed (blocked on file://). Put data in a .js file.' },
  { re: /\bXMLHttpRequest\b/, msg: 'XMLHttpRequest is not allowed (blocked on file://).' },
  { re: /\b(?:src|href)\s*=\s*["']\/(?!\/)/i, msg: 'Absolute path found. Use a relative path (no leading "/").' },
  { re: /url\(\s*["']?\/(?!\/)/i, msg: 'Absolute url() in CSS. Use a relative path.' },
  { re: /\b(?:src|href)\s*=\s*["']\/\/|url\(\s*["']?\/\//i, msg: 'Protocol-relative URL (network dependency).' },
  { re: /\bimport\s+[\w{*][^;]*\bfrom\s+["']/, msg: 'ES import statement found. Use the NumSys namespace instead.' },
  { re: /\bimport\s*\(/, msg: 'Dynamic import() is not allowed (blocked on file://).' }
];

for (const file of runtimeFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    for (const rule of RULES) {
      if (rule.re.test(ln)) report(rel(file), i + 1, rule.msg);
    }
    for (const u of ln.match(/https?:\/\/[^\s"'<>)]+/gi) || []) {
      if (URL_ALLOW.some((re) => re.test(u))) continue;
      report(rel(file), i + 1, `External URL "${u}" (no network dependencies at runtime).`);
    }
  });
}

// index.html script tags: every one must exist, every js/ file must be referenced, no duplicates.
const indexPath = path.join(ROOT, 'index.html');
const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
if (!indexHtml) report('index.html', 0, 'missing');
// dist/index.html adds ?v=<commit> to every script and stylesheet (tools/build-dist.sh); compare paths without it.
const scriptSrcs = [...indexHtml.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"'?]+)(?:\?[^"']*)?["']/gi)].map((m) => m[1]);
const seen = new Set();
for (const src of scriptSrcs) {
  if (seen.has(src)) report('index.html', 0, `script "${src}" is included twice`);
  seen.add(src);
  if (!fs.existsSync(path.join(ROOT, src))) report('index.html', 0, `script "${src}" does not exist`);
}
const linkHrefs = [...indexHtml.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"'#?]+)(?:\?[^"']*)?["']/gi)].map((m) => m[1]);
for (const href of linkHrefs) {
  if (!fs.existsSync(path.join(ROOT, href))) report('index.html', 0, `linked file "${href}" does not exist`);
}
for (const file of walk(path.join(ROOT, 'js'), []).filter((f) => f.endsWith('.js'))) {
  if (!seen.has(rel(file))) report(rel(file), 0, 'not loaded by index.html (add a <script> tag in the right place)');
}
if (scriptSrcs.length && scriptSrcs[scriptSrcs.length - 1] !== 'js/app.js') {
  report('index.html', 0, 'js/app.js must be the last script');
}
if (scriptSrcs.length && scriptSrcs[0] !== 'js/core/namespace.js') {
  report('index.html', 0, 'js/core/namespace.js must be the first script');
}

// tests/manifest.js: app files must exist and follow index.html order; specs must exist.
const manifestPath = path.join(ROOT, 'tests', 'manifest.js');
if (fs.existsSync(manifestPath)) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  require('vm').runInNewContext(fs.readFileSync(manifestPath, 'utf8'), sandbox);
  const m = sandbox.NUMSYS_TEST_MANIFEST || { app: [], specs: [] };
  let lastIndex = -1;
  for (const f of m.app) {
    const idx = scriptSrcs.indexOf(f);
    if (idx === -1) report('tests/manifest.js', 0, `app file "${f}" is not in index.html`);
    else if (idx < lastIndex) report('tests/manifest.js', 0, `app file "${f}" is out of order compared with index.html`);
    else lastIndex = idx;
  }
  for (const f of m.specs) {
    if (!fs.existsSync(path.join(ROOT, f))) report('tests/manifest.js', 0, `spec "${f}" does not exist`);
  }
  for (const f of walk(path.join(ROOT, 'tests', 'specs'), []).filter((x) => x.endsWith('.spec.js'))) {
    if (m.specs.indexOf(rel(f)) === -1) report(rel(f), 0, 'spec file is not listed in tests/manifest.js');
  }
}

// Recorded narration (Phase 10): every audio-manifest entry must be a relative path to a file that exists in assets/audio/.
const audioManifestPath = path.join(ROOT, 'js', 'engine', 'audio-manifest.js');
let audioCount = 0;
if (fs.existsSync(audioManifestPath)) {
  const sandbox = {};
  sandbox.window = sandbox;
  try {
    require('vm').runInNewContext(fs.readFileSync(audioManifestPath, 'utf8'), sandbox);
  } catch (e) {
    report('js/engine/audio-manifest.js', 0, 'does not run: ' + e.message);
  }
  const manifest = (sandbox.NumSys && sandbox.NumSys.audioManifest) || {};
  for (const id of Object.keys(manifest)) {
    const entry = manifest[id];
    const src = typeof entry === 'string' ? entry : entry && entry.src;
    audioCount++;
    if (typeof src !== 'string' || !/^assets\/audio\/[^/\\]+$/.test(src)) {
      report('js/engine/audio-manifest.js', 0, `"${id}": src must be a relative path like assets/audio/<id>.mp3 (got ${JSON.stringify(src)})`);
    } else if (!fs.existsSync(path.join(ROOT, src))) {
      report('js/engine/audio-manifest.js', 0, `"${id}": file "${src}" does not exist (run node tools/build-audio-manifest.js)`);
    }
  }
}

// The narration script (docs/narration.md, tools/narration.json) must match the lesson text.
const exportTool = path.join(ROOT, 'tools', 'narration-export.js');
if (fs.existsSync(exportTool)) {
  const res = require('child_process').spawnSync(process.execPath, [exportTool, '--check'], { encoding: 'utf8' });
  if (res.status !== 0) report('docs/narration.md', 0, (res.stderr || res.stdout || 'narration export failed').trim());
}

// No secrets anywhere in the repo (Phase 12): deploy scripts read credentials from the environment or the
// standard CLI profiles (~/.aws, ~/.edgerc), never from files in here.
const SECRET_RULES = [
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, msg: 'looks like an AWS access key id' },
  { re: /aws_secret_access_key\s*[=:]\s*["']?[A-Za-z0-9/+]{40}/i, msg: 'looks like an AWS secret key' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, msg: 'private key' },
  { re: /\b(?:client_secret|access_token|client_token)\s*=\s*[A-Za-z0-9+/=_-]{20,}/, msg: 'looks like an Akamai .edgerc credential' }
];
let secretFiles = 0;
for (const file of walk(ROOT, [], true)) {
  if (!/\.(js|json|sh|md|html|css|txt|ya?ml|env|cfg|ini|edgerc)$|(^|[\/])\.[a-z]+rc$/i.test(file)) continue;
  secretFiles++;
  fs.readFileSync(file, 'utf8').split('\n').forEach((ln, i) => {
    for (const rule of SECRET_RULES) if (rule.re.test(ln)) report(rel(file), i + 1, 'Possible secret: ' + rule.msg + '. Never commit credentials.');
  });
}

if (problems.length) {
  console.error(`lint-rules: ${problems.length} problem(s):`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`lint-rules: OK (${runtimeFiles.length} runtime files, ${scriptSrcs.length} scripts, ${audioCount} recorded lines, ` +
  `${secretFiles} files scanned for secrets)`);
