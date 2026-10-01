// Tiny describe/it/expect harness shared by Node and the browser runner.
// Spec files call the globals describe(), it() and expect(). They are collected into
// NumSysTest.suites; tests/specs.test.js hands them to node:test, and tests/browser.html
// runs them itself.
(function (root) {
  'use strict';

  var suites = [];
  var currentSuite = null;

  function describe(name, fn) {
    var suite = { name: name, tests: [] };
    suites.push(suite);
    var prev = currentSuite;
    currentSuite = suite;
    try { fn(); } finally { currentSuite = prev; }
  }

  function it(name, fn) {
    if (!currentSuite) throw new Error('it("' + name + '") must be inside describe()');
    currentSuite.tests.push({ name: name, fn: fn });
  }

  function show(v) {
    if (typeof v === 'bigint') return v.toString() + 'n';
    try { return JSON.stringify(v, function (k, x) { return typeof x === 'bigint' ? x.toString() + 'n' : x; }); }
    catch (e) { return String(v); }
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'number' && isNaN(a) && isNaN(b)) return true;
    if (!a || !b || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  function AssertionError(msg) {
    var e = new Error(msg);
    e.name = 'AssertionError';
    return e;
  }

  function expect(actual) {
    function check(pass, msg) { if (!pass) throw AssertionError(msg); }
    var api = {
      toBe: function (exp) { check(actual === exp, 'Expected ' + show(actual) + ' to be ' + show(exp)); },
      toEqual: function (exp) { check(deepEqual(actual, exp), 'Expected ' + show(actual) + ' to equal ' + show(exp)); },
      toBeTruthy: function () { check(!!actual, 'Expected ' + show(actual) + ' to be truthy'); },
      toBeFalsy: function () { check(!actual, 'Expected ' + show(actual) + ' to be falsy'); },
      toContain: function (item) {
        check(actual != null && actual.indexOf(item) !== -1, 'Expected ' + show(actual) + ' to contain ' + show(item));
      },
      toMatch: function (re) { check(re.test(String(actual)), 'Expected ' + show(actual) + ' to match ' + re); },
      toThrow: function (pattern) {
        var threw = false, err;
        try { actual(); } catch (e) { threw = true; err = e; }
        check(threw, 'Expected function to throw');
        if (pattern) {
          var msg = err && err.message ? err.message : String(err);
          check(pattern instanceof RegExp ? pattern.test(msg) : msg.indexOf(pattern) !== -1,
            'Expected error "' + msg + '" to match ' + pattern);
        }
      },
      toRejectWith: function (name) {
        return Promise.resolve(actual).then(
          function () { throw AssertionError('Expected promise to reject with ' + name); },
          function (e) { check(e && e.name === name, 'Expected rejection ' + name + ' but got ' + (e && e.name)); });
      }
    };
    return api;
  }

  root.describe = describe;
  root.it = it;
  root.expect = expect;
  root.NumSysTest = { suites: suites, deepEqual: deepEqual };
})(typeof window !== 'undefined' ? window : globalThis);
