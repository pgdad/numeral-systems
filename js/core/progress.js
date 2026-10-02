// Lesson progress (Phase 11): which lessons the child has finished, for the ✓ on the home cards.
// Saved in localStorage as numsys.progress = {lessonId: 'YYYY-MM-DD'}; if storage is blocked it simply
// isn't remembered (U.storage never throws). The player marks a lesson done when its end card shows,
// and the playground marks 'playground' done when a quiz is finished.
//   NS.progress.isDone(id) · markDone(id) · doneIds() · reset() · onChange(fn) -> off()
//   NS.progress.create(store) makes an isolated copy for tests (store = {get(key, fallback), set(key, value)}).
(function (NS) {
  'use strict';

  var KEY = 'progress';

  function create(store) {
    var listeners = [];

    function read() {
      var v = store.get(KEY, {});
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    }

    function emit() {
      listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    }

    return {
      isDone: function (id) { return Object.prototype.hasOwnProperty.call(read(), id); },
      doneIds: function () { return Object.keys(read()); },
      markDone: function (id) {
        var all = read();
        if (all[id]) return;
        all[id] = new Date().toISOString().slice(0, 10);
        store.set(KEY, all);
        emit();
      },
      reset: function () { store.set(KEY, {}); emit(); },
      onChange: function (fn) {
        listeners.push(fn);
        return function off() { listeners = listeners.filter(function (l) { return l !== fn; }); };
      }
    };
  }

  var api = create(NS.util.storage);
  api.create = create;
  NS.progress = api;
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
