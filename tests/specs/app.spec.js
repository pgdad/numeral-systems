describe('app home menu', function () {
  function lesson(id, order, title) {
    return { id: id, order: order, title: title, scenes: [{ id: 's', steps: [{ say: 'hi' }] }] };
  }

  it('shows every planned lesson as "coming soon" when none are registered', function () {
    var entries = NumSys.app.homeEntries(NumSys.lessons.createRegistry());
    expect(entries.map(function (e) { return e.id; }))
      .toEqual(['base10', 'binary', 'octal-hex', 'silly', 'addition', 'playground']);
    // The playground is its own view (#/playground), so it is ready even without lessons.
    expect(entries.filter(function (e) { return e.ready; }).map(function (e) { return e.id; })).toEqual(['playground']);
    expect(entries[entries.length - 1].href).toBe('#/playground');
  });

  it('marks registered lessons ready and keeps extra lessons', function () {
    var reg = NumSys.lessons.createRegistry();
    reg.register(lesson('binary', 20, 'Binary!'));
    reg.register(lesson('bonus', 99, 'Bonus'));
    var entries = NumSys.app.homeEntries(reg);
    var binary = entries.filter(function (e) { return e.id === 'binary'; })[0];
    expect(binary.ready).toBe(true);
    expect(binary.title).toBe('Binary!');
    expect(binary.href).toBe('#/lesson/binary');
    expect(entries[entries.length - 1].id).toBe('bonus');
  });
});

describe('registered lessons (real app content)', function () {
  it('all registered lessons are valid, with unique narration ids', function () {
    var seen = {};
    NumSys.lessons.list({ includeHidden: true }).forEach(function (lesson) {
      NumSys.lessons.validate(lesson);
      lesson.scenes.forEach(function (scene) {
        scene.steps.forEach(function (step, i) {
          var id = NumSys.lessons.stepId(lesson.id, scene.id, i);
          expect(seen[id]).toBe(undefined);
          seen[id] = true;
        });
      });
    });
  });
});
