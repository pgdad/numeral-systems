describe('lesson: binary', function () {
  var lesson = NumSys.lessons.get('binary');
  var H = lesson.helpers;
  var split = NumSys.narrator.splitSentences;
  var hands = NumSys.hands;

  function steps() {
    var out = [];
    lesson.scenes.forEach(function (s) { out = out.concat(s.steps); });
    return out;
  }
  // D5: only the middle finger up (4 or 128 alone).
  function middleOnly(n) { return n === 4 || n === 128; }

  it('is registered and valid', function () {
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(20);
    expect(lesson.theme).toBe('binary');
    expect(lesson.scenes.map(function (s) { return s.id; })).toEqual(['switches', 'values', 'count', 'high', 'reading', 'try', 'know']);
  });

  it('has narration on every step, numbers in words', function () {
    expect(steps().length > 15).toBe(true);
    steps().forEach(function (st) {
      expect(st.say.trim().length > 0).toBe(true);
      expect(/\d/.test(st.say)).toBe(false);
    });
  });

  it('has one interactive scene, followed by "Did you know?"', function () {
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, false, false, false, false, true, false]);
  });

  it('narration lasts a few minutes', function () {
    var ms = 0;
    steps().forEach(function (st) {
      split(st.say).forEach(function (sentence) { ms += NumSys.narrator.estimateMs(sentence, 1); });
    });
    expect(ms > 120000 && ms < 360000).toBe(true);
  });

  it('presents 1023 correctly: all ten finger values add up to it', function () {
    expect(H.MAX).toBe(1023);
    expect(H.bitValues(1023)).toEqual([512, 256, 128, 64, 32, 16, 8, 4, 2, 1]);
    expect(H.bitValues(1023).reduce(function (a, b) { return a + b; }, 0)).toBe(1023);
    expect(hands.fingerValues(10)).toEqual(H.bitValues(1023));
    var add = lesson.scenes[3].steps[1].say;
    expect(split(add).length).toBe(11);
    expect(split(add)[1]).toBe('Five hundred twelve.');
    expect(split(add)[10]).toBe('And one.');
    expect(lesson.scenes[3].steps[2].say).toContain('one thousand twenty-three');
    expect(lesson.scenes[3].steps[3].say).toContain('one thousand twenty-four');
  });

  it('breaks numbers into finger values', function () {
    expect(H.bitValues(0)).toEqual([]);
    expect(H.bitValues(11)).toEqual([8, 2, 1]);
    expect(H.bitValues(18)).toEqual([16, 2]);
    expect(H.bitValues(100)).toEqual([64, 32, 4]);
    expect(H.placeTerms(11)).toEqual([8, 0, 2, 1]);
    expect(H.placeTerms(0)).toEqual([0]);
    expect(H.breakdown(11)).toBe('8 + 2 + 1 = 11');
    expect(H.breakdown(11, true)).toBe('8 + 0 + 2 + 1 = 11');
    expect(H.breakdown(16)).toBe('16');
    expect(H.breakdown(0)).toBe('0');
    expect(H.sayBreakdown(5)).toBe('four plus one makes five');
    expect(H.sayBreakdown(512)).toBe('five hundred twelve');
    for (var n = 0; n <= 1023; n++) {
      expect(H.bitValues(n).reduce(function (a, b) { return a + b; }, 0)).toBe(n);
    }
  });

  it('spot-checks finger states (D5) for the numbers the lesson uses', function () {
    function up(n) {
      return hands.bitsToFingers(n).map(function (b, i) { return b ? hands.displayOrder('both')[i] : null; })
        .filter(Boolean).map(function (f) { return f.hand + ' ' + f.finger; });
    }
    expect(up(1)).toEqual(['right pinky']);
    expect(up(2)).toEqual(['right ring']);
    expect(up(3)).toEqual(['right ring', 'right pinky']);
    expect(up(4)).toEqual(['right middle']);
    expect(up(5)).toEqual(['right middle', 'right pinky']);
    expect(up(11)).toEqual(['right index', 'right ring', 'right pinky']);
    expect(up(18)).toEqual(['right thumb', 'right ring']);
    expect(up(31)).toEqual(['right thumb', 'right index', 'right middle', 'right ring', 'right pinky']);
    expect(up(100)).toEqual(['left index', 'left thumb', 'right middle']);
    expect(up(1023).length).toBe(10);
  });

  it('dims the leading zeros of the binary readout', function () {
    expect(H.leadingZeros(0)).toBe(9);
    expect(H.leadingZeros(1)).toBe(9);
    expect(H.leadingZeros(11)).toBe(6);
    expect(H.leadingZeros(1023)).toBe(0);
  });

  it('never rests on 4 or 128 alone (D5)', function () {
    H.EXAMPLES.forEach(function (n) { expect(middleOnly(n)).toBe(false); });
    expect(middleOnly(H.COUNT_TO)).toBe(false);
    H.CHALLENGES.forEach(function (ch) { if (ch.kind === 'show') expect(middleOnly(ch.target)).toBe(false); });
    for (var age = 1; age <= H.AGE_MAX; age++) expect(middleOnly(H.ageTarget(age))).toBe(false);
  });

  it('counts faster and faster', function () {
    expect(H.tickMs(0) > H.tickMs(10)).toBe(true);
    expect(H.tickMs(100)).toBe(250);
  });

  it('has the planned challenges, all reachable', function () {
    var shows = H.CHALLENGES.filter(function (c) { return c.kind === 'show'; }).map(function (c) { return c.target; });
    expect(shows.slice(0, 4)).toEqual([5, 10, 100, 1023]);
    expect(H.CHALLENGES[2]).toEqual({ kind: 'age' });
    shows.forEach(function (t) { expect(t >= 1 && t <= 1023).toBe(true); });
  });

  it('handles the age challenge', function () {
    var age = { kind: 'age' };
    expect(H.ageTarget(7)).toBe(7);
    expect(H.ageTarget(4)).toBe(5);
    expect(H.ageTarget(0)).toBe(null);
    expect(H.ageTarget(121)).toBe(null);
    expect(H.ageTarget(7.5)).toBe(null);
    expect(H.targetOf(age, { bits: 0, age: null })).toBe(null);
    expect(H.isMet(age, { bits: 0, age: null })).toBe(false);
    expect(H.isMet(age, { bits: 9, age: 9 })).toBe(true);
    expect(H.isMet(age, { bits: 4, age: 4 })).toBe(false);
    expect(H.isMet(age, { bits: 5, age: 4 })).toBe(true);
    expect(H.challengeText(age, { age: null })).toMatch(/How old are you/);
    expect(H.challengeText(age, { age: 9 })).toBe('You are nine! Show nine on your fingers!');
    expect(H.challengeText(age, { age: 4 })).toMatch(/Show five/);
  });

  it('writes challenge prompts in words and checks them against the fingers', function () {
    expect(H.challengeText({ kind: 'show', target: 5 })).toBe('Show five on your fingers!');
    expect(H.challengeText({ kind: 'show', target: 1023 })).toMatch(/^Show one thousand twenty-three/);
    expect(H.isMet({ kind: 'show', target: 5 }, { bits: 5 })).toBe(true);
    expect(H.isMet({ kind: 'show', target: 5 }, { bits: 4 })).toBe(false);
  });

  it('picks the next challenge, skipping met ones, waiting on an unanswered age', function () {
    var s = { bits: 0, age: null };
    expect(H.nextChallenge(1, s)).toBe(2);
    expect(H.nextChallenge(0, { bits: 10, age: null })).toBe(2);
    expect(H.nextChallenge(1, { bits: 9, age: 9 })).toBe(3);
    var i = H.nextChallenge(-1, s);
    for (var k = 0; k < 20; k++) {
      var next = H.nextChallenge(i, s);
      expect(next === i).toBe(false);
      i = next;
    }
  });

  it('lines up a spot under every finger, left to right', function () {
    var spots = hands.fingerSpots('both');
    expect(spots.length).toBe(10);
    spots.forEach(function (x, i) {
      expect(x > 0 && x < 1).toBe(true);
      if (i) expect(x > spots[i - 1]).toBe(true);
    });
    expect(hands.fingerSpots('right').length).toBe(5);
  });
});
