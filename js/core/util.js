// Small helpers shared by everything: DOM/SVG builders, math helpers, abortable sleep.
// Safe to load in Node: nothing here touches the DOM until a function is called.
(function (NS) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Apply attrs to an element. Special keys: class, style (object or string),
  // text, html, dataset (object), on<Event> (function) -> addEventListener.
  function applyAttrs(node, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (key) {
      var val = attrs[key];
      if (val === undefined || val === null || val === false) return;
      if (key === 'class' || key === 'className') {
        node.setAttribute('class', Array.isArray(val) ? val.filter(Boolean).join(' ') : val);
      } else if (key === 'style' && typeof val === 'object') {
        Object.keys(val).forEach(function (p) {
          if (p.indexOf('--') === 0) node.style.setProperty(p, val[p]);
          else node.style[p] = val[p];
        });
      } else if (key === 'text') {
        node.textContent = val;
      } else if (key === 'html') {
        node.innerHTML = val;
      } else if (key === 'dataset') {
        Object.keys(val).forEach(function (d) { node.dataset[d] = val[d]; });
      } else if (/^on[A-Z]/.test(key) && typeof val === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (val === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(val));
      }
    });
  }

  function appendChildren(node, children) {
    children.forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) { appendChildren(node, child); return; }
      if (typeof child === 'string' || typeof child === 'number') {
        node.appendChild(document.createTextNode(String(child)));
      } else {
        node.appendChild(child);
      }
    });
  }

  // el('button', {class: 'btn', onClick: fn}, 'Hi')
  function el(tag, attrs) {
    var node = document.createElement(tag);
    applyAttrs(node, attrs);
    appendChildren(node, Array.prototype.slice.call(arguments, 2));
    return node;
  }

  // svg('circle', {cx: 5, cy: 5, r: 4})
  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    applyAttrs(node, attrs);
    appendChildren(node, Array.prototype.slice.call(arguments, 2));
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  // range(3) -> [0,1,2]; range(2,5) -> [2,3,4]; range(0,10,5) -> [0,5]
  function range(start, end, step) {
    if (end === undefined) { end = start; start = 0; }
    step = step || 1;
    var out = [];
    if (step > 0) { for (var i = start; i < end; i += step) out.push(i); }
    else { for (var j = start; j > end; j += step) out.push(j); }
    return out;
  }

  function abortError() {
    var err = new Error('Aborted');
    err.name = 'AbortError';
    return err;
  }

  // Resolves after ms; rejects with AbortError if signal aborts first.
  function sleep(ms, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) { reject(abortError()); return; }
      var timer = setTimeout(function () {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }, Math.max(0, ms || 0));
      function onAbort() {
        clearTimeout(timer);
        reject(abortError());
      }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function isAbortError(err) {
    return !!err && err.name === 'AbortError';
  }

  function prefersReducedMotion() {
    try {
      return typeof window !== 'undefined' && !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      return false;
    }
  }

  // localStorage that never throws (private windows, blocked storage, file:// quirks).
  var storage = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem('numsys.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem('numsys.' + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };

  NS.util = {
    SVG_NS: SVG_NS,
    el: el,
    svg: svg,
    clear: clear,
    clamp: clamp,
    range: range,
    sleep: sleep,
    abortError: abortError,
    isAbortError: isAbortError,
    prefersReducedMotion: prefersReducedMotion,
    storage: storage
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
