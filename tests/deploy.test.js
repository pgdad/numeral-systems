// Node-only tests for the Phase 12 packaging and deploy tooling (tools/serve.js, deploy/*.sh).
// They start a local server and run shell scripts, so they live here rather than in tests/specs/.
// Run with: node --test tests/*.test.js
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');
const { loadApp } = require('./load-app');
const serve = require('../tools/serve');

const ROOT = path.resolve(__dirname, '..');
const { NumSys } = loadApp();

describe('release version', () => {
  it('NS.version is semver and the About page shows it', () => {
    assert.match(NumSys.version, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    assert.match(fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'), /'Version ' \+ NS\.version/);
  });
});

describe('headers (deploy/headers.md and tools/serve.js agree)', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'deploy', 'headers.md'), 'utf8');

  it('documents exactly the CSP and security headers the local server sends', () => {
    assert.ok(doc.includes('Content-Security-Policy: ' + serve.CSP), 'headers.md must contain serve.js CSP verbatim');
    Object.keys(serve.SECURITY_HEADERS).forEach((h) => assert.ok(doc.includes(h + ': ' + serve.SECURITY_HEADERS[h]), h));
  });

  it('the CSP allows what the app needs and nothing from elsewhere', () => {
    const d = Object.fromEntries(serve.CSP.split(';').map((s) => s.trim().split(/\s+/)).map((p) => [p[0], p.slice(1)]));
    assert.deepStrictEqual(d['script-src'], ["'self'"]);
    assert.deepStrictEqual(d['media-src'], ["'self'", 'blob:']);
    assert.deepStrictEqual(d['connect-src'], ["'none'"]);
    assert.ok(!/https?:|\*|unsafe-eval/.test(serve.CSP));
  });

  it('cache policy: page no-cache, versioned js/css a year, assets a day', () => {
    assert.strictEqual(serve.cacheControl('index.html'), 'no-cache');
    assert.strictEqual(serve.cacheControl('version.txt'), 'no-cache');
    assert.match(serve.cacheControl('js/app.js'), /max-age=31536000, immutable/);
    assert.match(serve.cacheControl('css/base.css'), /max-age=31536000/);
    assert.match(serve.cacheControl('assets/audio/binary.intro.0.mp3'), /max-age=86400/);
    assert.match(serve.headersFor('js/app.js', {})['Content-Type'], /^text\/javascript/);
    assert.strictEqual(serve.headersFor('a/b.mp3', {})['Content-Type'], 'audio/mpeg');
    assert.strictEqual(serve.headersFor('assets/svg/favicon.svg', {})['Content-Type'], 'image/svg+xml');
    assert.strictEqual(serve.headersFor('index.html', { csp: false })['Content-Security-Policy'], undefined);
  });
});

describe('tools/serve.js under a sub-path', () => {
  let server, base;
  before(() => new Promise((resolve) => {
    server = serve.createServer({ root: ROOT, prefix: '/numbers/' }).listen(0, '127.0.0.1', () => {
      base = 'http://127.0.0.1:' + server.address().port;
      resolve();
    });
  }));
  after(() => new Promise((resolve) => server.close(resolve)));

  function get(p) {
    return new Promise((resolve, reject) => {
      http.get(base + p, (res) => { res.resume(); res.on('end', () => resolve(res)); }).on('error', reject);
    });
  }

  it('serves the page at the folder URL with its headers, and files by relative path', async () => {
    const page = await get('/numbers/');
    assert.strictEqual(page.statusCode, 200);
    assert.match(page.headers['content-type'], /^text\/html/);
    assert.strictEqual(page.headers['content-security-policy'], serve.CSP);
    assert.strictEqual(page.headers['x-content-type-options'], 'nosniff');
    const js = await get('/numbers/js/app.js?v=abc123');
    assert.strictEqual(js.statusCode, 200);
    assert.match(js.headers['cache-control'], /immutable/);
  });

  it('redirects to the folder, and 404s outside it, for dotfiles and path tricks', async () => {
    assert.strictEqual((await get('/numbers')).headers.location, '/numbers/');
    assert.strictEqual((await get('/')).headers.location, '/numbers/');
    assert.strictEqual((await get('/js/app.js')).statusCode, 404);
    assert.strictEqual((await get('/numbers/nope.js')).statusCode, 404);
    assert.strictEqual((await get('/numbers/.git/config')).statusCode, 404);
    assert.strictEqual((await get('/numbers/%2e%2e/%2e%2e/etc/passwd')).statusCode, 404);
  });
});

