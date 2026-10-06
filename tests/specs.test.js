// Runs every spec file listed in tests/manifest.js under node:test.
// Run with: node --test tests/*.test.js
'use strict';

const { describe, it } = require('node:test');
const { loadApp } = require('./load-app');

const { context } = loadApp({ withSpecs: true });

context.NumSysTest.suites.forEach((suite) => {
  describe(suite.name, () => {
    suite.tests.forEach((t) => {
      it(t.name, () => t.fn());
    });
  });
});
