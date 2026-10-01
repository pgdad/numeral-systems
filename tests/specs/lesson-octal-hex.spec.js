describe('lesson: octal-hex', function () {
  var lesson = NumSys.lessons.get('octal-hex');
  var H = lesson.helpers;
  var split = NumSys.narrator.splitSentences;

  function steps() {
    var out = [];
    lesson.scenes.forEach(function (s) { out = out.concat(s.steps); });
    return out;
  }
  function fmt(n, set) { return NumSys.numeral.format(n, NumSys.digitsets.get(set)); }
  function scene(id) { return lesson.scenes.filter(function (s) { return s.id === id; })[0]; }

  it('is registered and valid', function () {
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(30);
    expect(lesson.theme).toBe('hex');
    expect(lesson.glyph).toBe('7F');
    expect(lesson.scenes.map(function (s) { return s.id; })).toEqual(['any', 'hex', 'nibbles', 'colors', 'try']);
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, false, false, false, true]);
  });

  it('has narration on every step, numbers in words', function () {
    expect(steps().length > 15).toBe(true);
    steps().forEach(function (st) {
      expect(st.say.trim().length > 0).toBe(true);
      expect(/\d/.test(st.say)).toBe(false);
    });
  });

  it('narration lasts a few minutes', function () {
    var ms = 0;
    steps().forEach(function (st) {
      split(st.say).forEach(function (sentence) { ms += NumSys.narrator.estimateMs(sentence, 1); });
    });
    expect(ms > 90000 && ms < 300000).toBe(true);
  });

  it('teaches A to F one letter per sentence, and the counts roll over on cue', function () {
    var letters = split(scene('hex').steps[2].say);
    expect(letters).toEqual(['A is ten.', 'B is eleven.', 'C is twelve.', 'D is thirteen.', 'E is fourteen.', 'F is fifteen.']);
    letters.forEach(function (line, v) {
      expect(line).toBe(NumSys.digitsets.digitName(v + 10, 'hex') + ' is ' + NumSys.digitsets.speak(v + 10, 'decimal') + '.');
    });
    // Hex count: D -> E (cue 1), F (cue 2), 10 (cue 4), 11 (cue 6).
    var hex = split(scene('hex').steps[3].say);
    expect([hex[1], hex[2], hex[4], hex[6]]).toEqual(['E.', 'F.', 'One-zero!', 'One-one.']);
    expect(fmt(H.HEX_FROM + 3, 'hex')).toBe('10');
    expect(H.HEX_FROM + 4).toBe(H.HEX_TO);
    // Octal count: 4 -> 5, 6, 7 (cues 1-3), 10 (cue 6), 11 (cue 8).
    var oct = split(scene('any').steps[3].say);
    expect([oct[1], oct[2], oct[3], oct[6], oct[8]]).toEqual(['Five.', 'Six.', 'Seven.', 'So we write one-zero.', 'One-one.']);
    expect(fmt(H.OCT_FROM + 4, 'octal')).toBe('10');
    expect(fmt(H.OCT_TO, 'octal')).toBe('11');
    expect(H.OCT_FROM + 5).toBe(H.OCT_TO);
  });

  it('groups binary digits into nibbles from the right', function () {
    expect(H.nibbles(1023)).toEqual(['11', '1111', '1111']);
    expect(H.nibbleHex(1023)).toEqual(['3', 'F', 'F']);
    expect(H.nibbles(0xFA)).toEqual(['1111', '1010']);
    expect(H.nibbleHex(0xFA)).toEqual(['F', 'A']);
    expect(H.nibbles(5)).toEqual(['101']);
    expect(H.nibbles(16)).toEqual(['1', '0000']);
    // Regrouping is the same as writing the number in hex.
    for (var n = 1; n <= 5000; n += 7) {
      expect(H.nibbleHex(n).join('')).toBe(fmt(n, 'hex'));
      expect(H.nibbles(n).join('')).toBe(n.toString(2));
      H.nibbles(n).slice(1).forEach(function (g) { expect(g.length).toBe(4); });
    }
    var say = scene('nibbles').steps[4].say;
    expect(say).toContain('three F F');
    expect(H.ALL_TEN).toBe(NumSys.hands.fingerValues(10).reduce(function (a, b) { return a + b; }, 0));
  });

  it('writes and reads color codes', function () {
    expect(H.hex2(0)).toBe('00');
    expect(H.hex2(10)).toBe('0A');
    expect(H.hex2(255)).toBe('FF');
    expect(H.rgbToCode([255, 136, 0])).toBe('#FF8800');
    expect(H.codeToRgb('#FF8800')).toEqual([255, 136, 0]);
    expect(H.codeToRgb('f80')).toEqual([255, 136, 0]);
    expect(H.codeToRgb('#12345')).toBe(null);
    expect(H.speakPair(255)).toBe('F F');
    expect(H.speakPair(8)).toBe('zero eight');
    expect(H.speakCode([255, 255, 0])).toBe('F F, F F, zero zero');
  });

  it('matches colors with a tolerance', function () {
    var C = {};
    H.COLOR_CHALLENGES.forEach(function (c) { C[c.id] = c; });
    expect(H.colorDistance([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(H.colorDistance([255, 0, 0], [255, 3, 4])).toBe(5);
    // Yellow: exact, close, and not close enough.
    expect(H.colorMatches(C.yellow, [255, 255, 0])).toBe(true);
    expect(H.colorMatches(C.yellow, [238, 238, 34])).toBe(true);
    expect(H.colorMatches(C.yellow, [255, 200, 0])).toBe(true);
    expect(H.colorMatches(C.yellow, [255, 170, 0])).toBe(false);
    expect(H.colorMatches(C.yellow, [255, 0, 0])).toBe(false);
    // White and black.
    expect(H.colorMatches(C.white, [221, 238, 255])).toBe(true);
    expect(H.colorMatches(C.white, [170, 170, 170])).toBe(false);
    expect(H.colorMatches(C.black, [17, 17, 34])).toBe(true);
    expect(H.colorMatches(C.black, [85, 0, 0])).toBe(false);
    // Purple: any red ≈ blue with little green.
    expect(H.colorMatches(C.purple, [128, 0, 128])).toBe(true);
    expect(H.colorMatches(C.purple, [153, 0, 204])).toBe(true);
    expect(H.colorMatches(C.purple, [255, 0, 255])).toBe(true);
    expect(H.colorMatches(C.purple, [255, 0, 0])).toBe(false);
    expect(H.colorMatches(C.purple, [0, 0, 255])).toBe(false);
    expect(H.colorMatches(C.purple, [200, 200, 200])).toBe(false);
    expect(H.colorMatches(C.purple, [40, 0, 40])).toBe(false);
    // Every "Show me" answer solves its own challenge; free play never matches by itself.
    H.COLOR_CHALLENGES.forEach(function (c) {
      if (c.free) expect(H.colorMatches(c, [1, 2, 3])).toBe(false);
      else expect(H.colorMatches(c, c.show)).toBe(true);
    });
    expect(H.COLOR_CHALLENGES.map(function (c) { return c.id; })).toEqual(['yellow', 'purple', 'white', 'black', 'favorite']);
  });

  it('writes challenge prompts and skips challenges that are already met', function () {
    expect(H.challengeText(H.COLOR_CHALLENGES[0])).toBe('Can you make yellow?');
    expect(H.challengeText(H.COLOR_CHALLENGES[4])).toMatch(/favorite color/);
    expect(H.nextChallenge(-1, [255, 0, 0])).toBe(0);
    expect(H.nextChallenge(0, [255, 255, 0])).toBe(1);
    // After purple comes white; but if the color is already white, skip to black.
    expect(H.nextChallenge(1, [255, 255, 255])).toBe(3);
    expect(H.nextChallenge(4, [0, 0, 0])).toBe(0);
  });

  it('steps channels by 0x11 and keeps the counter in range', function () {
    expect(H.stepChannel(0, 1)).toBe(17);
    expect(H.stepChannel(238, 1)).toBe(255);
    expect(H.stepChannel(255, 1)).toBe(255);
    expect(H.stepChannel(20, 1)).toBe(34);
    expect(H.stepChannel(20, -1)).toBe(17);
    expect(H.stepChannel(17, -1)).toBe(0);
    expect(H.stepChannel(0, -1)).toBe(0);
    expect(H.hex2(H.stepChannel(H.stepChannel(0, 1), 1))).toBe('22');
    expect(H.COUNTER_MAX).toBe(4095);
    expect(fmt(H.COUNTER_MAX, 'octal')).toBe('7777');
    expect(fmt(H.COUNTER_MAX, 'hex')).toBe('FFF');
    expect(H.counterNext(0, -1)).toBe(0);
    expect(H.counterNext(4090, 10)).toBe(4095);
    expect(H.counterNext(15, 1)).toBe(16);
  });

  it('notices rollovers', function () {
    expect(H.changedPlaces(15, 16, 16)).toBe(2);   // F -> 10
    expect(H.changedPlaces(14, 15, 16)).toBe(1);
    expect(H.changedPlaces(7, 8, 8)).toBe(2);      // 7 -> 10
    expect(H.changedPlaces(9, 10, 10)).toBe(2);
    expect(H.changedPlaces(255, 256, 16)).toBe(3); // FF -> 100
    expect(H.changedPlaces(16, 15, 16)).toBe(2);   // counting down rolls back
  });
});
