// Loads the Node-safe app scripts (tests/manifest.js) into a fresh vm context.
// Usage:
//   const { loadApp } = require('./load-app');
//   const { NumSys, context } = loadApp();               // app only
//   const { NumSys } = loadApp({ withSpecs: true });     // app + harness + spec files
// Also used by tools (e.g. narration export in Phase 10).
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function readManifest() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tests/manifest.js'), 'utf8'), sandbox, { filename: 'tests/manifest.js' });
  return sandbox.NUMSYS_TEST_MANIFEST;
}

function createContext() {
  // A minimal, DOM-less global. `window` is defined so files attach to window.NumSys
  // exactly as in the browser, but there is no `document`: any load-time DOM access fails loudly.
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    AbortController, AbortSignal, Event, EventTarget, URL, TextEncoder, TextDecoder,
    structuredClone
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function runFile(context, rel) {
  const file = path.join(ROOT, rel);
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

function loadApp(opts) {
  opts = opts || {};
  const manifest = readManifest();
  const context = createContext();
  manifest.app.forEach((rel) => runFile(context, rel));
  if (opts.withSpecs) {
    runFile(context, 'tests/harness.js');
    manifest.specs.forEach((rel) => runFile(context, rel));
  }
  return { NumSys: context.NumSys, context, manifest };
}

module.exports = { loadApp, readManifest, ROOT };
