// NumSys — the single global namespace for the app.
// Every JS file is an IIFE that receives NS and attaches one sub-namespace.
// Load order is defined by the <script> tags in index.html (and tests/manifest.js).
(function (NS) {
  'use strict';
  NS.version = '0.1.0';
  NS.debug = false;
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