describe('deploy scripts --dry-run (no CLI, no credentials)', () => {
  let dist;
  before(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'numsys-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(dist, 'version.txt'), 'version: 9.8.7\ncommit: abc1234\n');
  });
  after(() => fs.rmSync(dist, { recursive: true, force: true }));

  // A clean environment: no AWS_* or Akamai variables, and a PATH without aws/akamai/rsync on it.
  function run(script, args, env) {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'numsys-bin-'));
    ['bash', 'sed', 'grep', 'cut', 'dirname', 'printf'].forEach((t) => {
      const which = spawnSync('bash', ['-c', 'command -v ' + t], { encoding: 'utf8' }).stdout.trim();
      if (which && which.startsWith('/')) fs.symlinkSync(which, path.join(bin, t));
    });
    const res = spawnSync('bash', [path.join(ROOT, 'deploy', script)].concat(args), {
      encoding: 'utf8', env: Object.assign({ PATH: bin, HOME: dist, DIST: dist }, env)
    });
    fs.rmSync(bin, { recursive: true, force: true });
    return res;
  }

  it('s3-cloudfront.sh prints the sync, cache headers and invalidation it would run', () => {
    const r = run('s3-cloudfront.sh', ['--dry-run'], { BUCKET: 'my-bucket', DISTRIBUTION_ID: 'E2TEST', PREFIX: '/numbers/' });
    assert.strictEqual(r.status, 0, r.stderr);
    const out = r.stdout;
    assert.match(out, /9\.8\.7 \(abc1234\) to s3:\/\/my-bucket\/numbers\//);
    assert.match(out, /aws s3 sync .* s3:\/\/my-bucket\/numbers\/ --delete --exclude \\\* --include js\/\\\* --cache-control public\\,\\ max-age=31536000/);
    assert.match(out, /--include assets\/\\\* --cache-control public\\,\\ max-age=86400/);
    assert.match(out, /--exclude \\\*\/\\\* --exclude index\.html --cache-control no-cache/);
    assert.match(out, /aws s3 cp .*index\.html s3:\/\/my-bucket\/numbers\/index\.html --cache-control no-cache/);
    assert.match(out, /create-invalidation --distribution-id E2TEST --paths \/numbers\/index\.html \/numbers\/\n/);
    // index.html goes up last
    const lines = out.split('\n').filter((l) => l.startsWith('+ aws s3'));
    assert.match(lines[lines.length - 1], /index\.html/);
    const full = run('s3-cloudfront.sh', ['--dry-run', '--full'], { BUCKET: 'b', DISTRIBUTION_ID: 'E2TEST' });
    assert.match(full.stdout, /--paths \/\\\*/);
  });

  it('s3-cloudfront.sh refuses without BUCKET, and without the aws CLI unless --dry-run', () => {
    assert.notStrictEqual(run('s3-cloudfront.sh', ['--dry-run'], {}).status, 0);
    const r = run('s3-cloudfront.sh', [], { BUCKET: 'b' });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /aws CLI is not installed/);
  });

  it('akamai-netstorage.sh prints the rsync upload (page last) and the purge', () => {
    const r = run('akamai-netstorage.sh', ['--dry-run'], {
      NS_HOST: 'example.upload.akamai.com', NS_CPCODE: '123456', NS_PATH: 'numbers', SITE_URL: 'https://www.example.com/numbers'
    });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /rsync -rtz .*--exclude index\.html .* sshacs@example\.upload\.akamai\.com:\/123456\/numbers\/\n/);
    assert.match(r.stdout, /rsync -tz .*index\.html sshacs@example\.upload\.akamai\.com:\/123456\/numbers\/\n/);
    assert.match(r.stdout, /akamai purge invalidate https:\/\/www\.example\.com\/numbers\/ https:\/\/www\.example\.com\/numbers\/index\.html/);
    assert.notStrictEqual(run('akamai-netstorage.sh', ['--dry-run'], { NS_HOST: 'h' }).status, 0);
  });
});
