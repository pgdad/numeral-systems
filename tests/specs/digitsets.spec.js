describe('digitsets: built-ins', function () {
  var D = NumSys.digitsets;

  it('has the six built-in systems with the right bases', function () {
    var bases = {};
    D.list().forEach(function (s) { bases[s.id] = s.base; });
    expect(bases.decimal).toBe(10);
    expect(bases.binary).toBe(2);
    expect(bases.octal).toBe(8);
    expect(bases.hex).toBe(16);
    expect(bases.animals).toBe(5);
    expect(bases.colors).toBe(3);
  });

  it('animals are cat, dog, frog, pig, duck with sounds (DECISIONS D6)', function () {
    var a = D.get('animals');
    expect(a.digits.map(function (d) { return d.icon; })).toEqual(['cat', 'dog', 'frog', 'pig', 'duck']);
    expect(a.digits.map(function (d) { return d.sound; })).toEqual(['meow', 'woof', 'ribbit', 'oink', 'quack']);
  });

  it('colors are red circle, yellow triangle, green square (DECISIONS D6)', function () {
    var c = D.get('colors');
    expect(c.digits.map(function (d) { return d.name + ' ' + d.shape; }))
      .toEqual(['red circle', 'yellow triangle', 'green square']);
    c.digits.forEach(function (d) { expect(d.color).toMatch(/^#[0-9a-f]{6}$/i); });
  });

  it('hex digits A–F have values 10–15', function () {
    var h = D.get('hex');
    expect(h.digits.slice(10).map(function (d) { return d.label + d.value; }))
      .toEqual(['A10', 'B11', 'C12', 'D13', 'E14', 'F15']);
  });

  it('every built-in set validates', function () {
    D.list().forEach(function (s) { D.validate(s); });
    expect(D.list().length >= 6).toBe(true);
  });
});

describe('digitsets: speak', function () {
  var D = NumSys.digitsets;

  it('reads numbers aloud in each system (CONTENT examples)', function () {
    expect(D.speak(11, 'binary')).toBe('one-zero-one-one');
    expect(D.speak(13, 'binary')).toBe('one-one-zero-one');
    expect(D.speak(1023, 'binary')).toBe('one-one-one-one-one-one-one-one-one-one');
    expect(D.speak(42, 'hex')).toBe('two A');
    expect(D.speak(1023, 'hex')).toBe('three F F');
    expect(D.speak(13, 'animals')).toBe('Frog-Pig');
    expect(D.speak(20, 'animals')).toBe('Duck-Cat');
    expect(D.speak(13, 'colors')).toBe('yellow-yellow-yellow');
    expect(D.speak(15, 'octal')).toBe('one-seven');
    expect(D.speak(237, 'decimal')).toBe('two hundred thirty-seven');
    expect(D.speak(0, 'animals')).toBe('Cat');
  });

  it('numberToWords covers 0..9999', function () {
    var W = D.numberToWords;
    expect(W(0)).toBe('zero');
    expect(W(13)).toBe('thirteen');
    expect(W(42)).toBe('forty-two');
    expect(W(100)).toBe('one hundred');
    expect(W(105)).toBe('one hundred five');
    expect(W(1023)).toBe('one thousand twenty-three');
    expect(W(2000)).toBe('two thousand');
    expect(W(9999)).toBe('nine thousand nine hundred ninety-nine');
    expect(W(12345)).toBe('one two three four five');
    expect(W(42n)).toBe('forty-two');
  });

  it('digitName gives a single digit', function () {
    expect(D.digitName(10, 'hex')).toBe('A');
    expect(D.digitName(2, 'animals')).toBe('Frog');
    expect(D.digitName(7, 'decimal')).toBe('seven');
  });
});

describe('digitsets: custom sets', function () {
  var D = NumSys.digitsets;

  function robot() {
    return {
      id: 'test-robot', name: 'Robot-Banana-Rocket', base: 3, kind: 'icon',
      digits: [
        { value: 0, label: 'Robot', speak: 'Robot', icon: 'robot' },
        { value: 1, label: 'Banana', speak: 'Banana', icon: 'banana' },
        { value: 2, label: 'Rocket', speak: 'Rocket', icon: 'rocket' }
      ]
    };
  }

  it('registers, converts with and removes a custom set', function () {
    var set = D.register(robot());
    expect(D.get('test-robot')).toBe(set);
    expect(NumSys.numeral.parse('Banana-Rocket', set).value).toBe(5);
    expect(D.speak(5, 'test-robot')).toBe('Banana-Rocket');
    D.unregister('test-robot');
    expect(D.get('test-robot')).toBe(null);
  });

  it('refuses to remove built-ins', function () {
    expect(function () { D.unregister('binary'); }).toThrow('built-in');
  });

  it('validation catches the common mistakes', function () {
    var s = robot(); s.digits.pop();
    expect(function () { D.validate(s); }).toThrow('exactly 3 digits');
    s = robot(); s.digits[2].label = 'robot';
    expect(function () { D.validate(s); }).toThrow('share the label');
    s = robot(); delete s.digits[1].icon;
    expect(function () { D.validate(s); }).toThrow('needs an icon');
    s = robot(); s.digits[1].value = 5;
    expect(function () { D.validate(s); }).toThrow('must have value 1');
    s = robot(); s.kind = 'text';
    expect(function () { D.validate(s); }).toThrow('single character');
    s = robot(); s.kind = 'color';
    expect(function () { D.validate(s); }).toThrow('color and a shape');
    s = robot(); s.base = 1;
    expect(function () { D.validate(s); }).toThrow('base must be');
  });
});
