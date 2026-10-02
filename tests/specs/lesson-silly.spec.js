describe('lesson: silly', function () {
  var lesson = NumSys.lessons.get('silly');
  var H = lesson.helpers;
  var D = NumSys.digitsets;
  var split = NumSys.narrator.splitSentences;

  function steps() {
    var out = [];
    lesson.scenes.forEach(function (s) { out = out.concat(s.steps); });
    return out;
  }
  function scene(id) { return lesson.scenes.filter(function (s) { return s.id === id; })[0]; }
  // A repeatable "random" source for the quiz tests.
  function seeded(seed) {
    return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  }

  it('is registered and valid', function () {
    expect(NumSys.lessons.validate(lesson)).toBe(lesson);
    expect(lesson.order).toBe(40);
    expect(lesson.theme).toBe('silly');
    expect(lesson.scenes.map(function (s) { return s.id; })).toEqual(['anything', 'animals', 'colors', 'costumes', 'try']);
    expect(lesson.scenes.map(function (s) { return !!s.interactive; })).toEqual([false, false, false, false, true]);
  });

  it('has narration on every step, numbers in words', function () {
    expect(steps().length > 12).toBe(true);
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
    expect(ms > 60000 && ms < 300000).toBe(true);
  });

  it('names the animals and colors from the digit sets (D6)', function () {
    var meet = split(scene('anything').steps[1].say);
    expect(meet).toEqual(['Meet the animal numbers!', 'Cat is zero.', 'Dog is one.', 'Frog is two.', 'Pig is three.', 'Duck is four.']);
    expect(split(scene('colors').steps[0].say).slice(1)).toEqual(['Red is zero.', 'Yellow is one.', 'Green is two.']);
    // Every animal digit has a sound that sound.js can play.
    D.get('animals').digits.forEach(function (d) { expect(NumSys.sound.names).toContain(d.sound); });
  });

  it('counts one animal or color per sentence, and the carries land on cue', function () {
    expect(H.countLine(0, 4, 'animals')).toBe('Cat. Dog. Frog. Pig. Duck.');
    var count = split(scene('animals').steps[0].say);
    expect(count.slice(1)).toEqual(['Cat.', 'Dog.', 'Frog.', 'Pig.', 'Duck.']);
    expect(split(scene('animals').steps[1].say)[2]).toBe('Dog-Cat means five!');
    expect(D.speak(H.FIRST_COUNT + 1, 'animals')).toBe('Dog-Cat');
    var more = split(scene('animals').steps[2].say);
    expect(more).toEqual(['Dog-Dog is six.', 'Dog-Frog is seven.', 'Dog-Pig is eight.', 'Dog-Duck is nine.', 'And then?', 'Frog-Cat is ten!']);
    expect(scene('animals').steps[3].say).toContain('Frog-Pig');
    expect(D.speak(H.FROG_PIG, 'animals')).toBe('Frog-Pig');
    var colors = split(scene('colors').steps[1].say);
    expect(colors.slice(2)).toEqual(['Red.', 'Yellow.', 'Green.', 'Yellow-red.', 'Yellow-yellow.', 'Yellow-green.', 'Green-red.']);
    expect(scene('colors').steps[3].say).toBe('Green-green-green is two nines, plus two threes, plus two ones. That makes twenty-six!');
  });

  it('explains what a number is worth', function () {
    expect(H.valueParts(13, 'animals')).toBe('two fives, plus three');
    expect(H.valueParts(26, 'colors', { ones: true })).toBe('two nines, plus two threes, plus two ones');
    expect(H.valueParts(25, 'animals')).toBe('one twenty-five');
    expect(H.explain(9, 'animals')).toBe('Dog-Duck is one five, plus four. That makes nine!');
    expect(H.explain(3, 'animals')).toBe('Pig is three.');
    expect(H.explain(10, 'colors')).toBe('Yellow-red-yellow is one nine, plus one. That makes ten!');
  });

  it('dresses thirteen in six costumes', function () {
    expect(H.COSTUMES.map(function (c) { return c.set; })).toEqual(['decimal', 'binary', 'octal', 'hex', 'animals', 'colors']);
    expect(split(scene('costumes').steps[1].say)).toEqual([
      "In base ten, it's one-three.", 'In binary, one-one-zero-one.', 'In octal, one-five.', 'In hex, D.',
      'With animals, Frog-Pig.', 'With colors, yellow-yellow-yellow.'
    ]);
    expect(H.spell(105, 'decimal')).toBe('one-zero-five');
    expect(H.spell(13, 'colors')).toBe('yellow-yellow-yellow');
    // Three animal places reach Duck-Duck-Duck: the wheel's range.
    expect(H.WHEEL_MAX).toBe(NumSys.numeral.maxWithPlaces(3, 5));
    expect(H.ANIMAL_MAX).toBe(124);
    expect(H.COLOR_MAX).toBe(NumSys.numeral.maxWithPlaces(3, 3));
  });

  it('keeps the counters in range', function () {
    expect(H.counterNext(0, -1, 124)).toBe(0);
    expect(H.counterNext(124, 1, 124)).toBe(124);
    expect(H.counterNext(4, 1, 124)).toBe(5);
    expect(H.counterNext(26, 1, 26)).toBe(26);
  });

  it('makes multiple-choice answers: the answer is always there, no duplicates, small ranges work', function () {
    for (var seed = 1; seed < 400; seed++) {
      var rand = seeded(seed);
      var answer = Math.floor(rand() * 40);
      var c = H.makeChoices(answer, { min: 0, max: 40, count: 3, rand: rand, prefer: [answer + 10, answer] });
      expect(c.length).toBe(3);
      expect(c).toContain(answer);
      c.forEach(function (v, i) {
        expect(v >= 0 && v <= 40).toBe(true);
        if (i) expect(v > c[i - 1]).toBe(true); // sorted, so no duplicates
      });
    }
    expect(H.makeChoices(1, { min: 0, max: 1, count: 3 })).toEqual([0, 1]);
    expect(H.makeChoices(0, { min: 0, max: 0, count: 3 })).toEqual([0]);
    expect(H.makeChoices(2, { min: 0, max: 2, count: 3, rand: seeded(7) })).toEqual([0, 1, 2]);
    expect(H.makeChoices(5, { min: 5, max: 9, count: 4, prefer: [99, 9] })).toContain(9);
  });

  it('asks "What number is Dog-Duck?" first, then mixes animals and colors', function () {
    var q = H.quizQuestion(0, seeded(3));
    expect(q.text).toBe('What number is Dog-Duck?');
    expect(q.value).toBe(9);
    expect(q.choices.length).toBe(3);
    expect(q.choices).toContain(9);
    expect(q.choices).toContain(14); // reading Dog-Duck as "one-four" is the classic mistake
    for (var i = 1; i < 200; i++) {
      var r = H.quizQuestion(i, seeded(i * 31));
      var range = H.QUIZ_RANGES[r.set];
      expect(r.set).toBe(i % 2 ? 'colors' : 'animals');
      expect(r.value >= range[0] && r.value <= range[1]).toBe(true);
      expect(r.choices).toContain(r.value);
      expect(r.choices.length).toBe(3);
      expect(r.text).toBe('What number is ' + H.spell(r.value, r.set).replace(/^./, function (c) { return c.toUpperCase(); }) + '?');
    }
    expect(H.misread(9, 'animals')).toBe(14);
  });
});
