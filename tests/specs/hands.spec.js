// Hands: finger/bit mapping (DECISIONS D5) and, in a browser, the component itself.
describe('hands: finger logic (D5)', function () {
  var H = NumSys.hands;
  var ORDER = ['left pinky', 'left ring', 'left middle', 'left index', 'left thumb',
    'right thumb', 'right index', 'right middle', 'right ring', 'right pinky'];

  function up(n) {
    var f = H.bitsToFingers(n);
    return ORDER.filter(function (name, i) { return f[i]; });
  }

  it('display order runs left pinky ... right pinky', function () {
    expect(H.displayOrder('both').map(function (p) { return p.hand + ' ' + p.finger; })).toEqual(ORDER);
    expect(H.displayOrder('left').length).toBe(5);
    expect(H.displayOrder('right')[0]).toEqual({ hand: 'right', finger: 'thumb' });
  });

  it('finger values: right pinky = 1 ... left pinky = 512', function () {
    expect(H.fingerValues(10)).toEqual([512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
    expect(H.fingerValues(5)).toEqual([16, 8, 4, 2, 1]);
  });

  it('spot checks 1, 5, 11, 512, 1023', function () {
    expect(up(0)).toEqual([]);
    expect(up(1)).toEqual(['right pinky']);
    expect(up(5)).toEqual(['right middle', 'right pinky']);
    expect(up(11)).toEqual(['right index', 'right ring', 'right pinky']);
    expect(up(512)).toEqual(['left pinky']);
    expect(up(1023)).toEqual(ORDER);
    expect(up(16)).toEqual(['right thumb']);
    expect(up(32)).toEqual(['left thumb']);
  });

  it('bitsToFingers reads like the binary digits', function () {
    expect(H.bitsToFingers(11).map(function (b) { return b ? '1' : '0'; }).join('')).toBe('0000001011');
  });

  it('round-trips every number 0..1023', function () {
    for (var n = 0; n <= 1023; n++) {
      if (H.fingersToBits(H.bitsToFingers(n)) !== n) throw new Error('round trip failed at ' + n);
    }
  });

  it('rejects numbers the fingers cannot show', function () {
    expect(function () { H.bitsToFingers(1024); }).toThrow(/0 to 1023/);
    expect(function () { H.bitsToFingers(-1); }).toThrow();
    expect(function () { H.bitsToFingers(32, 5); }).toThrow(/0 to 31/);
  });

  it('base-10 counting raises fingers left to right', function () {
    expect(H.countToFingers(0)).toEqual([false, false, false, false, false, false, false, false, false, false]);
    expect(H.countToFingers(3)).toEqual([true, true, true, false, false, false, false, false, false, false]);
    expect(H.countToFingers(5, 5)).toEqual([true, true, true, true, true]);
    expect(function () { H.countToFingers(11); }).toThrow();
  });

  it('finds fingers by hand and name', function () {
    expect(H.fingerIndex('left', 'pinky')).toBe(0);
    expect(H.fingerIndex('right', 'pinky')).toBe(9);
    expect(H.fingerIndex('right', 'thumb')).toBe(5);
    expect(H.fingerIndex('right', 'thumb', 'right')).toBe(0);
    expect(H.fingerIndex('left', 'thumb', 'right')).toBe(-1);
  });

  it('has several skin tones and a valid default', function () {
    expect(H.SKIN_TONES.length >= 4).toBe(true);
    expect(H.SKIN_TONES.some(function (t) { return t.id === H.getSkinTone(); })).toBe(true);
  });
});

describe('hands: component (browser only)', function () {
  var hasDom = typeof document !== 'undefined';

  it('setBits shows the right fingers and reports them back', function () {
    if (!hasDom) return;
    var h = NumSys.hands.create({ hands: 'both', bits: 0 });
    return h.setBits(11, { instant: true }).then(function () {
      expect(h.getBits()).toBe(11);
      var down = Array.prototype.map.call(h.el.querySelectorAll('.hand-finger'), function (g) { return g.classList.contains('is-down'); });
      expect(down.filter(function (d) { return !d; }).length).toBe(3);
      expect(h.svg.getAttribute('aria-label')).toMatch(/3 fingers up/);
      return h.setFingers(10, { instant: true });
    }).then(function () {
      expect(h.getBits()).toBe(1023);
    });
  });

  it('setFinger, labels and a single hand', function () {
    if (!hasDom) return;
    var h = NumSys.hands.create({ hands: 'right', fingers: 0 });
    expect(h.count).toBe(5);
    return h.setFinger('right', 'pinky', true, { instant: true }).then(function () {
      expect(h.getBits()).toBe(1);
      return h.labels(true, null, { instant: true });
    }).then(function () {
      var texts = Array.prototype.map.call(h.el.querySelectorAll('.hand-badge-text'), function (t) { return t.textContent; });
      expect(texts).toEqual(['16', '8', '4', '2', '1']);
      expect(function () { h.setFinger('left', 'thumb', true); }).toThrow(/not shown/);
    });
  });

  it('onToggle makes fingers clickable buttons', function () {
    if (!hasDom) return;
    var h = NumSys.hands.create({ hands: 'both', bits: 0 });
    var got = null;
    var off = h.onToggle(function (info) { got = info; });
    var pinky = h.fingerAt(9).outer; // display index 9 = right pinky
    expect(pinky.getAttribute('role')).toBe('button');
    pinky.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(got.bits).toBe(1);
    expect(got.hand + ' ' + got.finger).toBe('right pinky');
    off();
    expect(pinky.getAttribute('role')).toBe(null);
  });
});
