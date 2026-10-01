describe('numeral: toDigits / fromDigits', function () {
  var N = NumSys.numeral;

  it('converts known values', function () {
    expect(N.toDigits(0, 10)).toEqual([0]);
    expect(N.toDigits(237, 10)).toEqual([2, 3, 7]);
    expect(N.toDigits(11, 2)).toEqual([1, 0, 1, 1]);
    expect(N.toDigits(255, 16)).toEqual([15, 15]);
    expect(N.toDigits(13, 5)).toEqual([2, 3]);
    expect(N.toDigits(26, 3)).toEqual([2, 2, 2]);
    expect(N.fromDigits([1, 0, 0, 1, 0], 2)).toBe(18);
    expect(N.fromDigits([0, 0, 7], 10)).toBe(7);
  });

  it('round-trips every n in 0..5000 for bases 2..16', function () {
    for (var b = 2; b <= 16; b++) {
      for (var n = 0; n <= 5000; n++) {
        var back = N.fromDigits(N.toDigits(n, b), b);
        if (back !== n) throw new Error('round trip failed for ' + n + ' in base ' + b + ': got ' + back);
      }
    }
  });

  it('supports BigInt', function () {
    var big = 2n ** 70n;
    var bits = N.toDigits(big, 2);
    expect(bits.length).toBe(71);
    expect(bits[0]).toBe(1);
    expect(N.fromDigits(bits, 2, { bigint: true })).toBe(big);
    expect(N.toDigits(255n, 16)).toEqual([15, 15]);
    expect(N.toDigits(0n, 2)).toEqual([0]);
  });

  it('rejects bad input', function () {
    expect(function () { N.toDigits(-1, 10); }).toThrow('positive');
    expect(function () { N.toDigits(1.5, 10); }).toThrow('whole');
    expect(function () { N.toDigits(5, 1); }).toThrow('Base');
    expect(function () { N.fromDigits([2], 2); }).toThrow('not valid');
    expect(function () { N.fromDigits([], 2); }).toThrow('at least one');
    expect(function () { N.fromDigits(N.toDigits(2n ** 60n, 2), 2); }).toThrow('too big');
  });

  it('maxWithPlaces: ten fingers count to 1023', function () {
    expect(N.maxWithPlaces(10, 2)).toBe(1023);
    expect(N.maxWithPlaces(3, 10)).toBe(999);
    expect(N.maxWithPlaces(3, 5)).toBe(124);
    expect(N.maxWithPlaces(4, 16)).toBe(65535);
  });
});

describe('numeral: placeValues', function () {
  var N = NumSys.numeral;

  it('237 = 200 + 30 + 7', function () {
    var pv = N.placeValues(237, 10);
    expect(pv.map(function (p) { return p.contribution; })).toEqual([200, 30, 7]);
    expect(pv.map(function (p) { return p.placeValue; })).toEqual([100, 10, 1]);
    expect(pv.map(function (p) { return p.power; })).toEqual([2, 1, 0]);
  });

  it('binary 1011 = 8 + 0 + 2 + 1', function () {
    expect(N.placeValues(11, 2).map(function (p) { return p.contribution; })).toEqual([8, 0, 2, 1]);
  });

  it('colors Green-Green-Green = 18 + 6 + 2', function () {
    expect(N.placeValues(26, 3).map(function (p) { return p.contribution; })).toEqual([18, 6, 2]);
  });

  it('works with BigInt', function () {
    expect(N.placeValues(255n, 16).map(function (p) { return p.contribution; })).toEqual([240n, 15n]);
  });
});

describe('numeral: format', function () {
  var N = NumSys.numeral;
  var D = NumSys.digitsets;
  function labels(arr) { return arr.map(function (d) { return d.label; }); }

  it('13 in every costume (CONTENT 4.4)', function () {
    expect(N.format(13, D.get('decimal'))).toBe('13');
    expect(N.format(13, D.get('binary'))).toBe('1101');
    expect(N.format(13, D.get('octal'))).toBe('15');
    expect(N.format(13, D.get('hex'))).toBe('D');
    expect(labels(N.format(13, D.get('animals')))).toEqual(['Frog', 'Pig']);
    expect(labels(N.format(13, D.get('colors')))).toEqual(['Yellow', 'Yellow', 'Yellow']);
  });

  it('1023 is 1111111111 in binary and 3FF in hex (CONTENT 2.4, 3.3)', function () {
    expect(N.format(1023, D.get('binary'))).toBe('1111111111');
    expect(N.format(1023, D.get('binary'), { groupSize: 4 })).toBe('11 1111 1111');
    expect(N.format(1023, D.get('hex'))).toBe('3FF');
    expect(N.format(1023, D.get('octal'))).toBe('1777');
  });

  it('pads with minLength and groups with a custom separator', function () {
    expect(N.format(5, D.get('binary'), { minLength: 10 })).toBe('0000000101');
    expect(N.format(255, D.get('binary'), { groupSize: 4, separator: '_' })).toBe('1111_1111');
    expect(labels(N.format(1, D.get('animals'), { minLength: 3 }))).toEqual(['Cat', 'Cat', 'Dog']);
  });

  it('hex color codes', function () {
    expect(N.format(255, D.get('hex'))).toBe('FF');
    expect(N.format(0, D.get('hex'), { minLength: 2 })).toBe('00');
  });
});

