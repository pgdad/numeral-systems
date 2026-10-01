describe('lesson: base10', function () {
  var lesson = NumSys.lessons.get('base10');
  var H = lesson.helpers;
  var split = NumSys.narrator.splitSentences;

  it('is registered and valid, with the home card icon', function () {
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(10);
    expect(lesson.glyph).toBe('icon:hands');
    expect(NumSys.icons.has('hands')).toBeTruthy();
    expect(lesson.scenes.map(function (s) { return s.id; })).toEqual(['hello', 'digits', 'bundle', 'meaning', 'try']);
  });

  it('has more than 10 steps, every one with narration', function () {
    var steps = [];
    lesson.scenes.forEach(function (s) { steps = steps.concat(s.steps); });
    expect(steps.length > 10).toBe(true);
    steps.forEach(function (st) { expect(st.say.trim().length > 0).toBe(true); });
  });

  it('only the last scene is interactive', function () {
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, false, false, false, true]);
  });

  it('spells numbers as words, and counts one number per sentence (for cues)', function () {
    lesson.scenes.forEach(function (s) {
      s.steps.forEach(function (st) { expect(/\d/.test(st.say)).toBe(false); });
    });
    var count = lesson.scenes[0].steps[1].say;
    expect(split(count).slice(1)).toEqual(['One.', 'Two.', 'Three.', 'Four.', 'Five.', 'Six.', 'Seven.', 'Eight.', 'Nine.', 'Ten!']);
    expect(split(lesson.scenes[1].steps[1].say).length).toBe(10);
    expect(split(lesson.scenes[2].steps[2].say).slice(1)).toEqual(['Eleven.', 'Twelve.', 'Thirteen.', 'Fourteen.', 'Fifteen.']);
    expect(split(lesson.scenes[3].steps[1].say).length).toBe(3);
    expect(lesson.scenes[3].steps[2].say).toBe('Two hundred, plus thirty, plus seven, makes two hundred thirty-seven.');
    expect(lesson.scenes[3].steps[3].say).toContain('three hundred five');
  });

  it('narration for the whole lesson lasts about 3 to 5 minutes', function () {
    var ms = 0;
    lesson.scenes.forEach(function (s) {
      s.steps.forEach(function (st) {
        split(st.say).forEach(function (sentence) { ms += NumSys.narrator.estimateMs(sentence, 1); });
      });
    });
    // Narration only; animations, gaps between steps and the interactive scene add more.
    expect(ms > 100000 && ms < 300000).toBe(true);
  });

  it('writes challenge prompts in words', function () {
    expect(H.challengeText({ kind: 'fingers', target: 7 })).toBe('Show me seven fingers!');
    expect(H.challengeText({ kind: 'fingers', target: 1 })).toBe('Show me one finger!');
    expect(H.challengeText({ kind: 'fingers', target: 0 })).toMatch(/zero fingers/);
    expect(H.challengeText({ kind: 'board', target: 42 })).toBe('Make the number forty-two!');
    expect(H.challengeText({ kind: 'board', target: 305 })).toBe('Make the number three hundred five!');
  });

  it('checks challenges against the fingers or the board', function () {
    expect(H.isMet({ kind: 'fingers', target: 7 }, { fingers: 7, board: 0 })).toBe(true);
    expect(H.isMet({ kind: 'fingers', target: 7 }, { fingers: 6, board: 7 })).toBe(false);
    expect(H.isMet({ kind: 'board', target: 42 }, { fingers: 42, board: 0 })).toBe(false);
    expect(H.isMet({ kind: 'board', target: 42 }, { fingers: 0, board: 42 })).toBe(true);
  });

  it('every challenge is reachable (0-10 fingers, 0-999 on the board)', function () {
    H.CHALLENGES.forEach(function (ch) {
      var max = ch.kind === 'fingers' ? 10 : 999;
      expect(ch.target >= 0 && ch.target <= max).toBe(true);
    });
    expect(H.CHALLENGES[0]).toEqual({ kind: 'fingers', target: 7 });
  });

  it('picks the next challenge, skipping ones that are already done, and wraps around', function () {
    var list = [{ kind: 'fingers', target: 3 }, { kind: 'board', target: 5 }, { kind: 'fingers', target: 0 }];
    expect(H.nextChallenge(-1, { fingers: 0, board: 0 }, list)).toBe(0);
    expect(H.nextChallenge(0, { fingers: 3, board: 0 }, list)).toBe(1);
    // Fingers are already at zero, so "zero fingers" is skipped and we wrap to the first one.
    expect(H.nextChallenge(1, { fingers: 0, board: 5 }, list)).toBe(0);
    // Everything met: just move on.
    expect(H.nextChallenge(0, { fingers: 3, board: 5 }, [list[0], list[1]])).toBe(1);
    // The real list never repeats the same challenge twice in a row.
    var s = { fingers: 0, board: 0 };
    var i = H.nextChallenge(-1, s);
    for (var k = 0; k < 20; k++) {
      var next = H.nextChallenge(i, s);
      expect(next === i).toBe(false);
      i = next;
    }
  });
});
