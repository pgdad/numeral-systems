describe('lesson registry', function () {
  var L = NumSys.lessons;
  var fresh = function () { return L.createRegistry(); };

  function sample(id, extra) {
    var def = {
      id: id,
      title: 'Lesson ' + id,
      scenes: [{ id: 'intro', steps: [{ say: 'Hello!' }, { say: 'Bye!', do: function () {} }] }]
    };
    if (extra) Object.keys(extra).forEach(function (k) { def[k] = extra[k]; });
    return def;
  }

  it('registers and retrieves a lesson', function () {
    var reg = fresh();
    reg.register(sample('binary'));
    expect(reg.get('binary').title).toBe('Lesson binary');
    expect(reg.get('nope')).toBe(null);
  });

  it('lists lessons sorted by order and hides hidden ones', function () {
    var reg = fresh();
    reg.register(sample('c', { order: 30 }));
    reg.register(sample('a', { order: 10 }));
    reg.register(sample('b', { order: 20 }));
    reg.register(sample('demo', { order: 0, hidden: true }));
    expect(reg.list().map(function (l) { return l.id; })).toEqual(['a', 'b', 'c']);
    expect(reg.list({ includeHidden: true })[0].id).toBe('demo');
  });

  it('rejects duplicate ids', function () {
    var reg = fresh();
    reg.register(sample('x'));
    expect(function () { reg.register(sample('x')); }).toThrow('already registered');
  });

  it('rejects bad ids, missing titles and empty scenes', function () {
    expect(function () { L.validate(sample('Bad Id')); }).toThrow('id must be');
    expect(function () { L.validate(sample('ok', { title: '' })); }).toThrow('title');
    expect(function () { L.validate(sample('ok', { scenes: [] })); }).toThrow('at least one scene');
  });

  it('rejects steps without narration, naming the culprit', function () {
    var def = sample('ok');
    def.scenes[0].steps.push({ say: '  ' });
    expect(function () { L.validate(def); }).toThrow(/scene "intro" step 2.*say/);
  });

  it('rejects duplicate scene ids and non-function hooks', function () {
    var def = sample('ok');
    def.scenes.push({ id: 'intro', steps: [{ say: 'again' }] });
    expect(function () { L.validate(def); }).toThrow('duplicate scene id');
    var def2 = sample('ok2');
    def2.scenes[0].setup = 'nope';
    expect(function () { L.validate(def2); }).toThrow('setup must be a function');
  });

  it('builds narration step ids', function () {
    expect(L.stepId('binary', 'intro', 2)).toBe('binary.intro.2');
  });
});
