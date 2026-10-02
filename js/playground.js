// Playground (#/playground[/converter|make|quiz]): free play once the lessons are done (Phase 09, CONTENT.md § Lesson 6).
// Three tabs: Converter (one number in every system at once), Make Your Own System, and Quiz.
//
//   NS.playground.mount(stage, {tab}) -> {destroy()}   (DECISIONS D11)
//
// The pure logic comes first (custom systems, converter, quiz generator) and is unit-tested in Node.
// Nothing touches the DOM until mount() is called. Custom systems are digit sets of kind 'mixed' (or plain
// icon/color/text when every digit is that kind), registered with NS.digitsets so every component can draw them
// (DECISIONS D20). Saving uses NS.util.storage, which never throws, so everything works with storage blocked.
(function (NS) {
  'use strict';

  var D = NS.digitsets, N = NS.numeral;

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function words(n) { return D.numberToWords(n); }
  function pickInt(rand, min, max) { return min + Math.floor(rand() * (max - min + 1)); }
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ======================================================================================
  // Custom number systems
  // ======================================================================================

  // A system *spec* is what the child chose (and what is saved/exported):
  //   {name: 'Robot-Banana-Rocket', base: 3, digits: [{icon: 'robot'}, {icon: 'banana'}, {icon: 'rocket'}]}
  // Each digit is {icon}, {color, shape} (a color name from COLORS) or {char} (one typed character); null = not chosen yet.
  var MIN_BASE = 2, MAX_BASE = 16, MAX_NAME = 24;
  var ICONS = ['cat', 'dog', 'frog', 'pig', 'duck', 'cow', 'owl', 'fish', 'bee', 'snail', 'unicorn', 'robot',
    'star', 'heart', 'banana', 'rocket'];
  var COLORS = [
    { name: 'red', color: '#e53935' }, { name: 'orange', color: '#f57c00' }, { name: 'yellow', color: '#fbc02d' },
    { name: 'green', color: '#43a047' }, { name: 'blue', color: '#1e88e5' }, { name: 'purple', color: '#8e24aa' },
    { name: 'pink', color: '#ec407a' }, { name: 'black', color: '#2b2d42' }
  ];
  var SHAPES = ['circle', 'triangle', 'square', 'diamond', 'star', 'hexagon'];
  var ANIMAL_SOUNDS = { cat: 'meow', dog: 'woof', frog: 'ribbit', pig: 'oink', duck: 'quack' };
  // Characters a typed digit can't be: they separate digit names when you type a number ("Robot-Rocket").
  var BAD_CHAR = /[\s,\-–_]/;

  function colorOf(name) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].name === name) return COLORS[i];
    return null;
  }
  function iconLabel(name) { return NS.icons && NS.icons.label ? NS.icons.label(name) : cap(name); }

  // What a digit spec is: 'icon' | 'color' | 'text' | null (nothing chosen, or not a digit at all).
  function specKind(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.icon !== undefined) return 'icon';
    if (d.color !== undefined || d.shape !== undefined) return 'color';
    if (d.char !== undefined) return 'text';
    return null;
  }

  // Two digits look the same when they have the same key.
  function lookKey(d) {
    var k = specKind(d);
    if (k === 'icon') return 'icon:' + d.icon;
    if (k === 'color') return 'color:' + d.color + ':' + d.shape;
    if (k === 'text') return 'char:' + String(d.char).toLowerCase();
    return null;
  }

  // Words for one digit spec: "the robot", "the red circle", "Q".
  function describeSpec(d) {
    var k = specKind(d);
    if (k === 'icon') return iconLabel(d.icon);
    if (k === 'color') return cap(d.color) + ' ' + d.shape;
    if (k === 'text') return '"' + d.char + '"';
    return '?';
  }

  function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
  }
  function systemId(name) { return 'my-' + (slug(name) || 'system'); }

  // Check a spec. Returns a list of friendly problems (empty = all good).
  function checkSpec(spec) {
    var errors = [];
    if (!spec || typeof spec !== 'object') return ['That is not a number system.'];
    var name = typeof spec.name === 'string' ? spec.name.trim() : '';
    if (!name) errors.push('Give your system a name!');
    else if (Array.from(name).length > MAX_NAME) errors.push('That name is a bit long. Try ' + MAX_NAME + ' letters or fewer.');
    var base = spec.base;
    if (!Number.isInteger(base) || base < MIN_BASE || base > MAX_BASE) {
      errors.push('Pick a base from ' + MIN_BASE + ' to ' + MAX_BASE + '.');
      return errors;
    }
    var digits = Array.isArray(spec.digits) ? spec.digits : [];
    var seen = {};
    for (var v = 0; v < base; v++) {
      var d = digits[v];
      var k = specKind(d);
      if (!k) { errors.push('Pick a symbol for the digit worth ' + v + '.'); continue; }
      if (k === 'icon' && ICONS.indexOf(d.icon) < 0) { errors.push('We don\'t have a picture called "' + d.icon + '".'); continue; }
      if (k === 'color' && (!colorOf(d.color) || SHAPES.indexOf(d.shape) < 0)) {
        errors.push('We don\'t have a ' + d.color + ' ' + d.shape + '. Pick a color and a shape.'); continue;
      }
      if (k === 'text') {
        var ch = typeof d.char === 'string' ? d.char : '';
        if (Array.from(ch).length !== 1) { errors.push('A typed digit is just one letter, number or sign (the digit worth ' + v + ').'); continue; }
        if (BAD_CHAR.test(ch)) { errors.push('A typed digit can\'t be a space, dash, comma or underscore (the digit worth ' + v + ').'); continue; }
      }
      var key = lookKey(d);
      if (seen[key] !== undefined) {
        errors.push('The digits worth ' + seen[key] + ' and ' + v + ' look the same (' + describeSpec(d) + '). Every digit needs its own look!');
      } else {
        seen[key] = v;
      }
    }
    return errors;
  }

  // Turn a spec into a digit set. -> {ok: true, set} | {ok: false, errors}
  function buildSystem(spec) {
    var errors = checkSpec(spec);
    if (errors.length) return { ok: false, errors: errors };
    var digits = spec.digits.slice(0, spec.base);
    var kinds = {};
    digits.forEach(function (d) { kinds[specKind(d)] = true; });
    var kindList = Object.keys(kinds);
    // A color used once is just "Red"; used with two shapes it's "Red circle" and "Red square".
    var colorUses = {};
    digits.forEach(function (d) { if (specKind(d) === 'color') colorUses[d.color] = (colorUses[d.color] || 0) + 1; });
    var set = {
      id: systemId(spec.name),
      name: spec.name.trim(),
      shortName: spec.name.trim(),
      base: spec.base,
      kind: kindList.length === 1 ? kindList[0] : 'mixed',
      theme: 'playground',
      custom: true,
      caseInsensitive: true,
      placeName: words(spec.base),
      spec: { name: spec.name.trim(), base: spec.base, digits: digits.map(cleanDigit) },
      digits: digits.map(function (d, value) {
        var k = specKind(d);
        if (k === 'icon') {
          var label = iconLabel(d.icon);
          var out = { value: value, label: label, speak: label, icon: d.icon };
          if (ANIMAL_SOUNDS[d.icon]) out.sound = ANIMAL_SOUNDS[d.icon];
          return out;
        }
        if (k === 'color') {
          var nm = colorUses[d.color] > 1 ? d.color + ' ' + d.shape : d.color;
          return { value: value, label: cap(nm), speak: nm, name: nm, color: colorOf(d.color).color, shape: d.shape };
        }
        return { value: value, label: d.char, speak: /^[0-9]$/.test(d.char) ? words(+d.char) : d.char };
      })
    };
    try { D.validate(set); } catch (e) { return { ok: false, errors: ['Something about those digits does not work: ' + e.message] }; }
    return { ok: true, set: set };
  }

  // Only the fields we save.
  function cleanDigit(d) {
    var k = specKind(d);
    if (k === 'icon') return { icon: d.icon };
    if (k === 'color') return { color: d.color, shape: d.shape };
    if (k === 'text') return { char: d.char };
    return null;
  }

  // Export as copy-paste text, and read it back.
  var EXPORT_TYPE = 'counting-is-fun/number-system';
  function exportText(spec) {
    return JSON.stringify({
      type: EXPORT_TYPE, version: 1, name: spec.name, base: spec.base,
      digits: spec.digits.slice(0, spec.base).map(cleanDigit)
    }, null, 1);
  }
  function importText(text) {
    var data;
    try { data = JSON.parse(String(text || '').trim()); }
    catch (e) { return { ok: false, error: 'That doesn\'t look like a saved number system. Copy the whole text, from { to }.' }; }
    if (Array.isArray(data)) data = data[0];
    if (!data || typeof data !== 'object' || !Array.isArray(data.digits)) {
      return { ok: false, error: 'That doesn\'t look like a saved number system. Copy the whole text, from { to }.' };
    }
    var spec = { name: typeof data.name === 'string' ? data.name : '', base: data.base, digits: data.digits.map(cleanDigit) };
    var built = buildSystem(spec);
    if (!built.ok) return { ok: false, error: built.errors[0] };
    return { ok: true, spec: built.set.spec, set: built.set };
  }

  // A fresh spec to start from: base 3, nothing chosen yet.
  function blankSpec(base) { return { name: '', base: base || 3, digits: [] }; }

  // Saved systems live under one storage key. `store` defaults to NS.util.storage (tests pass their own).
  var STORE_KEY = 'playground.systems';
  function loadSpecs(store) {
    store = store || NS.util.storage;
    var raw = store.get(STORE_KEY, []);
    if (!Array.isArray(raw)) return [];
    var ids = {};
    return raw.filter(function (spec) {
      var b = buildSystem(spec);
      if (!b.ok || ids[b.set.id]) return false;
      ids[b.set.id] = true;
      return true;
    }).map(function (spec) { return buildSystem(spec).set.spec; });
  }
  function saveSpecs(specs, store) {
    store = store || NS.util.storage;
    return store.set(STORE_KEY, specs);
  }
  // Add or replace (same name = same system) in a list of specs. Returns the new list.
  function upsert(specs, spec) {
    var id = systemId(spec.name);
    var out = specs.filter(function (s) { return systemId(s.name) !== id; });
    out.push(spec);
    return out;
  }

  // ======================================================================================
  // Converter
  // ======================================================================================

  var CONVERTER_SETS = ['decimal', 'binary', 'octal', 'hex', 'animals', 'colors'];
  var MAX_DIGITS = 40;     // longest number the converter accepts (in any system)
  var DRAW_LIMIT = 12;     // icon/color systems draw at most this many symbols ("too big to draw!")
  var FINGER_MAX = 1023;   // the finger view (D5)

  // Small BigInts become plain numbers again, so the components can draw them.
  function norm(v) { return typeof v === 'bigint' && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v; }
  function isZero(v) { return typeof v === 'bigint' ? v === 0n : v === 0; }

  function digitCount(n, set) { return N.toDigits(n, D.resolve(set).base).length; }

  // How a number is written in a system, as text you could type: "1101", "2A", "Frog-Pig", "Yellow-Red".
  function textOf(n, set) {
    var s = D.resolve(set);
    var f = N.format(n, s);
    return typeof f === 'string' ? f : f.map(function (d) { return d.label; }).join('-');
  }

  // Read what the child typed into one system's box. -> {ok, value} | {ok: false, error}
  function readInput(text, set) {
    var s = D.resolve(set);
    var t = String(text === undefined || text === null ? '' : text).trim();
    if (s.kind === 'text') t = t.replace(/[\s,_]+/g, ''); // "1,000" and "1111 1111" are fine
    if (s.id === 'hex') t = t.replace(/^0x/i, '').replace(/^#/, '');
    if (!t) return { ok: false, error: 'Type a number first!' };
    if (/^-/.test(t) && s.kind === 'text') return { ok: false, error: 'No minus numbers here. Start at zero and count up!' };
    if (s.kind === 'text' && /[.]/.test(t)) return { ok: false, error: 'Only whole numbers here. No dots!' };
    var r = N.parse(t, s);
    if (!r.ok) return r;
    if (digitCount(r.value, s) > MAX_DIGITS) return { ok: false, error: 'Wow, that is too big even for us! Try a shorter number.' };
    return { ok: true, value: norm(r.value) };
  }

  // Can we draw this number with symbols / on an odometer?
  function canDraw(n, set) { return digitCount(n, set) <= DRAW_LIMIT; }
  function onFingers(n) { return typeof n === 'number' && n <= FINGER_MAX; }

  // n + delta, never below zero, BigInt-safe.
  function stepValue(n, delta) {
    if (typeof n === 'bigint') return norm(n + BigInt(delta));
    var v = n + delta;
    if (v < 0) return 0;
    if (!Number.isSafeInteger(v)) return norm(BigInt(n) + BigInt(delta));
    return v;
  }

  // Every system's text for one number (what the converter shows after any change).
  function convertAll(n, sets) {
    return (sets || CONVERTER_SETS).map(function (id) {
      var s = D.resolve(id);
      return { id: s.id, text: textOf(n, s), drawable: canDraw(n, s) };
    });
  }

  // ======================================================================================
  // Quiz
  // ======================================================================================

  // Values stay within `max` and within `places` digits of the system (binary gets more places).
  var LEVELS = {
    easy: { id: 'easy', label: 'Easy', sets: ['binary', 'animals', 'colors'], max: 20, places: 2, binaryPlaces: 4,
      choices: 3, fingersMax: 31, addColumns: 1, addCarries: 'never' },
    medium: { id: 'medium', label: 'Medium', sets: ['binary', 'octal', 'animals', 'colors'], max: 100, places: 3, binaryPlaces: 6,
      choices: 3, fingersMax: 255, addColumns: 1, addCarries: 'sometimes' },
    hard: { id: 'hard', label: 'Hard', sets: ['binary', 'octal', 'hex', 'animals', 'colors'], max: 1000, places: 4, binaryPlaces: 10,
      choices: 4, fingersMax: 1023, addColumns: 2, addCarries: 'sometimes' }
  };
  var LEVEL_IDS = ['easy', 'medium', 'hard'];
  var QUIZ_LENGTH = 10;
  // The mix of a 10-question quiz (shuffled): converting both ways, fingers, what comes next, adding.
  var QUIZ_PLAN = ['to-ten', 'to-ten', 'from-ten', 'from-ten', 'fingers', 'fingers', 'next', 'next', 'add', 'add'];
  var NOT_ALONE = [4, 128]; // D5: never ask for the middle finger alone

  function level(id) { return LEVELS[id] || LEVELS.easy; }

  // The biggest number a question may use in a system at a level.
  function maxFor(set, lv) {
    var s = D.resolve(set);
    var places = s.base === 2 ? lv.binaryPlaces : lv.places;
    return Math.min(lv.max, Math.pow(s.base, places) - 1);
  }

  // "in binary", "in animal numbers", "in Robot-Banana-Rocket".
  var SYS_NAMES = { decimal: 'base ten', binary: 'binary', octal: 'octal', hex: 'hex', animals: 'animal numbers', colors: 'color numbers' };
  function sysName(set) { var s = D.resolve(set); return SYS_NAMES[s.id] || s.name; }

  // Spoken form: "one-one-zero-one", "Frog-Pig", "two A"; base ten in words.
  function sayNum(n, set) { return D.speak(n, set); }
  // Written form for captions and text: "1101", "Frog-Pig", "13".
  function showNum(n, set) { return textOf(n, set); }

  // The digits misread as a base-ten number: Dog-Duck (1, 4) -> 14. A good wrong answer.
  function misread(n, set) {
    var s = D.resolve(set);
    var ds = N.toDigits(n, s.base);
    if (ds.length < 2 || ds.some(function (d) { return d > 9; })) return null;
    var v = parseInt(ds.join(''), 10);
    return v === n ? null : v;
  }
  // a + b added column by column but forgetting to carry.
  function noCarrySum(a, b, base) {
    var out = 0, p = 1;
    while (a > 0 || b > 0) {
      out += ((a % base + b % base) % base) * p;
      a = Math.floor(a / base); b = Math.floor(b / base); p *= base;
    }
    return out;
  }

  function choices(answer, lv, rand, max, prefer) {
    var helpers = NS.lessons.get('silly').helpers;
    return helpers.makeChoices(answer, { min: 0, max: max, count: lv.choices, rand: rand, prefer: prefer || [] });
  }

  // One question. type: 'to-ten' | 'from-ten' | 'next' | 'add' | 'fingers'.
  //   -> {type, set, text, say, show: {kind, ...}, answer, choices, choiceSet}
  // `show` says what to draw: {kind: 'number', value} | {kind: 'sequence', values} | {kind: 'sum', a, b} | {kind: 'fingers'}.
  // Choices are numbers; the UI draws them in `choiceSet`. Fingers questions have no choices (tap the hands).
  function makeQuestion(type, set, levelId, rand) {
    rand = rand || Math.random;
    var lv = level(levelId);
    var hi, n;
    if (type === 'fingers') {
      do { n = pickInt(rand, 1, lv.fingersMax); } while (NOT_ALONE.indexOf(n) >= 0);
      return {
        type: type, set: 'binary', answer: n, choices: [], choiceSet: null, show: { kind: 'fingers' },
        text: 'Show ' + n + ' on your fingers in binary!', say: 'Show ' + words(n) + ' on your fingers!'
      };
    }
    var s = D.resolve(set);
    hi = maxFor(s, lv);
    if (type === 'to-ten') {
      n = pickInt(rand, Math.min(s.base, hi), hi);
      return {
        type: type, set: s.id, answer: n, choiceSet: 'decimal', show: { kind: 'number', value: n },
        choices: choices(n, lv, rand, Math.max(hi + 5, 10), [misread(n, s)]),
        text: 'What number is this?', say: 'What number is ' + sayNum(n, s) + '?'
      };
    }
    if (type === 'from-ten') {
      n = pickInt(rand, Math.min(s.base, hi), hi);
      return {
        type: type, set: s.id, answer: n, choiceSet: s.id, show: { kind: 'none' },
        choices: choices(n, lv, rand, hi + 2),
        text: 'Which one is ' + n + ' in ' + sysName(s) + '?', say: 'Which one is ' + words(n) + ' in ' + sysName(s) + '?'
      };
    }
    if (type === 'next') {
      n = pickInt(rand, 2, Math.max(2, hi - 1));
      var seq = [n - 2, n - 1, n];
      return {
        type: type, set: s.id, answer: n + 1, choiceSet: s.id, show: { kind: 'sequence', values: seq },
        choices: choices(n + 1, lv, rand, hi + 2, [n + 2]),
        text: 'What comes next?',
        say: seq.map(function (v) { return cap(sayNum(v, s)); }).join(', ') + '. What comes next?'
      };
    }
    if (type === 'add') {
      var carries = lv.addCarries === 'never' ? false : rand() < 0.5;
      var p = NS.lessons.get('addition').helpers.makeProblem(s.id, { columns: lv.addColumns, carries: carries }, rand);
      var sum = p.a + p.b;
      var wrong = noCarrySum(p.a, p.b, s.base);
      return {
        type: type, set: s.id, answer: sum, choiceSet: s.id, show: { kind: 'sum', a: p.a, b: p.b },
        choices: choices(sum, lv, rand, Math.max(sum + 4, Math.pow(s.base, lv.addColumns + 1) - 1), [wrong]),
        text: 'What do they make together?',
        say: 'What is ' + sayNum(p.a, s) + ' plus ' + sayNum(p.b, s) + '?'
      };
    }
    throw new Error('Unknown question type: ' + type);
  }

  // A whole quiz: QUIZ_LENGTH questions, every type, systems spread out. customSets: ids of the child's own systems.
  function makeQuiz(levelId, o) {
    o = o || {};
    var rand = o.rand || Math.random;
    var lv = level(levelId);
    var pool = lv.sets.concat(o.customSets || []);
    // Custom systems count double, so the child's own system shows up a few times.
    (o.customSets || []).forEach(function (id) { pool.push(id); });
    var types = shuffle(QUIZ_PLAN, rand);
    var sets = [];
    while (sets.length < types.length) sets = sets.concat(shuffle(pool, rand));
    var out = [];
    types.forEach(function (type, i) {
      var q;
      for (var tries = 0; tries < 8; tries++) {
        q = makeQuestion(type, sets[(i + tries) % sets.length], lv.id, rand);
        // No two questions in a row with the same picture.
        var prev = out[out.length - 1];
        if (!prev || prev.say !== q.say) break;
      }
      out.push(q);
    });
    return out;
  }

  // Is this the right answer? (fingers: the number the hands show)
  function isRight(q, value) { return value === q.answer; }

  // What to say after a miss, or when showing the answer. -> {text, say}
  function explain(q) {
    var s = q.set, a = q.answer;
    if (q.type === 'to-ten') {
      return { text: showNum(a, s) + ' is ' + a + '.', say: cap(sayNum(a, s)) + ' is ' + words(a) + '.' };
    }
    if (q.type === 'from-ten') {
      return { text: a + ' in ' + sysName(s) + ' is ' + showNum(a, s) + '.', say: cap(words(a)) + ' in ' + sysName(s) + ' is ' + sayNum(a, s) + '.' };
    }
    if (q.type === 'next') {
      var last = q.show.values[q.show.values.length - 1];
      return { text: 'After ' + showNum(last, s) + ' comes ' + showNum(a, s) + '.',
        say: 'After ' + sayNum(last, s) + ' comes ' + sayNum(a, s) + '.' };
    }
    if (q.type === 'add') {
      var x = q.show.a, y = q.show.b;
      var text = showNum(x, s) + ' + ' + showNum(y, s) + ' = ' + showNum(a, s);
      var check = x + ' + ' + y + ' = ' + a;
      if (text !== check) text += '  (' + check + ')';
      return { text: text + '.', say: cap(sayNum(x, s)) + ' plus ' + sayNum(y, s) + ' makes ' + sayNum(a, s) + '.' };
    }
    if (q.type === 'fingers') {
      var parts = NS.hands.fingerValues(10).filter(function (v) { return (a & v) !== 0; });
      return { text: a + ' = ' + parts.join(' + ') + '.', say: cap(words(a)) + ' is ' + parts.map(words).join(' plus ') + '.' };
    }
    return { text: '', say: '' };
  }

  // Best scores per level.
  function bestKey(levelId) { return 'playground.best.' + level(levelId).id; }
  function loadBest(levelId, store) { var v = (store || NS.util.storage).get(bestKey(levelId), 0); return typeof v === 'number' ? v : 0; }
  // Records a score; returns true when it beat the old best.
  function recordScore(levelId, stars, store) {
    store = store || NS.util.storage;
    var old = loadBest(levelId, store);
    if (stars > old) { store.set(bestKey(levelId), stars); return true; }
    return false;
  }

  // ======================================================================================
  // UI (the DOM is only touched from here on, inside mount)
  // ======================================================================================

  var TABS = [
    { id: 'converter', label: 'Converter', icon: 'swap' },
    { id: 'make', label: 'Make Your Own', icon: 'robot' },
    { id: 'quiz', label: 'Quiz', icon: 'star' }
  ];
  var PREVIEW_ID = 'draft-preview';
  var PRAISE = ['Yes!', 'You got it!', 'Great job!', 'Super!', 'Wow, well done!'];

  // Survives tab switches and leaving/returning to the playground during one visit.
  var session = { specs: null, tab: 'converter', value: 13, level: 'easy', draft: null, stored: null, best: {} };

  // Load the saved systems once and make sure each is registered as a digit set. Returns their ids.
  function ensureSystems() {
    if (!session.specs) session.specs = loadSpecs();
    var ids = [];
    session.specs.forEach(function (spec) {
      var b = buildSystem(spec);
      if (b.ok) { D.register(b.set); ids.push(b.set.id); }
    });
    return ids;
  }

  // Can this browser keep things? (A private window or blocked storage can't.)
  // Best score this visit or saved, whichever is higher (so it still shows when storage is blocked).
  function bestScore(levelId) { return Math.max(loadBest(levelId), session.best[levelId] || 0); }
  function noteScore(levelId, stars) {
    var beat = stars > bestScore(levelId);
    if (stars > (session.best[levelId] || 0)) session.best[levelId] = stars;
    recordScore(levelId, stars);
    return beat;
  }

  function storageWorks() {
    if (session.stored === null) {
      var probe = 'playground.probe';
      session.stored = NS.util.storage.set(probe, 1) && NS.util.storage.get(probe, 0) === 1;
    }
    return session.stored;
  }

  function mount(stage, opts) {
    var U = NS.util, A = NS.anim;
    opts = opts || {};
    var ac = new AbortController();
    var captions = typeof document !== 'undefined' ? document.getElementById('captions') : null;
    var speech = null, capTimer = null;
    NS.narrator.setCaptionElement(captions);

    function hide(el, on) { el.hidden = on !== false; return el; }
    function icon(name, size) { return NS.icons.render(name, { size: size || 28 }); }
    function btn(label, onClick, cls, attrs) {
      return U.el('button', Object.assign({ type: 'button', class: ['btn', cls], onClick: onClick }, attrs || {}), label);
    }
    // A fresh animation context (abortable) for one widget.
    function anim(signal) {
      var c = { instant: false, reducedMotion: U.prefersReducedMotion(), speed: 1, signal: signal };
      c.abortSignal = signal;
      c.sound = function (name) { return NS.sound.play(name); };
      c.wait = function (ms) { return A.wait(ms, c); };
      return c;
    }
    function quiet(p) { if (p && p.catch) p.catch(function (e) { if (!U.isAbortError(e)) console.error(e); }); }
    // Live narration with captions (D15). New speech replaces old; the caption bar hides a moment after.
    function say(id, text) {
      if (speech) speech.abort();
      NS.narrator.stop();
      if (!text || ac.signal.aborted) return;
      speech = new AbortController();
      var signal = speech.signal;
      clearTimeout(capTimer);
      NS.narrator.speak('playground.' + id, text, { signal: signal }).then(function () {
        capTimer = setTimeout(function () { if (!signal.aborted && captions) captions.hidden = true; }, 2500);
      }, function () {});
    }
    // A number drawn in a system: big text for text systems; symbols plus their names otherwise (D18).
    function numView(n, set, cls) {
      var s = D.resolve(set);
      if (s.kind === 'text') return U.el('span', { class: ['pg-num', 'pg-num-text', cls], text: textOf(n, s) });
      var strip = NS.symbols.strip(n, s, { class: 'pg-strip' });
      strip.setAttribute('aria-hidden', 'true');
      return U.el('span', { class: ['pg-num', 'pg-num-symbols', cls] }, strip,
        U.el('span', { class: 'pg-num-names', text: textOf(n, s) }));
    }

    // ---------- Shell: heading, tabs ----------
    var voiceBtn = btn('', function () {
      NS.narrator.setVoiceOn(!NS.narrator.isVoiceOn());
      drawVoice();
    }, 'btn-sm pg-voice');
    function drawVoice() {
      var on = NS.narrator.isVoiceOn();
      U.clear(voiceBtn);
      voiceBtn.appendChild(icon(on ? 'voice' : 'voiceOff', 22));
      voiceBtn.appendChild(document.createTextNode(on ? ' Voice on' : ' Voice off'));
      voiceBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    drawVoice();

    var tabButtons = {}, panels = {}, built = {};
    var tabList = U.el('div', { class: 'pg-tabs', role: 'tablist', 'aria-label': 'Playground' });
    TABS.forEach(function (t) {
      var b = U.el('button', {
        type: 'button', class: 'btn pg-tab', role: 'tab', id: 'pg-tab-' + t.id, 'aria-controls': 'pg-panel-' + t.id,
        dataset: { tab: t.id }, onClick: function () { show(t.id, true); }
      }, icon(t.icon, 28), U.el('span', { text: t.label }));
      tabButtons[t.id] = b;
      tabList.appendChild(b);
      panels[t.id] = hide(U.el('div', { class: 'pg-panel', role: 'tabpanel', id: 'pg-panel-' + t.id, 'aria-labelledby': 'pg-tab-' + t.id }));
    });
    // Arrow keys move between tabs (the usual tab pattern).
    tabList.addEventListener('keydown', function (e) {
      var i = TABS.map(function (t) { return t.id; }).indexOf(current);
      var next = null;
      if (e.key === 'ArrowRight') next = TABS[(i + 1) % TABS.length].id;
      else if (e.key === 'ArrowLeft') next = TABS[(i + TABS.length - 1) % TABS.length].id;
      else if (e.key === 'Home') next = TABS[0].id;
      else if (e.key === 'End') next = TABS[TABS.length - 1].id;
      if (!next) return;
      e.preventDefault();
      show(next, true);
      tabButtons[next].focus();
    });

    var root = U.el('section', { class: 'playground theme-playground' },
      U.el('div', { class: 'pg-head' },
        U.el('h1', { class: 'view-heading', tabindex: '-1' }, icon('star', 48), ' Playground'),
        U.el('p', { class: 'lead pg-lead', text: 'Change a number in any system, invent your own system, or take the quiz.' }),
        U.el('div', { class: 'pg-head-actions' },
          U.el('a', { class: 'btn btn-sm', href: '#/lesson/playground' }, icon('play', 22), ' Hear the intro'),
          voiceBtn)),
      tabList,
      TABS.map(function (t) { return panels[t.id]; }));
    stage.appendChild(root);

    var current = null;
    function show(id, byUser) {
      if (!panels[id]) id = 'converter';
      if (current === id && built[id]) return;
      if (current && leave[current]) leave[current]();
      current = id;
      session.tab = id;
      TABS.forEach(function (t) {
        var on = t.id === id;
        tabButtons[t.id].setAttribute('aria-selected', on ? 'true' : 'false');
        tabButtons[t.id].setAttribute('tabindex', on ? '0' : '-1');
        tabButtons[t.id].classList.toggle('is-current', on);
        hide(panels[t.id], !on);
      });
      if (!built[id] || id === 'converter') { U.clear(panels[id]); built[id] = builders[id](panels[id]); }
      else if (built[id].enter) built[id].enter();
      if (byUser) NS.router.replace(NS.router.href('playground', { tab: id }));
    }
    var leave = {
      make: function () { if (built.make && built.make.leave) built.make.leave(); },
      converter: function () { if (built.converter && built.converter.leave) built.converter.leave(); }
    };

    // ---------- Converter ----------
    function buildConverter(panel) {
      var customIds = ensureSystems();
      var ids = CONVERTER_SETS.concat(customIds);
      var value = session.value;
      var rows = [];
      var local = new AbortController();
      ac.signal.addEventListener('abort', function () { local.abort(); });

      var minus = btn('', function () { bump(-1); }, 'pg-bump', { 'aria-label': 'Minus one' });
      minus.appendChild(U.el('span', { class: 'pg-bump-text', text: '−1' }));
      var plus = btn('', function () { bump(1); }, 'pg-bump', { 'aria-label': 'Plus one' });
      plus.appendChild(U.el('span', { class: 'pg-bump-text', text: '+1' }));
      var status = U.el('p', { class: 'pg-status', 'aria-live': 'polite' });

      var grid = U.el('div', { class: 'pg-rows' });
      ids.forEach(function (id) {
        var set = D.resolve(id);
        var inputId = 'pg-in-' + set.id;
        var input = U.el('input', {
          type: 'text', id: inputId, class: 'pg-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
          inputmode: set.id === 'decimal' ? 'numeric' : 'text', 'aria-describedby': inputId + '-err'
        });
        var err = hide(U.el('p', { class: 'pg-error', id: inputId + '-err' }));
        var visual = U.el('div', { class: 'pg-visual' });
        var row = {
          set: set, input: input, err: err, visual: visual, odo: null, places: 0, ctrl: null, bad: false,
          el: U.el('div', { class: ['pg-row', 'theme-' + set.theme, 'pg-kind-' + set.kind], dataset: { set: set.id } },
            U.el('label', { class: 'pg-row-name', for: inputId, text: set.name }), input, visual, err)
        };
        input.addEventListener('input', function () { typed(row); });
        input.addEventListener('blur', function () { if (!row.bad) input.value = textOf(value, set); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1); }
          else if (e.key === 'Enter') { e.preventDefault(); if (!row.bad) input.value = textOf(value, set); }
        });
        rows.push(row);
        grid.appendChild(row.el);
      });

      // The finger view: binary on two hands (D5), clickable.
      var hands = NS.hands.create({ hands: 'both', labels: true });
      var handsNote = U.el('p', { class: 'pg-hands-note' });
      var handsBox = U.el('div', { class: 'pg-hands theme-binary' },
        U.el('h2', { class: 'pg-hands-title', text: 'On your fingers' }), hands.el, handsNote);
      var handCtrl = null;
      hands.onToggle(function (info) { setValue(info.bits, 'fingers'); });

      var actions = U.el('div', { class: 'pg-conv-actions' },
        minus, plus,
        btn([icon('dice', 24), ' Surprise me!'], function () {
          setValue(Math.floor(Math.random() * 1023) + 1, null, 'set');
          NS.sound.play('whoosh');
        }, 'btn-sm'),
        btn([icon('voice', 24), ' Say it'], function () { say('converter', sentence(value)); }, 'btn-sm'),
        btn('Zero', function () { setValue(0, null, 'set'); }, 'btn-sm'));

      panel.appendChild(U.el('div', { class: 'pg-converter' },
        U.el('p', { class: 'pg-tip', text: 'Type in any box, and all the others change too. Or tap the fingers!' }),
        actions, status, grid, handsBox,
        customIds.length ? null : U.el('p', { class: 'pg-tip pg-small' }, 'Make your own number system in ',
          U.el('a', { href: '#/playground/make', text: 'Make Your Own' }), ', and it shows up here too.')));

      function sentence(n) {
        return cap(words(n)) + '. ' + rows.filter(function (r) { return r.set.id !== 'decimal'; }).map(function (r) {
          return 'In ' + sysName(r.set) + ', ' + D.speak(n, r.set) + '.';
        }).join(' ');
      }

      function typed(row) {
        var r = readInput(row.input.value, row.set);
        if (!r.ok) {
          row.bad = true;
          row.input.setAttribute('aria-invalid', 'true');
          row.err.textContent = r.error;
          hide(row.err, false);
          return;
        }
        setValue(r.value, row, 'set');
      }

      function bump(dir) {
        if (dir < 0 && isZero(value)) { NS.sound.play('click'); return; }
        NS.sound.play('pop');
        setValue(stepValue(value, dir), null, 'step', dir);
      }

      // The number changed. source: the row that was typed in (keep its text), 'fingers', or null.
      function setValue(n, source, how, dir) {
        value = n;
        session.value = n;
        rows.forEach(function (row) {
          row.bad = false;
          row.input.removeAttribute('aria-invalid');
          hide(row.err);
          if (row !== source) row.input.value = textOf(n, row.set);
          draw(row, n, how, dir);
        });
        if (source !== 'fingers') drawHands(n);
        else handsNote.textContent = handsText(n);
        minus.disabled = isZero(n);
        status.textContent = typeof n === 'number' && n <= 9999 ? cap(words(n)) + '.' : '';
      }

      function handsText(n) {
        return onFingers(n) ? 'Fingers up are ones, fingers down are zeros: ' + textOf(n, 'binary') + '.'
          : 'Too big for ten fingers! They count up to 1023.';
      }
      function drawHands(n) {
        if (handCtrl) handCtrl.abort();
        handCtrl = new AbortController();
        handsBox.classList.toggle('is-too-big', !onFingers(n));
        handsNote.textContent = handsText(n);
        quiet(hands.setBits(onFingers(n) ? n : 0, anim(handCtrl.signal)));
      }

      // The odometer for a row: one spare place in front (dimmed), so a carry has somewhere to go.
      function makeOdo(row, n, places) {
        if (row.odo) row.odo.destroy();
        U.clear(row.visual);
        row.places = places;
        row.odo = NS.odometer.create({
          set: row.set, places: places, value: n, labels: false, dimLeading: true, carryHop: true,
          digitNames: row.set.kind !== 'text', size: 'sm'
        });
        row.visual.appendChild(row.odo.el);
      }
      function draw(row, n, how, dir) {
        if (row.ctrl) row.ctrl.abort();
        if (!canDraw(n, row.set)) {
          if (row.odo) { row.odo.destroy(); row.odo = null; }
          U.clear(row.visual);
          row.visual.appendChild(U.el('span', { class: 'pg-too-big', text: row.set.kind === 'text' ? 'Too long for the counter!' : 'Too big to draw!' }));
          return;
        }
        var want = digitCount(n, row.set) + 1;
        if (!row.odo || how === 'instant' || digitCount(n, row.set) > row.places) { makeOdo(row, n, want); return; }
        var ctrl = row.ctrl = new AbortController();
        local.signal.addEventListener('abort', function () { ctrl.abort(); });
        var c = anim(ctrl.signal);
        if (row.set.id !== 'animals' && row.set.id !== 'colors' && !row.set.custom) c.sound = function () { return 0; };
        var run = how === 'step' ? row.odo.step(dir, c) : row.odo.set(n, c);
        run.then(function () {
          if (!ctrl.signal.aborted && row.places !== want) makeOdo(row, n, want);
        }, function () {});
      }

      setValue(value, null, 'instant');
      return {
        leave: function () { local.abort(); if (handCtrl) handCtrl.abort(); }
      };
    }

    // ---------- Make your own ----------
    function buildMake(panel) {
      var draft = session.draft || (session.draft = blankSpec(3));
      var selected = 0;
      var pickMode = 'icon';
      var pickColor = 'red';
      var preview = null; // {ctrl}
      var savedList = U.el('div', { class: 'pg-saved-list' });
      var status = U.el('p', { class: 'pg-status', 'aria-live': 'polite' });
      var problems = U.el('ul', { class: 'pg-problems', 'aria-live': 'polite' });

      // Name and base.
      var nameInput = U.el('input', { type: 'text', id: 'pg-name', class: 'pg-input pg-name', maxlength: String(MAX_NAME * 2),
        autocomplete: 'off', placeholder: 'Robot-Banana-Rocket' });
      nameInput.value = draft.name;
      nameInput.addEventListener('input', function () { draft.name = nameInput.value; changed(); });
      var baseOut = U.el('output', { class: 'pg-base-value', id: 'pg-base', 'aria-live': 'polite' });
      var baseMinus = btn('−', function () { setBase(draft.base - 1); }, 'pg-base-btn', { 'aria-label': 'Fewer digits' });
      var basePlus = btn('+', function () { setBase(draft.base + 1); }, 'pg-base-btn', { 'aria-label': 'More digits' });
      var baseHint = U.el('span', { class: 'pg-base-hint' });

      var slots = U.el('div', { class: 'pg-slots', role: 'group', 'aria-label': 'Your digits' });

      // The picker: pictures, colored shapes, or a typed character.
      var modeBtns = {};
      var modeRow = U.el('div', { class: 'pg-modes', role: 'group', 'aria-label': 'Kind of symbol' },
        [['icon', 'Pictures'], ['color', 'Colors and shapes'], ['text', 'Type a letter']].map(function (m) {
          var b = btn(m[1], function () { pickMode = m[0]; drawPicker(); }, 'btn-sm pg-mode', { dataset: { mode: m[0] } });
          modeBtns[m[0]] = b;
          return b;
        }));
      var picker = U.el('div', { class: 'pg-picker' });

      var charInput = U.el('input', { type: 'text', class: 'pg-input pg-char', maxlength: '2', autocomplete: 'off',
        autocapitalize: 'off', spellcheck: 'false', id: 'pg-char' });
      charInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); useChar(); } });

      var previewBox = U.el('div', { class: 'pg-preview' });
      var shareBox = U.el('textarea', { class: 'pg-share', id: 'pg-share', rows: '6', spellcheck: 'false',
        placeholder: 'Paste a saved number system here, then press Load it.' });

      panel.appendChild(U.el('div', { class: 'pg-make' },
        U.el('div', { class: 'pg-card pg-saved' },
          U.el('h2', { text: 'Your number systems' }), savedList,
          btn([icon('plus', 22), ' Start a new one'], function () {
            session.draft = draft = blankSpec(3); selected = 0; nameInput.value = ''; drawAll();
            status.textContent = 'A fresh system! Give it a name and pick its digits.';
            nameInput.focus();
          }, 'btn-sm')),
        U.el('div', { class: 'pg-card pg-editor' },
          U.el('h2', { text: 'Make your own number system' }),
          U.el('div', { class: 'pg-field' }, U.el('label', { for: 'pg-name', text: 'Name' }), nameInput),
          U.el('div', { class: 'pg-field' },
            U.el('span', { class: 'pg-label', id: 'pg-base-label', text: 'How many digits? (the base)' }),
            U.el('span', { class: 'pg-base', role: 'group', 'aria-labelledby': 'pg-base-label' }, baseMinus, baseOut, basePlus),
            baseHint),
          U.el('p', { class: 'pg-tip', text: 'Tap a digit, then pick its symbol.' }),
          slots,
          modeRow, picker,
          problems,
          previewBox,
          U.el('div', { class: 'pg-make-actions' },
            btn([icon('check', 22), ' Save'], save, 'btn-primary pg-save'),
            btn('Export', exportIt, 'btn-sm pg-export'),
            btn('Load it', importIt, 'btn-sm pg-import')),
          status,
          U.el('label', { class: 'pg-label', for: 'pg-share', text: 'Share: Export puts your system in this box as text. Copy it to keep it, or paste one here and press Load it.' }),
          shareBox)));

      function setBase(b) {
        b = U.clamp(b, MIN_BASE, MAX_BASE);
        if (b === draft.base) return;
        draft.base = b;
        if (selected >= b) selected = b - 1;
        NS.sound.play('click');
        drawAll();
      }

      function drawSlots() {
        U.clear(slots);
        var built = buildSystem(Object.assign({}, draft, { name: draft.name || 'x' }));
        for (var v = 0; v < draft.base; v++) {
          (function (v) {
            var d = draft.digits[v];
            var face;
            if (specKind(d)) {
              var tmp = previewDigit(d, v, built);
              face = tmp;
            } else {
              face = U.el('span', { class: 'pg-slot-empty', text: '?' });
            }
            var b = U.el('button', {
              type: 'button', class: ['pg-slot', v === selected ? 'is-selected' : ''], 'aria-pressed': v === selected ? 'true' : 'false',
              'aria-label': 'Digit worth ' + v + ': ' + (specKind(d) ? describeSpec(d) : 'not chosen yet'),
              dataset: { value: String(v) },
              onClick: function () { selected = v; drawSlots(); drawPicker(); }
            }, face, U.el('span', { class: 'pg-slot-worth', text: '= ' + v }));
            slots.appendChild(b);
          })(v);
        }
      }
      // Draw one chosen digit (even before the whole system is valid).
      function previewDigit(d, v, built) {
        var k = specKind(d);
        var digit;
        if (built.ok) digit = built.set.digits[v];
        else if (k === 'icon') digit = { value: v, label: describeSpec(d), speak: describeSpec(d), icon: d.icon };
        else if (k === 'color') digit = { value: v, label: cap(d.color), speak: d.color, color: (colorOf(d.color) || {}).color || '#999', shape: d.shape };
        else digit = { value: v, label: String(d.char), speak: String(d.char) };
        var fake = { id: 'x', kind: 'mixed', digits: [] };
        var sym = NS.symbols.render(digit, fake, { size: 52 });
        sym.setAttribute('aria-hidden', 'true');
        sym.removeAttribute('role');
        return U.el('span', { class: 'pg-slot-face' }, sym,
          k === 'icon' ? null : U.el('span', { class: 'pg-slot-name', text: k === 'color' ? cap(d.color) : '' }));
      }

      function choose(d) {
        draft.digits[selected] = d;
        NS.sound.play(d.icon && ANIMAL_SOUNDS[d.icon] ? ANIMAL_SOUNDS[d.icon] : 'pop');
        // Move on to the next digit that still needs a symbol.
        for (var i = 1; i <= draft.base; i++) {
          var v = (selected + i) % draft.base;
          if (!specKind(draft.digits[v])) { selected = v; break; }
        }
        drawAll();
      }
      function useChar() {
        var ch = charInput.value.trim();
        if (Array.from(ch).length !== 1) { status.textContent = 'Type just one letter, number or sign.'; charInput.focus(); return; }
        if (BAD_CHAR.test(ch)) { status.textContent = 'Not a space, dash, comma or underscore. Try another one!'; return; }
        charInput.value = '';
        choose({ char: ch });
        charInput.focus();
      }

      function drawPicker() {
        Object.keys(modeBtns).forEach(function (m) { modeBtns[m].setAttribute('aria-pressed', m === pickMode ? 'true' : 'false'); });
        U.clear(picker);
        var used = {};
        draft.digits.slice(0, draft.base).forEach(function (d, v) { if (specKind(d) && v !== selected) used[lookKey(d)] = true; });
        var forWhat = 'for the digit worth ' + selected;
        if (pickMode === 'icon') {
          picker.appendChild(U.el('div', { class: 'pg-palette', role: 'group', 'aria-label': 'Pictures ' + forWhat },
            ICONS.map(function (name) {
              var d = { icon: name };
              return U.el('button', {
                type: 'button', class: ['pg-pick', used[lookKey(d)] ? 'is-used' : ''], dataset: { icon: name },
                'aria-label': iconLabel(name) + (used[lookKey(d)] ? ' (already used)' : ''),
                onClick: function () { choose(d); }
              }, icon(name, 48));
            })));
        } else if (pickMode === 'color') {
          picker.appendChild(U.el('div', { class: 'pg-swatches', role: 'group', 'aria-label': 'Color' },
            COLORS.map(function (c) {
              return U.el('button', {
                type: 'button', class: 'pg-swatch', 'aria-pressed': c.name === pickColor ? 'true' : 'false', dataset: { color: c.name },
                style: { '--swatch': c.color }, onClick: function () { pickColor = c.name; drawPicker(); }
              }, U.el('span', { class: 'pg-swatch-dot', 'aria-hidden': 'true' }), cap(c.name));
            })));
          picker.appendChild(U.el('div', { class: 'pg-palette', role: 'group', 'aria-label': 'Shapes in ' + pickColor + ' ' + forWhat },
            SHAPES.map(function (shape) {
              var d = { color: pickColor, shape: shape };
              return U.el('button', {
                type: 'button', class: ['pg-pick', used[lookKey(d)] ? 'is-used' : ''], dataset: { shape: shape },
                'aria-label': cap(pickColor) + ' ' + shape + (used[lookKey(d)] ? ' (already used)' : ''),
                onClick: function () { choose(d); }
              }, NS.icons.render(shape, { kind: 'shape', color: colorOf(pickColor).color, size: 48 }));
            })));
        } else {
          picker.appendChild(U.el('div', { class: 'pg-char-row' },
            U.el('label', { for: 'pg-char', text: 'One letter, number or sign ' + forWhat + ':' }),
            charInput, btn('Use it', useChar, 'btn-sm pg-char-use')));
        }
      }

      function drawSaved() {
        U.clear(savedList);
        var specs = session.specs || [];
        if (!specs.length) savedList.appendChild(U.el('p', { class: 'pg-small', text: 'None yet. Make one below!' }));
        specs.forEach(function (spec) {
          var b = buildSystem(spec);
          if (!b.ok) return;
          var del = btn('Delete', null, 'btn-sm pg-del');
          var armed = null;
          del.addEventListener('click', function () {
            if (!armed) {
              del.textContent = 'Really delete?';
              del.classList.add('is-armed');
              armed = setTimeout(function () { armed = null; del.textContent = 'Delete'; del.classList.remove('is-armed'); }, 4000);
              return;
            }
            clearTimeout(armed);
            remove(spec);
          });
          savedList.appendChild(U.el('div', { class: 'pg-saved-item', dataset: { id: b.set.id } },
            NS.symbols.strip(sampleOf(b.set), b.set, { class: 'pg-strip' }),
            U.el('span', { class: 'pg-saved-name', text: b.set.name + ' (base ' + b.set.base + ')' }),
            btn('Edit', function () {
              session.draft = draft = JSON.parse(JSON.stringify(b.set.spec));
              selected = 0; nameInput.value = draft.name; drawAll();
              status.textContent = 'Editing ' + draft.name + '. Save to keep your changes.';
            }, 'btn-sm pg-edit'),
            del));
        });
        if (!storageWorks()) {
          savedList.appendChild(U.el('p', { class: 'pg-small pg-warn',
            text: 'This browser can\'t keep systems after you close the page (maybe a private window). Use Export to keep a copy.' }));
        }
      }
      // A number that shows every digit once (highest first): base 3 -> 210 in that base.
      function sampleOf(set) {
        var n = 0;
        for (var v = set.base - 1; v >= 0; v--) n = n * set.base + v;
        return set.base > 6 ? Math.pow(set.base, 2) - 1 - set.base : n;
      }

      function remove(spec) {
        var id = systemId(spec.name);
        session.specs = (session.specs || []).filter(function (s) { return systemId(s.name) !== id; });
        try { D.unregister(id); } catch (e) { /* not registered */ }
        saveSpecs(session.specs);
        status.textContent = spec.name + ' is gone.';
        drawSaved();
      }

      function save() {
        var b = buildSystem(draft);
        if (!b.ok) { status.textContent = 'Not yet! ' + b.errors[0]; NS.sound.play('click'); return; }
        ensureSystems();
        session.specs = upsert(session.specs, b.set.spec);
        D.register(b.set);
        var kept = saveSpecs(session.specs);
        NS.sound.play('tada');
        status.textContent = kept ? 'Saved! ' + b.set.name + ' is in the Converter and the Quiz now.'
          : 'Ready to use in the Converter and the Quiz! This browser can\'t keep it after you close the page, so press Export to keep a copy.';
        say('saved', 'Saved! Now try ' + b.set.name + ' in the converter and the quiz.');
        drawSaved();
      }

      function exportIt() {
        var b = buildSystem(draft);
        if (!b.ok) { status.textContent = 'Finish your system first! ' + b.errors[0]; return; }
        shareBox.value = exportText(b.set.spec);
        shareBox.focus();
        shareBox.select();
        var done = 'Here it is in the box. Copy it (Ctrl+C, or ⌘+C on a Mac) and keep it somewhere safe.';
        status.textContent = done;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareBox.value).then(function () {
              status.textContent = 'Copied! It is also in the box below. Paste it anywhere to keep it.';
            }, function () {});
          }
        } catch (e) { /* copying is a bonus */ }
      }

      function importIt() {
        var r = importText(shareBox.value);
        if (!r.ok) { status.textContent = r.error; NS.sound.play('click'); return; }
        session.draft = draft = JSON.parse(JSON.stringify(r.spec));
        selected = 0;
        nameInput.value = draft.name;
        drawAll();
        status.textContent = 'Loaded ' + draft.name + '! Press Save to keep it.';
        NS.sound.play('whoosh');
      }

      // The system is complete: a counting odometer and a mini addition.
      function drawPreview() {
        if (preview) preview.ctrl.abort();
        preview = null;
        U.clear(previewBox);
        var b = buildSystem(Object.assign({}, draft, { name: draft.name.trim() || 'My system' }));
        if (!b.ok) { hide(previewBox); return; }
        hide(previewBox, false);
        var set = Object.assign({}, b.set, { id: PREVIEW_ID, name: b.set.name });
        D.register(set);
        var ctrl = new AbortController();
        ac.signal.addEventListener('abort', function () { ctrl.abort(); });
        preview = { ctrl: ctrl };
        var named = set.kind !== 'text';
        var odo = NS.odometer.create({ set: set, places: 3, value: 0, labels: 'numbers', dimLeading: true, carryHop: true, digitNames: named, size: 'sm' });
        var count = U.el('output', { class: 'pg-count', text: '= 0' });
        var running = null;
        function countUp() {
          if (running) running.abort();
          running = new AbortController();
          ctrl.signal.addEventListener('abort', function () { running.abort(); });
          var c = anim(running.signal);
          odo.set(0, Object.assign({}, c, { instant: true }));
          count.textContent = '= 0';
          var to = Math.min(set.base * set.base + 1, 40);
          quiet(odo.runTo(to, c, { msPerStep: 650, accelerate: true, onStep: function (entry) { count.textContent = '= ' + entry.n; } }));
        }
        var sumBox = U.el('div', { class: 'pg-mini-add' });
        function newSum() {
          U.clear(sumBox);
          var p = NS.lessons.get('addition').helpers.makeProblem(set.id, { columns: 2, carries: true });
          var ca = NS.columnAdd.create({ set: set.id, a: p.a, b: p.b, names: named, hop: 'leap' });
          var check = hide(U.el('p', { class: 'pg-check', text: p.a + ' + ' + p.b + ' = ' + (p.a + p.b) + ' ✓' }));
          var go = btn('Add them!', function () {
            go.disabled = true;
            var c = anim(ctrl.signal);
            ca.playAll(c).then(function () { hide(check, false); NS.sound.play('tada'); }, function () {});
          }, 'btn-sm pg-add-go');
          sumBox.appendChild(U.el('div', { class: 'pg-mini-row' }, ca.el,
            U.el('div', { class: 'pg-mini-side' }, go, btn('New sum', newSum, 'btn-sm'), check)));
        }
        newSum();
        previewBox.appendChild(U.el('h3', { text: 'Try ' + set.name + '!' }));
        previewBox.appendChild(U.el('div', { class: 'pg-mini-row' }, odo.el,
          U.el('div', { class: 'pg-mini-side' }, btn([icon('play', 22), ' Count!'], countUp, 'btn-sm pg-count-go'), count)));
        previewBox.appendChild(sumBox);
      }

      function changed() {
        var errors = checkSpec(draft);
        U.clear(problems);
        var missing = errors.filter(function (e) { return /^Pick a symbol/.test(e); }).length;
        var other = errors.filter(function (e) { return !/^Pick a symbol/.test(e); });
        if (missing) other.unshift(missing === 1 ? 'One digit still needs a symbol.' : missing + ' digits still need a symbol.');
        other.forEach(function (e) { problems.appendChild(U.el('li', { text: e })); });
        if (!errors.length) problems.appendChild(U.el('li', { class: 'is-good', text: 'All set! Every digit has its own look.' }));
        drawPreview();
      }

      function drawAll() {
        baseOut.textContent = String(draft.base);
        baseMinus.disabled = draft.base <= MIN_BASE;
        basePlus.disabled = draft.base >= MAX_BASE;
        baseHint.textContent = 'Digits worth 0 to ' + (draft.base - 1) + '.';
        drawSlots();
        drawPicker();
        changed();
      }

      ensureSystems();
      drawSaved();
      drawAll();
      return {
        leave: function () { if (preview) preview.ctrl.abort(); },
        enter: function () { drawSaved(); drawPreview(); }
      };
    }

    // ---------- Quiz ----------
    function buildQuiz(panel) {
      var quiz = null; // {level, questions, index, stars, misses}
      var box = U.el('div', { class: 'pg-quiz' });
      panel.appendChild(box);
      var ctrl = null;

      function fresh() {
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        ac.signal.addEventListener('abort', function () { ctrl.abort(); });
        U.clear(box);
        return ctrl.signal;
      }

      function startScreen() {
        fresh();
        quiz = null;
        var levelBtns = LEVEL_IDS.map(function (id) {
          var best = bestScore(id);
          return U.el('button', {
            type: 'button', class: 'btn pg-level', 'aria-pressed': id === session.level ? 'true' : 'false', dataset: { level: id },
            onClick: function () { session.level = id; levelBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.level === id ? 'true' : 'false'); }); }
          }, U.el('span', { class: 'pg-level-name', text: LEVELS[id].label }),
          U.el('span', { class: 'pg-level-best', text: best ? 'Best: ' + best + ' ★' : 'No stars yet' }));
        });
        var customs = ensureSystems();
        box.appendChild(U.el('div', { class: 'pg-card pg-quiz-start' },
          U.el('h2', { text: 'Quiz time!' }),
          U.el('p', { class: 'pg-tip', text: 'Ten questions. Get one right the first time and you win a star!' }),
          U.el('div', { class: 'pg-levels', role: 'group', 'aria-label': 'How hard?' }, levelBtns),
          customs.length ? U.el('p', { class: 'pg-small', text: 'Your own systems are in the quiz too!' }) : null,
          btn([icon('play', 24), ' Start!'], function () { begin(session.level); }, 'btn-primary pg-start')));
      }

      function begin(levelId) {
        var customs = ensureSystems();
        quiz = { level: levelId, questions: makeQuiz(levelId, { customSets: customs }), index: 0, stars: 0 };
        NS.narrator.unlock();
        ask();
      }

      function ask() {
        var signal = fresh();
        var q = quiz.questions[quiz.index];
        var misses = 0, done = false;
        var starCount = U.el('span', { class: 'pg-star-count', text: String(quiz.stars) });
        var feedback = U.el('p', { class: 'pg-feedback', 'aria-live': 'polite' });
        var next = hide(btn(quiz.index + 1 < quiz.questions.length ? 'Next question →' : 'See my stars →', function () {
          quiz.index++;
          if (quiz.index < quiz.questions.length) ask(); else finish();
        }, 'btn-primary pg-next'));
        var burst = U.el('div', { class: 'pg-burst', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          var st = icon('star', 40);
          st.classList.add('pg-burst-star');
          st.style.setProperty('--a', (i * 45) + 'deg');
          return st;
        }));

        var dots = U.el('div', { class: 'pg-progress', 'aria-hidden': 'true' },
          quiz.questions.map(function (x, i) { return U.el('i', { class: i < quiz.index ? 'is-done' : i === quiz.index ? 'is-current' : '' }); }));
        var head = U.el('div', { class: 'pg-quiz-head' },
          U.el('span', { class: 'pg-qnum', text: 'Question ' + (quiz.index + 1) + ' of ' + quiz.questions.length }), dots,
          U.el('span', { class: 'pg-stars', 'aria-label': quiz.stars + ' stars' }, icon('star', 30), starCount));
        var title = U.el('h2', { class: 'pg-q-text', tabindex: '-1', text: q.text });
        var showEl = drawShow(q);
        var answerEl;
        var choiceBtns = [];
        var handsApi = null;

        function right(btnEl) {
          done = true;
          if (misses === 0) { quiz.stars++; starCount.textContent = String(quiz.stars); }
          if (btnEl) btnEl.classList.add('is-right');
          choiceBtns.forEach(function (b) { b.disabled = true; });
          var praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
          var ex = explain(q);
          feedback.textContent = praise + ' ' + ex.text + (misses === 0 ? ' You win a star!' : '');
          feedback.className = 'pg-feedback is-right';
          NS.sound.play(misses === 0 ? 'tada' : 'ding');
          if (misses === 0) pop(burst);
          say('right', praise + ' ' + ex.say);
          hide(next, false);
          next.focus();
        }
        function wrong(btnEl, value) {
          misses++;
          NS.sound.play('click');
          if (btnEl) { btnEl.classList.add('is-wrong'); btnEl.disabled = true; btnEl.setAttribute('aria-label', btnEl.getAttribute('aria-label') + ' (not this one)'); }
          if (misses < 2) {
            var t = q.type === 'fingers' ? 'Not quite. Your fingers show ' + value + '. Try again!' : 'Not quite. Try again!';
            feedback.textContent = t;
            feedback.className = 'pg-feedback is-wrong';
            say('wrong', q.type === 'fingers' ? 'Not quite. Your fingers show ' + words(value) + '. Try again!' : 'Not quite. Try again!');
            return;
          }
          // Second miss: show the answer, no star.
          done = true;
          var ex = explain(q);
          choiceBtns.forEach(function (b) {
            b.disabled = true;
            if (+b.dataset.value === q.answer) b.classList.add('is-right');
          });
          if (handsApi) quiet(handsApi.setBits(q.answer, anim(signal)));
          feedback.textContent = 'Here is the answer: ' + ex.text;
          feedback.className = 'pg-feedback is-shown';
          say('answer', 'Here is the answer. ' + ex.say);
          hide(next, false);
          next.focus();
        }

        if (q.type === 'fingers') {
          handsApi = NS.hands.create({ hands: 'both', labels: true });
          quiet(handsApi.setBits(0, { instant: true })); // a new pair of hands starts open; fold every finger
          var shows = U.el('output', { class: 'pg-finger-count', text: 'Your fingers show 0' });
          handsApi.onToggle(function (info) { if (!done) shows.textContent = 'Your fingers show ' + info.bits; });
          answerEl = U.el('div', { class: 'pg-finger-answer theme-binary' }, handsApi.el, shows,
            U.el('div', { class: 'pg-finger-btns' },
              btn([icon('check', 24), ' Check!'], function () {
                if (done) return;
                var bits = handsApi.getBits();
                if (isRight(q, bits)) right(null); else wrong(null, bits);
              }, 'btn-primary pg-check-fingers'),
              btn('All down', function () {
                if (done) return;
                quiet(handsApi.setBits(0, anim(signal)));
                shows.textContent = 'Your fingers show 0';
              }, 'btn-sm')));
        } else {
          choiceBtns = q.choices.map(function (v) {
            var label = q.choiceSet === 'decimal' ? String(v) : textOf(v, q.choiceSet);
            var b = U.el('button', {
              type: 'button', class: 'pg-choice', dataset: { value: String(v) }, 'aria-label': label,
              onClick: function () { if (done || b.disabled) return; if (isRight(q, v)) right(b); else wrong(b, v); }
            }, numView(v, q.choiceSet));
            return b;
          });
          answerEl = U.el('div', { class: ['pg-choices', 'pg-choices-' + q.choices.length] }, choiceBtns);
        }

        box.appendChild(U.el('div', { class: ['pg-card', 'pg-question', 'pg-q-' + q.type] },
          head,
          U.el('div', { class: 'pg-q-top' }, title,
            btn(icon('voice', 24), function () { say('question', q.say); }, 'btn-sm pg-read', { 'aria-label': 'Read it to me' })),
          showEl, answerEl, feedback, next, burst));
        title.focus({ preventScroll: true });
        say('question', q.say);
      }

      // What the question shows: a number, a counting sequence, or a sum, each with its system's name.
      function drawShow(q) {
        if (q.show.kind === 'none' || q.show.kind === 'fingers') return null;
        var s = D.resolve(q.set);
        var tag = U.el('span', { class: ['pg-sys-tag', 'theme-' + s.theme], text: s.name });
        var body;
        if (q.show.kind === 'number') body = numView(q.show.value, s, 'pg-big');
        else if (q.show.kind === 'sequence') {
          body = U.el('span', { class: 'pg-seq' }, q.show.values.map(function (v) {
            return [numView(v, s), U.el('span', { class: 'pg-seq-comma', 'aria-hidden': 'true', text: ',' })];
          }), U.el('span', { class: 'pg-seq-q', text: '?' }));
        } else {
          body = U.el('span', { class: 'pg-sum' }, numView(q.show.a, s), U.el('span', { class: 'pg-op', text: '+' }),
            numView(q.show.b, s), U.el('span', { class: 'pg-op', text: '=' }), U.el('span', { class: 'pg-seq-q', text: '?' }));
        }
        return U.el('div', { class: ['pg-show', 'theme-' + s.theme] }, tag, body);
      }

      function finish() {
        fresh();
        var best = noteScore(quiz.level, quiz.stars);
        var total = quiz.questions.length;
        var msg = 'You got ' + quiz.stars + (quiz.stars === 1 ? ' star' : ' stars') + ' out of ' + total + '!';
        var cheer = quiz.stars === total ? 'Perfect! Every single one!' : quiz.stars >= 7 ? 'Super job!' : quiz.stars >= 4 ? 'Good work! Try again for more stars.' : 'Nice try! Every quiz makes you better.';
        var starsRow = U.el('div', { class: 'pg-final-stars', 'aria-hidden': 'true' });
        for (var i = 0; i < total; i++) {
          var st = icon('star', 40);
          if (i >= quiz.stars) st.classList.add('is-empty');
          starsRow.appendChild(st);
        }
        var heading = U.el('h2', { class: 'pg-final', tabindex: '-1', text: msg });
        box.appendChild(U.el('div', { class: 'pg-card pg-quiz-end' },
          heading, starsRow,
          U.el('p', { class: 'pg-tip', text: cheer }),
          best && quiz.stars > 0 ? U.el('p', { class: 'pg-new-best', text: 'New best score for ' + LEVELS[quiz.level].label + '!' }) : null,
          U.el('div', { class: 'pg-make-actions' },
            btn([icon('replay', 22), ' Play again'], function () { begin(quiz.level); }, 'btn-primary pg-again'),
            btn('Pick a level', startScreen, 'btn-sm'))));
        heading.focus({ preventScroll: true });
        NS.sound.play('tada');
        say('done', msg + ' ' + cheer.replace(/\d+/g, function (d) { return words(+d); }));
      }

      function pop(el) {
        el.classList.remove('is-on');
        void el.offsetWidth;
        el.classList.add('is-on');
        return Promise.resolve();
      }

      startScreen();
      return { enter: function () { if (!quiz) startScreen(); } };
    }

    var builders = { converter: buildConverter, make: buildMake, quiz: buildQuiz };
    show(TABS.some(function (t) { return t.id === opts.tab; }) ? opts.tab : session.tab, false);

    return {
      destroy: function () {
        ac.abort();
        if (speech) speech.abort();
        clearTimeout(capTimer);
        NS.narrator.stop();
        NS.narrator.setCaptionElement(null);
        try { D.unregister(PREVIEW_ID); } catch (e) { /* fine */ }
      },
      show: function (id) { show(id, true); }
    };
  }

  var helpers = {
    MIN_BASE: MIN_BASE, MAX_BASE: MAX_BASE, MAX_NAME: MAX_NAME, ICONS: ICONS, COLORS: COLORS, SHAPES: SHAPES,
    CONVERTER_SETS: CONVERTER_SETS, MAX_DIGITS: MAX_DIGITS, DRAW_LIMIT: DRAW_LIMIT, FINGER_MAX: FINGER_MAX,
    LEVELS: LEVELS, LEVEL_IDS: LEVEL_IDS, QUIZ_LENGTH: QUIZ_LENGTH, NOT_ALONE: NOT_ALONE, STORE_KEY: STORE_KEY,
    specKind: specKind, lookKey: lookKey, describeSpec: describeSpec, systemId: systemId, checkSpec: checkSpec,
    buildSystem: buildSystem, exportText: exportText, importText: importText, blankSpec: blankSpec,
    loadSpecs: loadSpecs, saveSpecs: saveSpecs, upsert: upsert,
    textOf: textOf, readInput: readInput, canDraw: canDraw, onFingers: onFingers, stepValue: stepValue, convertAll: convertAll,
    maxFor: maxFor, sysName: sysName, misread: misread, noCarrySum: noCarrySum,
    makeQuestion: makeQuestion, makeQuiz: makeQuiz, isRight: isRight, explain: explain,
    loadBest: loadBest, recordScore: recordScore
  };

  NS.playground = { mount: mount, helpers: helpers };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
