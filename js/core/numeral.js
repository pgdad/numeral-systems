// Numeral engine: pure functions for writing numbers in any base (no DOM).
// Contract: docs/plan/PLAN.md § "Numeral engine contract".
//
// Digit arrays are always most-significant first: toDigits(11, 2) -> [1, 0, 1, 1].
// Numbers may be plain integers or BigInt. Digit values are always plain numbers.
(function (NS) {
  'use strict';

  function isBig(n) { return typeof n === 'bigint'; }

  function checkBase(base) {
    if (typeof base !== 'number' || !Number.isInteger(base) || base < 2) {
      throw new RangeError('Base must be a whole number of at least 2 (got ' + base + ')');
    }
  }

  function checkN(n) {
    if (isBig(n)) {
      if (n < 0n) throw new RangeError('Only zero and positive numbers are supported (got ' + n + ')');
      return;
    }
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
      throw new RangeError('Only zero and whole positive numbers are supported (got ' + n + ')');
    }
    if (n > Number.MAX_SAFE_INTEGER) throw new RangeError('Number too big; pass a BigInt instead');
  }

  // toDigits(237, 10) -> [2, 3, 7]; toDigits(0, b) -> [0]. Accepts BigInt.
  function toDigits(n, base) {
    checkBase(base);
    checkN(n);
    if (isBig(n)) {
      var B = BigInt(base);
      if (n === 0n) return [0];
      var outB = [];
      while (n > 0n) { outB.push(Number(n % B)); n = n / B; }
      return outB.reverse();
    }
    if (n === 0) return [0];
    var out = [];
    while (n > 0) { out.push(n % base); n = Math.floor(n / base); }
    return out.reverse();
  }

  // fromDigits([1,0,1,1], 2) -> 11. Returns a BigInt when opts.bigint is set or any digit
  // is a BigInt; otherwise throws if the result would exceed Number.MAX_SAFE_INTEGER.
  function fromDigits(values, base, opts) {
    checkBase(base);
    if (!Array.isArray(values) || values.length === 0) throw new RangeError('Need at least one digit');
    values.forEach(function (d) {
      var v = Number(d);
      if (!Number.isInteger(v) || v < 0 || v >= base) {
        throw new RangeError('Digit ' + d + ' is not valid in base ' + base);
      }
    });
    var wantBig = !!(opts && opts.bigint) || values.some(isBig);
    if (wantBig) {
      var B = BigInt(base);
      return values.reduce(function (acc, d) { return acc * B + BigInt(d); }, 0n);
    }
    var total = 0;
    for (var i = 0; i < values.length; i++) {
      total = total * base + values[i];
      if (total > Number.MAX_SAFE_INTEGER) throw new RangeError('Number too big; use {bigint: true}');
    }
    return total;
  }

  // placeValues(237, 10) ->
  //   [{digit:2, power:2, placeValue:100, contribution:200}, {digit:3, power:1, ...}, {digit:7, power:0, ...}]
  function placeValues(n, base) {
    var digits = toDigits(n, base);
    var big = isBig(n);
    return digits.map(function (digit, i) {
      var power = digits.length - 1 - i;
      var placeValue = big ? BigInt(base) ** BigInt(power) : Math.pow(base, power);
      return {
        digit: digit,
        power: power,
        placeValue: placeValue,
        contribution: big ? BigInt(digit) * placeValue : digit * placeValue
      };
    });
  }

  function padDigits(digits, minLength) {
    var out = digits.slice();
    while (out.length < (minLength || 0)) out.unshift(0);
    return out;
  }

  // format(n, set, {minLength, groupSize, separator})
  //   text sets  -> string, e.g. format(1023, binary, {groupSize: 4}) -> "11 1111 1111"
  //   icon/color -> array of digit objects (from set.digits), e.g. [{label:'Frog'...}, {label:'Pig'...}]
  function format(n, set, opts) {
    opts = opts || {};
    var values = padDigits(toDigits(n, set.base), opts.minLength);
    var digitObjs = values.map(function (v) { return set.digits[v]; });
    if (set.kind !== 'text') return digitObjs;
    var labels = digitObjs.map(function (d) { return d.label; });
    if (!opts.groupSize) return labels.join('');
    var groups = [];
    for (var end = labels.length; end > 0; end -= opts.groupSize) {
      groups.unshift(labels.slice(Math.max(0, end - opts.groupSize), end).join(''));
    }
    return groups.join(opts.separator === undefined ? ' ' : opts.separator);
  }

  function describeDigits(set) {
    if (set.digitsDescription) return set.digitsDescription;
    var labels = set.digits.map(function (d) { return d.label; });
    if (set.kind === 'text') return labels[0] + '–' + labels[labels.length - 1];
    return labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
  }

  function findDigit(set, token) {
    var t = String(token).trim();
    var ci = set.caseInsensitive || set.kind !== 'text';
    var key = ci ? t.toLowerCase() : t;
    for (var i = 0; i < set.digits.length; i++) {
      var d = set.digits[i];
      var names = [d.label, d.speak, d.name].filter(Boolean);
      for (var j = 0; j < names.length; j++) {
        if ((ci ? String(names[j]).toLowerCase() : String(names[j])) === key) return d.value;
      }
    }
    return -1;
  }

  // parse(input, set, {bigint}) -> {ok: true, value} | {ok: false, error}
  // Text sets read one character per digit (spaces and underscores ignored).
  // Icon/color sets read names separated by spaces, dashes or commas ("Dog-Frog"),
  // or an array of digit values / names.
  function parse(input, set, opts) {
    var shortName = set.shortName || String(set.name || set.id).toLowerCase();
    var tokens;
    if (Array.isArray(input)) {
      tokens = input;
    } else {
      var s = String(input === undefined || input === null ? '' : input).trim();
      tokens = set.kind === 'text'
        ? s.replace(/[\s_]+/g, '').split('')
        : s.split(/[\s,\-–]+/).filter(Boolean);
    }
    if (tokens.length === 0) {
      return { ok: false, error: 'Type a number first!' };
    }
    var values = [];
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      var v = typeof tok === 'number' ? (Number.isInteger(tok) && tok >= 0 && tok < set.base ? tok : -1)
                                      : findDigit(set, tok);
      if (v < 0) {
        return {
          ok: false,
          error: String(tok) + " isn't a digit in " + shortName + ': ' + shortName +
            ' only uses ' + describeDigits(set) + '!'
        };
      }
      values.push(v);
    }
    var wantBig = !!(opts && opts.bigint);
    try {
      return { ok: true, value: fromDigits(values, set.base, { bigint: wantBig }) };
    } catch (e) {
      // Too big for a plain number: hand back a BigInt rather than failing.
      return { ok: true, value: fromDigits(values, set.base, { bigint: true }) };
    }
  }

  // countSequence(5, 9, 8) -> [{n:5, digits:[0,5], changedPlaces:[]}, ..., {n:8, digits:[1,0], changedPlaces:[0,1]}]
  // digits are padded to the width of the larger end so places line up for odometers.
  // changedPlaces lists powers (0 = ones place) whose digit differs from the previous entry.
  function countSequence(from, to, base) {
    checkN(from); checkN(to);
    var width = Math.max(toDigits(from, base).length, toDigits(to, base).length);
    var step = to >= from ? 1 : -1;
    var out = [];
    var prev = null;
    for (var n = from; step > 0 ? n <= to : n >= to; n += step) {
      var digits = padDigits(toDigits(n, base), width);
      var changed = [];
      if (prev) {
        for (var i = 0; i < width; i++) {
          if (digits[i] !== prev[i]) changed.push(width - 1 - i);
        }
        changed.sort(function (a, b) { return a - b; });
      }
      out.push({ n: n, digits: digits, changedPlaces: changed });
      prev = digits;
    }
    return out;
  }

  // Biggest number that fits in `places` digits: maxWithPlaces(10, 2) -> 1023.
  function maxWithPlaces(places, base) {
    checkBase(base);
    return Math.pow(base, places) - 1;
  }

  NS.numeral = {
    toDigits: toDigits,
    fromDigits: fromDigits,
    placeValues: placeValues,
    format: format,
    parse: parse,
    countSequence: countSequence,
    maxWithPlaces: maxWithPlaces,
    padDigits: padDigits,
    describeDigits: describeDigits
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
