// Digit sets: what each number system's digits look like and how they are spoken.
// Built-ins: decimal, binary, octal, hex, animals (base 5), colors (base 3) — DECISIONS D6.
// The playground registers custom sets with register().
//
// A digit set:
//   { id, name, shortName, base, kind: 'text'|'icon'|'color', theme, caseInsensitive?,
//     speakJoin?: '-' (between spoken digits), placeName?: word for one group ("ten", "sixteen"),
//     digits: [{value, label, speak, ...}] }
// Icon digits add {icon, sound}; color digits add {color, shape, name}.
(function (NS) {
  'use strict';

  var ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  var TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  // numberToWords(237) -> "two hundred thirty-seven". 0..9999 in words; bigger numbers
  // are read digit by digit ("one two three four five").
  function numberToWords(n) {
    if (typeof n === 'bigint') n = n <= 9999n ? Number(n) : n;
    if (typeof n === 'bigint' || n > 9999) {
      return String(n).split('').map(function (c) { return ONES[+c]; }).join(' ');
    }
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
    if (n < 1000) {
      return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberToWords(n % 100) : '');
    }
    return ONES[Math.floor(n / 1000)] + ' thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  }

  function textDigits(labels) {
    return labels.map(function (label, value) {
      return { value: value, label: label, speak: /^[0-9]$/.test(label) ? ONES[value] : label };
    });
  }

  var HEX_LABELS = '0123456789ABCDEF'.split('');

  var BUILT_INS = [
    {
      id: 'decimal', name: 'Decimal (base 10)', shortName: 'decimal', base: 10, kind: 'text', theme: 'base10',
      placeName: 'ten', digits: textDigits(HEX_LABELS.slice(0, 10))
    },
    {
      id: 'binary', name: 'Binary (base 2)', shortName: 'binary', base: 2, kind: 'text', theme: 'binary',
      placeName: 'two', digits: textDigits(['0', '1'])
    },
    {
      id: 'octal', name: 'Octal (base 8)', shortName: 'octal', base: 8, kind: 'text', theme: 'octal',
      placeName: 'eight', digits: textDigits(HEX_LABELS.slice(0, 8))
    },
    {
      id: 'hex', name: 'Hexadecimal (base 16)', shortName: 'hex', base: 16, kind: 'text', theme: 'hex',
      placeName: 'sixteen', caseInsensitive: true, speakJoin: ' ', digitsDescription: '0–9 and A–F',
      digits: textDigits(HEX_LABELS)
    },
    {
      id: 'animals', name: 'Animal numbers (base 5)', shortName: 'the animal system', base: 5, kind: 'icon',
      theme: 'animals', placeName: 'five',
      digits: [
        { value: 0, label: 'Cat', speak: 'Cat', icon: 'cat', sound: 'meow' },
        { value: 1, label: 'Dog', speak: 'Dog', icon: 'dog', sound: 'woof' },
        { value: 2, label: 'Frog', speak: 'Frog', icon: 'frog', sound: 'ribbit' },
        { value: 3, label: 'Pig', speak: 'Pig', icon: 'pig', sound: 'oink' },
        { value: 4, label: 'Duck', speak: 'Duck', icon: 'duck', sound: 'quack' }
      ]
    },
    {
      id: 'colors', name: 'Color numbers (base 3)', shortName: 'the color system', base: 3, kind: 'color',
      theme: 'colors', placeName: 'three',
      digits: [
        { value: 0, label: 'Red', speak: 'red', name: 'red', color: '#e53935', shape: 'circle' },
        { value: 1, label: 'Yellow', speak: 'yellow', name: 'yellow', color: '#fbc02d', shape: 'triangle' },
        { value: 2, label: 'Green', speak: 'green', name: 'green', color: '#43a047', shape: 'square' }
      ]
    }
  ];

  var KINDS = { text: true, icon: true, color: true };

  // Throws a helpful Error if the set is malformed; returns the set otherwise.
  function validate(set) {
    function fail(msg) { throw new Error('Digit set "' + (set && set.id) + '": ' + msg); }
    if (!set || typeof set !== 'object') fail('must be an object');
    if (typeof set.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(set.id)) fail('id must be lowercase letters, digits or dashes');
    if (typeof set.name !== 'string' || !set.name.trim()) fail('needs a name');
    if (!Number.isInteger(set.base) || set.base < 2 || set.base > 36) fail('base must be a whole number from 2 to 36');
    if (!KINDS[set.kind]) fail('kind must be text, icon or color');
    if (!Array.isArray(set.digits) || set.digits.length !== set.base) {
      fail('needs exactly ' + set.base + ' digits (one per value 0..' + (set.base - 1) + ')');
    }
    var seen = {};
    set.digits.forEach(function (d, i) {
      if (!d || d.value !== i) fail('digit #' + i + ' must have value ' + i);
      if (typeof d.label !== 'string' || !d.label) fail('digit ' + i + ' needs a label');
      if (typeof d.speak !== 'string' || !d.speak) fail('digit ' + i + ' needs speak text');
      if (set.kind === 'text' && Array.from(d.label).length !== 1) fail('text digit ' + i + ' must be a single character');
      if (set.kind === 'icon' && !d.icon) fail('icon digit ' + i + ' needs an icon');
      if (set.kind === 'color' && !(d.color && d.shape)) fail('color digit ' + i + ' needs a color and a shape');
      var key = (set.caseInsensitive || set.kind !== 'text') ? d.label.toLowerCase() : d.label;
      if (seen[key]) fail('two digits share the label "' + d.label + '"; every digit must look different');
      seen[key] = true;
    });
    return set;
  }

  // Registry (built-ins + custom sets).
  var registry = {};
  var order = [];

  function register(set) {
    validate(set);
    if (!registry[set.id]) order.push(set.id);
    registry[set.id] = set;
    return set;
  }

  function unregister(id) {
    if (BUILT_INS.some(function (b) { return b.id === id; })) throw new Error('Cannot remove built-in set ' + id);
    delete registry[id];
    order = order.filter(function (x) { return x !== id; });
  }

  function get(id) { return registry[id] || null; }
  function list() { return order.map(function (id) { return registry[id]; }); }

  function resolve(set) {
    var s = typeof set === 'string' ? get(set) : set;
    if (!s) throw new Error('Unknown digit set: ' + set);
    return s;
  }

  // Name of a single digit value: digitName(10, 'hex') -> "A"; digitName(2, 'animals') -> "Frog".
  function digitName(value, set) {
    return resolve(set).digits[value].speak;
  }

  // speak(13, 'binary') -> "one-one-zero-one"; speak(42, 'hex') -> "two A";
  // speak(13, 'animals') -> "Frog-Pig"; speak(237, 'decimal') -> "two hundred thirty-seven".
  function speak(n, set) {
    var s = resolve(set);
    if (s.id === 'decimal') return numberToWords(n);
    var values = NS.numeral.toDigits(n, s.base);
    var join = s.speakJoin === undefined ? '-' : s.speakJoin;
    return values.map(function (v) { return s.digits[v].speak; }).join(join);
  }

  function pluralize(words) {
    if (/x$/.test(words)) return words + 'es';      // six -> sixes
    if (/y$/.test(words)) return words.slice(0, -1) + 'ies'; // (not needed for powers, kept safe)
    return words + 's';                                // ten -> tens, twenty-five -> twenty-fives
  }

  // Name of a place (column) for labels: placeName(0, 10) -> "Ones", placeName(2, 10) -> "Hundreds",
  // placeName(3, 2) -> "Eights", placeName(2, 5) -> "Twenty-fives". {plural: false} -> "Hundred".
  // {style: 'number'} -> "100s" (compact labels for big places).
  function placeName(power, base, opts) {
    opts = opts || {};
    var value = Math.pow(base, power);
    if (opts.style === 'number') return value.toLocaleString('en-US') + (opts.plural === false ? '' : 's');
    var words = power === 0 ? 'one' : numberToWords(value).replace(/^one (hundred|thousand)$/, '$1');
    if (opts.plural !== false) words = pluralize(words);
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  BUILT_INS.forEach(register);

  NS.digitsets = {
    register: register,
    unregister: unregister,
    validate: validate,
    get: get,
    list: list,
    resolve: resolve,
    speak: speak,
    digitName: digitName,
    numberToWords: numberToWords,
    placeName: placeName,
    BUILT_IN_IDS: BUILT_INS.map(function (b) { return b.id; })
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
