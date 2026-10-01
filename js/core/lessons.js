// Lesson registry. Lesson files call NumSys.lessons.register({...}) at load time.
// Registration is pure data + functions; lesson files must not touch the DOM at load.
// Contract: docs/plan/PLAN.md § "Lesson / scene contract".
(function (NS) {
  'use strict';

  var ID_RE = /^[a-z0-9][a-z0-9-]*$/;

  function fail(where, msg) {
    throw new Error('Lesson ' + where + ': ' + msg);
  }

  // Throws a helpful Error if def is malformed; returns def otherwise.
  function validate(def) {
    if (!def || typeof def !== 'object') fail('(unknown)', 'definition must be an object');
    var where = '"' + (def.id || '?') + '"';
    if (typeof def.id !== 'string' || !ID_RE.test(def.id)) {
      fail(where, 'id must be lowercase letters, digits or dashes (got ' + JSON.stringify(def.id) + ')');
    }
    if (typeof def.title !== 'string' || !def.title.trim()) fail(where, 'needs a non-empty title');
    if (def.order !== undefined && typeof def.order !== 'number') fail(where, 'order must be a number');
    if (!Array.isArray(def.scenes) || def.scenes.length === 0) fail(where, 'needs at least one scene');

    var sceneIds = {};
    def.scenes.forEach(function (scene, si) {
      var sw = where + ' scene #' + si;
      if (!scene || typeof scene !== 'object') fail(sw, 'must be an object');
      if (typeof scene.id !== 'string' || !ID_RE.test(scene.id)) fail(sw, 'needs an id like "intro"');
      sw = where + ' scene "' + scene.id + '"';
      if (sceneIds[scene.id]) fail(sw, 'duplicate scene id');
      sceneIds[scene.id] = true;
      if (scene.setup !== undefined && typeof scene.setup !== 'function') fail(sw, 'setup must be a function');
      if (scene.teardown !== undefined && typeof scene.teardown !== 'function') fail(sw, 'teardown must be a function');
      if (!Array.isArray(scene.steps) || scene.steps.length === 0) fail(sw, 'needs at least one step');
      scene.steps.forEach(function (step, i) {
        var stw = sw + ' step ' + i;
        if (!step || typeof step !== 'object') fail(stw, 'must be an object');
        if (typeof step.say !== 'string' || !step.say.trim()) fail(stw, 'needs non-empty "say" narration text');
        if (step.do !== undefined && typeof step.do !== 'function') fail(stw, '"do" must be a function');
      });
    });
    return def;
  }

  // A registry holds lessons by id. The app uses one global registry (NS.lessons);
  // tests create isolated ones with createRegistry() so they never clobber real lessons.
  function createRegistry() {
    var registry = {};

    function register(def) {
      validate(def);
      if (registry[def.id]) fail('"' + def.id + '"', 'is already registered');
      if (def.order === undefined) def.order = 1000;
      registry[def.id] = def;
      return def;
    }

    // All lessons sorted by order (then id). Pass {includeHidden: true} for hidden ones.
    function list(opts) {
      var includeHidden = opts && opts.includeHidden;
      return Object.keys(registry)
        .map(function (id) { return registry[id]; })
        .filter(function (l) { return includeHidden || !l.hidden; })
        .sort(function (a, b) { return (a.order - b.order) || (a.id < b.id ? -1 : 1); });
    }

    function get(id) {
      return registry[id] || null;
    }

    return { register: register, list: list, get: get };
  }

  // Narration id for a step: <lessonId>.<sceneId>.<stepIndex> (used for recorded audio files).
  function stepId(lessonId, sceneId, stepIndex) {
    return lessonId + '.' + sceneId + '.' + stepIndex;
  }

  var appRegistry = createRegistry();

  NS.lessons = {
    register: appRegistry.register,
    list: appRegistry.list,
    get: appRegistry.get,
    validate: validate,
    stepId: stepId,
    createRegistry: createRegistry
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
