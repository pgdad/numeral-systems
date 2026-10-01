// Test manifest: the single list of what tests load, shared by Node (tests/load-app.js)
// and the browser runner (tests/browser.html). Paths are relative to the repo root.
//
// app:   Node-safe app scripts, in the same order as index.html. Files that touch the DOM
//        at load time (none should, except js/app.js which guards itself) must not be listed.
// specs: spec files using the describe/it/expect harness in tests/harness.js.
(function (root) {
  'use strict';
  root.NUMSYS_TEST_MANIFEST = {
    app: [
      'js/core/namespace.js',
      'js/core/strings.js',
      'js/core/util.js',
      'js/core/lessons.js',
      'js/core/router.js',
      'js/core/numeral.js',
      'js/core/digitsets.js',
      'js/core/addition.js',
      'js/app.js'
    ],
    specs: [
      'tests/specs/util.spec.js',
      'tests/specs/lessons.spec.js',
      'tests/specs/router.spec.js',
      'tests/specs/app.spec.js',
      'tests/specs/numeral.spec.js',
      'tests/specs/digitsets.spec.js',
      'tests/specs/addition.spec.js'
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
