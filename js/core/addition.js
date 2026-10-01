// Column addition in any base, as data for animations and narration (no DOM).
//
// addSteps(47, 38, 10) ->
//   [ {column:0, power:0, placeValue:1,  da:7, db:8, carryIn:0, total:15, digit:5, carryOut:1},
//     {column:1, power:1, placeValue:10, da:4, db:3, carryIn:1, total:8,  digit:8, carryOut:0} ]
// Columns run from the ones place outward. If the last column carries, a final step with
// finalCarry:true writes the carried 1 into a new place.
(function (NS) {
  'use strict';

  function checkInput(n, label) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
      throw new RangeError(label + ' must be a whole number from zero up (got ' + n + ')');
    }
  }

  function addSteps(a, b, base) {
    checkInput(a, 'First number');
    checkInput(b, 'Second number');
    var da = NS.numeral.toDigits(a, base).reverse(); // ones first
    var db = NS.numeral.toDigits(b, base).reverse();
    var columns = Math.max(da.length, db.length);
    var steps = [];
    var carry = 0;
    for (var c = 0; c < columns; c++) {
      var x = c < da.length ? da[c] : 0;
      var y = c < db.length ? db[c] : 0;
      var total = x + y + carry;
      steps.push({
        column: c, power: c, placeValue: Math.pow(base, c),
        da: x, db: y, carryIn: carry, total: total,
        digit: total % base, carryOut: total >= base ? 1 : 0
      });
      carry = total >= base ? 1 : 0;
    }
    if (carry) {
      steps.push({
        column: columns, power: columns, placeValue: Math.pow(base, columns),
        da: 0, db: 0, carryIn: 1, total: 1, digit: 1, carryOut: 0, finalCarry: true
      });
    }
    return steps;
  }

  // add(2A, 1F in hex) -> {a, b, base, sum: 73, digits: [4, 9], steps}
  function add(a, b, base) {
    base = base || 10;
    var steps = addSteps(a, b, base);
    var digits = steps.map(function (s) { return s.digit; }).reverse();
    return { a: a, b: b, base: base, sum: a + b, digits: digits, steps: steps };
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function joinPlus(words) { return words.join(' plus '); }

  // Kid-friendly sentence for one column. Uses the set's digit names, so animals say
  // "Frog plus Pig..." and hex says "A plus F...".
  //   decimal: "Seven plus eight is fifteen. That's one ten and five, so write five and carry one."
  //   hex:     "A plus F is ten plus fifteen, twenty-five. That's one sixteen and nine, so write nine and carry one."
  //   animals: "Frog plus Pig is two plus three, five. That's one five and zero, so write Cat and carry Dog."
  function explainStep(step, set) {
    var s = NS.digitsets.resolve(set);
    var W = NS.digitsets.numberToWords;
    var name = function (v) { return s.digits[v].speak; };

    if (step.finalCarry) {
      return 'The carried ' + name(1) + ' moves into a new place all by itself. Write ' + name(1) + '.';
    }

    var values = step.carryIn ? [step.carryIn, step.da, step.db] : [step.da, step.db];
    var named = values.map(name);
    // Only spell out the values when a digit's name isn't already its number word (A, Frog, red...).
    var needsValues = values.some(function (v) { return name(v).toLowerCase() !== W(v); });

    var text = capitalize(joinPlus(named)) + ' is ' +
      (needsValues ? joinPlus(values.map(W)) + ', ' : '') + W(step.total) + '.';

    if (step.carryOut) {
      var place = s.placeName || W(s.base);
      text += " That's one " + place + ' and ' + W(step.digit) + ', so write ' + name(step.digit) +
        ' and carry ' + name(1) + '.';
    } else if (needsValues) {
      text += " That's " + name(step.digit) + ', so write ' + name(step.digit) + '.';
    } else {
      text += ' Write ' + name(step.digit) + '.';
    }
    return text;
  }

  NS.addition = {
    addSteps: addSteps,
    add: add,
    explainStep: explainStep
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
