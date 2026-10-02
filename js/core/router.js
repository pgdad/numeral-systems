// Hash router (DECISIONS D1: hash routing only, no server rewrites).
// Routes:
//   #/                          home
//   #/lesson/:id                lesson from the start
//   #/lesson/:id/:scene/:step   deep link (0-based scene and step indexes)
//   #/playground                playground
//   #/playground/:tab           playground on a tab (converter | make | quiz)
//   #/about                     about page
//   #/gallery                   component gallery (hidden from the menu, for building lessons and QA)
// Anything else redirects home. parse() is pure so it can be unit-tested in Node.
(function (NS) {
  'use strict';

  var ROUTES = [
    { name: 'home', pattern: [] },
    { name: 'lesson', pattern: ['lesson', ':id'] },
    { name: 'lesson', pattern: ['lesson', ':id', '#scene', '#step'] },
    { name: 'playground', pattern: ['playground'] },
    { name: 'playground', pattern: ['playground', ':tab'] },
    { name: 'about', pattern: ['about'] },
    { name: 'gallery', pattern: ['gallery'] }
  ];

  function splitHash(hash) {
    var h = String(hash || '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
    var q = h.indexOf('?');
    if (q >= 0) h = h.slice(0, q);
    if (!h) return [];
    return h.split('/').map(function (part) {
      try { return decodeURIComponent(part); } catch (e) { return part; }
    });
  }

  function matchRoute(route, parts) {
    if (route.pattern.length !== parts.length) return null;
    var params = {};
    for (var i = 0; i < parts.length; i++) {
      var pat = route.pattern[i];
      var part = parts[i];
      if (pat.charAt(0) === ':') {
        if (!part) return null;
        params[pat.slice(1)] = part;
      } else if (pat.charAt(0) === '#') {
        if (!/^\d+$/.test(part)) return null;
        params[pat.slice(1)] = parseInt(part, 10);
      } else if (pat !== part) {
        return null;
      }
    }
    return params;
  }

  // parse('#/lesson/binary/1/2') -> {name:'lesson', params:{id:'binary', scene:1, step:2}, path:'/lesson/binary/1/2'}
  // Unknown routes -> {name:'home', params:{}, path:'/', redirected:true}
  function parse(hash) {
    var parts = splitHash(hash);
    for (var i = 0; i < ROUTES.length; i++) {
      var params = matchRoute(ROUTES[i], parts);
      if (params) {
        return { name: ROUTES[i].name, params: params, path: '/' + parts.join('/') };
      }
    }
    return { name: 'home', params: {}, path: '/', redirected: true };
  }

  // Build a hash from a route name + params: href('lesson', {id:'binary'}) -> '#/lesson/binary'
  function href(name, params) {
    params = params || {};
    switch (name) {
      case 'home': return '#/';
      case 'lesson': {
        var h = '#/lesson/' + encodeURIComponent(params.id);
        if (params.scene !== undefined && params.step !== undefined) h += '/' + params.scene + '/' + params.step;
        return h;
      }
      case 'playground': return '#/playground' + (params.tab ? '/' + encodeURIComponent(params.tab) : '');
      default: return '#/' + name;
    }
  }

  var listeners = [];
  var current = null;
  var started = false;

  function onChange(fn) {
    listeners.push(fn);
    return function off() { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  function emit() {
    var route = parse(window.location.hash);
    if (route.redirected && window.location.hash && window.location.hash !== '#/') {
      // Replace bad URL with home without adding a history entry.
      try { window.history.replaceState(null, '', '#/'); } catch (e) { /* file:// quirks */ }
    }
    var previous = current;
    current = route;
    listeners.forEach(function (fn) { fn(route, previous); });
  }

  function start() {
    if (started) return;
    started = true;
    window.addEventListener('hashchange', emit);
    emit();
  }

  function go(hash) {
    if (window.location.hash === hash) emit();
    else window.location.hash = hash;
  }

  // Update the URL without triggering a re-render (e.g. player step changes).
  function replace(hash) {
    try { window.history.replaceState(null, '', hash); } catch (e) { /* ignore */ }
    current = parse(hash);
  }

  NS.router = {
    parse: parse,
    href: href,
    onChange: onChange,
    start: start,
    go: go,
    replace: replace,
    current: function () { return current; }
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