describe('numeral: parse', function () {
  var N = NumSys.numeral;
  var D = NumSys.digitsets;

  it('reads text numbers (hex is case-insensitive, spaces ignored)', function () {
    expect(N.parse('1011', D.get('binary'))).toEqual({ ok: true, value: 11 });
    expect(N.parse('10010', D.get('binary')).value).toBe(18);
    expect(N.parse('11 1111 1111', D.get('binary')).value).toBe(1023);
    expect(N.parse('ff', D.get('hex')).value).toBe(255);
    expect(N.parse('2A', D.get('hex')).value).toBe(42);
    expect(N.parse('17', D.get('octal')).value).toBe(15);
    expect(N.parse('007', D.get('decimal')).value).toBe(7);
  });

  it('reads animal and color numbers by name (CONTENT 4.2, 4.3)', function () {
    var animals = D.get('animals');
    expect(N.parse('Dog-Cat', animals).value).toBe(5);
    expect(N.parse('Dog-Dog', animals).value).toBe(6);
    expect(N.parse('Dog-Frog', animals).value).toBe(7);
    expect(N.parse('frog pig', animals).value).toBe(13);
    expect(N.parse('Dog-Duck', animals).value).toBe(9);
    expect(N.parse(['Frog', 'Pig'], animals).value).toBe(13);
    expect(N.parse([2, 3], animals).value).toBe(13);
    expect(N.parse('Green-Green-Green', D.get('colors')).value).toBe(26);
    expect(N.parse('yellow yellow yellow', D.get('colors')).value).toBe(13);
  });

  it('rejects invalid digits with friendly messages', function () {
    expect(N.parse('8', D.get('octal'))).toEqual({ ok: false, error: "8 isn't a digit in octal: octal only uses 0–7!" });
    expect(N.parse('102', D.get('binary')).error).toBe("2 isn't a digit in binary: binary only uses 0–1!");
    expect(N.parse('G', D.get('hex')).error).toBe("G isn't a digit in hex: hex only uses 0–9 and A–F!");
    expect(N.parse('Cow-Dog', D.get('animals')).error)
      .toBe("Cow isn't a digit in the animal system: the animal system only uses Cat, Dog, Frog, Pig and Duck!");
    expect(N.parse('  ', D.get('decimal'))).toEqual({ ok: false, error: 'Type a number first!' });
    expect(N.parse('1.5', D.get('decimal')).ok).toBe(false);
  });

  it('returns BigInt for numbers too big for plain numbers', function () {
    var r = N.parse('FFFFFFFFFFFFFFFFFFFF', D.get('hex'));
    expect(r.ok).toBe(true);
    expect(r.value).toBe(2n ** 80n - 1n);
    expect(N.parse('12', D.get('decimal'), { bigint: true }).value).toBe(12n);
  });
});

describe('numeral: countSequence', function () {
  var N = NumSys.numeral;

  it('octal rolls over from 7 to 10 (CONTENT 3.1)', function () {
    var seq = N.countSequence(5, 9, 8);
    expect(seq.map(function (s) { return s.digits; })).toEqual([[0, 5], [0, 6], [0, 7], [1, 0], [1, 1]]);
    expect(seq[0].changedPlaces).toEqual([]);
    expect(seq[1].changedPlaces).toEqual([0]);
    expect(seq[3].changedPlaces).toEqual([0, 1]);
  });

  it('marks every place that rolls over (binary 7 -> 8)', function () {
    var seq = N.countSequence(7, 8, 2);
    expect(seq[1].digits).toEqual([1, 0, 0, 0]);
    expect(seq[1].changedPlaces).toEqual([0, 1, 2, 3]);
  });

  it('counts down too', function () {
    var seq = N.countSequence(10, 8, 10);
    expect(seq.map(function (s) { return s.n; })).toEqual([10, 9, 8]);
    expect(seq[1].changedPlaces).toEqual([0, 1]);
  });

  it('hex rolls E, F, 10, 11 (CONTENT 3.2)', function () {
    var seq = N.countSequence(14, 17, 16);
    expect(seq.map(function (s) { return s.digits; })).toEqual([[0, 14], [0, 15], [1, 0], [1, 1]]);
  });
});
