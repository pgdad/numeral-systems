// Visual components (Phase 03): pure helpers in Node, and DOM behavior in the browser runner.
describe('icons', function () {
  var I = NumSys.icons;

  it('has every icon the plan asks for', function () {
    ['cat', 'dog', 'frog', 'pig', 'duck', 'cow', 'owl', 'fish', 'bee', 'snail', 'unicorn', 'robot',
      'star', 'heart', 'banana', 'rocket'].forEach(function (n) { expect(I.names('art')).toContain(n); });
    ['circle', 'triangle', 'square', 'diamond', 'star', 'hexagon'].forEach(function (n) { expect(I.names('shape')).toContain(n); });
    ['play', 'pause', 'next', 'prev', 'replay', 'speaker', 'home', 'fullscreen', 'hands', 'star'].forEach(function (n) {
      expect(I.names('ui')).toContain(n);
    });
  });

  it('every digit-set icon and shape exists', function () {
    NumSys.digitsets.list().forEach(function (set) {
      set.digits.forEach(function (d) {
        if (d.icon) expect(I.has(d.icon)).toBe(true);
        if (d.shape) expect(I.names('shape')).toContain(d.shape);
      });
    });
  });

  it('art is made of plain SVG shapes only (no images, no external refs)', function () {
    var ok = { circle: 1, ellipse: 1, rect: 1, path: 1, line: 1, polygon: 1, g: 1 };
    Object.keys(I.ART).forEach(function (name) {
      I.ART[name].nodes.forEach(function (n) {
        if (!ok[n[0]]) throw new Error(name + ' uses <' + n[0] + '>');
        Object.keys(n[1]).forEach(function (k) { if (/href|src/i.test(k)) throw new Error(name + ' has ' + k); });
      });
    });
  });
});

describe('place names', function () {
  var P = NumSys.digitsets.placeName;
  it('names places in any base', function () {
    expect([0, 1, 2, 3].map(function (p) { return P(p, 10); })).toEqual(['Ones', 'Tens', 'Hundreds', 'Thousands']);
    expect([0, 1, 2, 3, 4].map(function (p) { return P(p, 2); })).toEqual(['Ones', 'Twos', 'Fours', 'Eights', 'Sixteens']);
    expect([0, 1, 2].map(function (p) { return P(p, 5); })).toEqual(['Ones', 'Fives', 'Twenty-fives']);
    expect(P(1, 16)).toBe('Sixteens');
    expect(P(1, 6)).toBe('Sixes');
    expect(P(2, 10, { plural: false })).toBe('Hundred');
    expect(P(9, 2, { style: 'number' })).toBe('512s');
  });
});

describe('column-add layout', function () {
  var L = NumSys.columnAdd.layout;
  it('lines up digits and leaves room for a final carry', function () {
    var l = L(47, 38, 10);
    expect(l.width).toBe(2);
    expect(l.a).toEqual([4, 7]);
    expect(l.b).toEqual([3, 8]);
    expect(l.sum).toEqual([8, 5]);
    var m = L(999, 1, 10);
    expect(m.width).toBe(4);
    expect(m.a).toEqual([null, 9, 9, 9]);
    expect(m.b).toEqual([null, null, null, 1]);
    expect(m.sum).toEqual([1, 0, 0, 0]);
    expect(m.steps[3].finalCarry).toBe(true);
  });
  it('works in hex and base 5', function () {
    expect(L(0x2A, 0x1F, 16).sum).toEqual([4, 9]);
    expect(L(8, 7, 5).sum).toEqual([3, 0]);
  });
  it('contribution text', function () {
    expect(NumSys.placeValue.contributionText(2, 2, 10)).toBe('200');
    expect(NumSys.placeValue.contributionText(1, 3, 2)).toBe('8');
  });
});

describe('components in the DOM (browser only)', function () {
  var hasDom = typeof document !== 'undefined';
  var I = { instant: true };

  it('symbols render text, icon and color digits', function () {
    if (!hasDom) return;
    var S = NumSys.symbols;
    expect(S.renderValue(10, 'hex').textContent).toBe('A');
    expect(S.renderValue(2, 'animals').getAttribute('aria-label')).toBe('Frog');
    expect(S.renderValue(1, 'colors').classList.contains('symbol-color')).toBe(true);
    expect(S.strip(13, 'animals').children.length).toBe(2);
    expect(S.strip(13, 'animals').getAttribute('aria-label')).toBe('Frog-Pig');
  });

  it('digit tile flips to a new digit (instant)', function () {
    if (!hasDom) return;
    var t = NumSys.digitTile.create({ set: 'hex', value: 3 });
    return t.flipTo(11, I).then(function () {
      expect(t.value).toBe(11);
      expect(t.el.textContent).toBe('B');
    });
  });

  it('odometer steps, wraps and runs', function () {
    if (!hasDom) return;
    var o = NumSys.odometer.create({ set: 'decimal', places: 3, value: 998 });
    return o.step(1, I).then(function () {
      expect(o.value).toBe(999);
      return o.step(1, I);
    }).then(function () {
      expect(o.value).toBe(0);
      expect(o.el.textContent.replace(/[^0-9]/g, '')).toBe('000');
      return o.runTo(25, I);
    }).then(function () {
      expect(o.value).toBe(25);
      var b = NumSys.odometer.create({ set: 'binary', places: 4, labels: 'names' });
      expect(b.el.querySelector('.odo-place[data-power="3"] .odo-label').textContent).toBe('Eights');
    });
  });

  it('place-value board sets, expands and regroups', function () {
    if (!hasDom) return;
    var pv = NumSys.placeValue.create({ set: 'decimal', value: 237, places: 3, units: true });
    expect(pv.el.querySelector('.pv-sum').textContent).toBe('200+30+7=237');
    return pv.expand(I).then(function () {
      expect(pv.isExpanded()).toBe(true);
      return pv.set(9, I);
    }).then(function () {
      return pv.setUnits(0, 10, I);
    }).then(function () {
      return pv.regroup(0, I);
    }).then(function () {
      expect(pv.value).toBe(10);
      expect(pv.units(0)).toBe(0);
      expect(pv.units(1)).toBe(1);
      expect(pv.tile(1).value).toBe(1);
    });
  });

  it('column-add plays every step to the right answer (instant)', function () {
    if (!hasDom) return;
    var ca = NumSys.columnAdd.create({ set: 'decimal', a: 999, b: 1 });
    return ca.playAll(I).then(function () {
      var digits = ca.resultEl().slice().reverse().map(function (c) { return c.textContent; }).join('');
      expect(digits).toBe('1000');
      expect(ca.played).toBe(4);
      expect(ca.el.querySelectorAll('.ca-carry .ca-carry-sym').length).toBe(3);
      ca.reset();
      expect(ca.played).toBe(0);
    });
  });

  it('column-add with animals carries a Dog', function () {
    if (!hasDom) return;
    var ca = NumSys.columnAdd.create({ set: 'animals', a: 8, b: 7 });
    return ca.next(I).then(function () {
      var carry = ca.el.querySelector('.ca-carry-sym');
      expect(carry.getAttribute('aria-label')).toBe('Dog');
    });
  });

  it('readout shows one number in several systems', function () {
    if (!hasDom) return;
    var r = NumSys.readout.create({ systems: ['decimal', 'binary', 'hex'], value: 11 });
    expect(r.el.textContent).toBe('Decimal11Binary1011HexB');
    return r.set(255, I).then(function () {
      expect(r.el.textContent).toBe('Decimal255Binary1111 1111HexFF');
    });
  });
});
