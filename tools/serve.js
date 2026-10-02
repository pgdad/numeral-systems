#!/usr/bin/env node
// A tiny static web server for trying the app (or a built dist/) over http, the way a CDN serves it:
// the MIME types, cache headers, security headers and Content-Security-Policy from deploy/headers.md.
// No dependencies. Dev/test tool only; the app itself never needs a server.
//
// Usage:
//   node tools/serve.js                         # serves the repo at http://localhost:8000/
//   node tools/serve.js --root dist --prefix /numbers/ --port 8080
//                                               # serves dist/ at http://localhost:8080/numbers/ (a CDN sub-path)
//   node tools/serve.js --no-csp                # without the Content-Security-Policy header
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// Keep in sync with deploy/headers.md (tests/deploy.test.js checks that they match).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; " +
  "media-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // The recorder page needs the microphone; nothing needs the camera or location. Screen capture (movie
  // "Record a video") is granted by the browser's own picker.
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(self)'
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm'
};

// Cache policy (deploy/headers.md): the page and version.txt are always re-checked; js/ and css/ are
// referenced with ?v=<commit> from dist/index.html, so they can be cached for a year; other assets for a day.
function cacheControl(relPath) {
  if (/^(js|css)\//.test(relPath)) return 'public, max-age=31536000, immutable';
  if (/^assets\//.test(relPath)) return 'public, max-age=86400';
  return 'no-cache';
}

function headersFor(relPath, opts) {
  const h = Object.assign({}, SECURITY_HEADERS, {
    'Content-Type': MIME[path.extname(relPath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': opts.cache === false ? 'no-store' : cacheControl(relPath)
  });
  if (opts.csp !== false) h['Content-Security-Policy'] = CSP;
  return h;
}

function createServer(opts) {
  const root = path.resolve(opts.root || '.');
  let prefix = opts.prefix || '/';
  if (!prefix.startsWith('/')) prefix = '/' + prefix;
  if (!prefix.endsWith('/')) prefix += '/';
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (opts.log) console.log(req.method, req.url);
    if (p === '/' && prefix !== '/') { res.writeHead(302, { Location: prefix }); return res.end(); }
    if (p + '/' === prefix) { res.writeHead(301, { Location: prefix }); return res.end(); }
    if (!p.startsWith(prefix)) return notFound(res);
    let rel = p.slice(prefix.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || rel.split('/').some((s) => s.startsWith('.'))) return notFound(res);
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return notFound(res);
      res.writeHead(200, Object.assign(headersFor(rel, opts), { 'Content-Length': st.size }));
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found\n');
}

function parseArgs(argv) {
  const o = { root: path.resolve(__dirname, '..'), port: 8000, prefix: '/', csp: true, log: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.root = path.resolve(argv[++i]);
    else if (a === '--port') o.port = Number(argv[++i]);
    else if (a === '--prefix') o.prefix = argv[++i];
    else if (a === '--no-csp') o.csp = false;
    else if (a === '--no-cache') o.cache = false;
    else if (a === '--log') o.log = true;
    else if (a === '-h' || a === '--help') {
      console.log('node tools/serve.js [--root DIR] [--port N] [--prefix /sub/path/] [--no-csp] [--no-cache] [--log]');
      process.exit(0);
    } else { console.error('serve: unknown option ' + a); process.exit(2); }
  }
  return o;
}

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  createServer(o).listen(o.port, '127.0.0.1', () => {
    const p = o.prefix.replace(/^\/?/, '/').replace(/\/?$/, '/');
    console.log(`Serving ${o.root} at http://localhost:${o.port}${p}${o.csp ? ' (with CSP)' : ''}. Ctrl+C stops.`);
  });
}

module.exports = { CSP, SECURITY_HEADERS, MIME, cacheControl, headersFor, createServer };
