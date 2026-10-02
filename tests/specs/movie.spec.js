describe('movie mode and narration lines', function () {
  var M = NumSys.movie.helpers;
  var L = NumSys.lessons;

  function fakeLesson(id, order, interactiveLast) {
    return {
      id: id, order: order, title: 'Lesson ' + id, shortTitle: id, spokenTitle: 'The ' + id + ' lesson',
      scenes: [
        { id: 'one', title: 'One', steps: [{ say: 'Hello there.' }, { say: 'Two sentences. Right here!' }] },
        { id: 'try', title: 'You try it!', interactive: true, steps: [{ say: 'Your turn!' }] },
        { id: 'after', title: 'After', steps: [{ say: 'Did you know?' }] }
      ].slice(0, interactiveLast ? 2 : 3)
    };
  }

  it('has routes for the movie and the recorder', function () {
    var R = NumSys.router;
    expect(R.parse('#/movie').name).toBe('movie');
    expect(R.parse('#/movie/binary').params).toEqual({ id: 'binary' });
    expect(R.parse('#/record').name).toBe('record');
    expect(R.href('movie')).toBe('#/movie');
    expect(R.href('movie', { id: 'octal-hex' })).toBe('#/movie/octal-hex');
    expect(R.parse('#/movie/binary/2').redirected).toBe(true);
  });

  it('plays every lesson in order between an opening and a closing card', function () {
    var list = M.playlist(L);
    var lessons = L.list();
    expect(list[0].kind).toBe('open');
    expect(list[list.length - 1].kind).toBe('close');
    expect(list[0].lesson.id).toBe('movie');
    var chapters = list.filter(function (e) { return e.kind === 'chapter'; });
    expect(chapters.map(function (e) { return e.source.id; })).toEqual(lessons.map(function (l) { return l.id; }));
    expect(chapters.map(function (e) { return e.number; })).toEqual(lessons.map(function (l, i) { return i + 1; }));
    expect(chapters.some(function (e) { return e.source.id === 'demo'; })).toBe(false); // hidden lessons stay out
    var at = 0;
    list.forEach(function (e) {
      expect(e.startMs).toBe(at);
      expect(e.weights.length).toBe(e.lesson.scenes.reduce(function (n, s) { return n + s.steps.length; }, 0));
      expect(e.ms > 0).toBe(true);
      at += e.ms;
    });
    expect(list.totalMs).toBe(at);
    // About ten to twenty minutes in all.
    expect(list.totalMs > 8 * 60000 && list.totalMs < 25 * 60000).toBe(true);
  });

  it('makes movie copies: chapter card first, interactive scenes swapped, real scenes untouched', function () {
    M.playlist(L).filter(function (e) { return e.kind === 'chapter'; }).forEach(function (e) {
      var copy = e.lesson, src = e.source;
      expect(copy.id).toBe(src.id);
      expect(copy.theme).toBe(src.theme);
      expect(copy.scenes.length).toBe(src.scenes.length + 1);
      expect(copy.scenes[0].id).toBe('movie-chapter');
      expect(copy.scenes[0].steps[0].say).toBe(M.chapterSay(src, e.number));
      src.scenes.forEach(function (scene, i) {
        var c = copy.scenes[i + 1];
        if (scene.interactive) {
          expect(c.id).toBe('movie-' + scene.id);
          expect(!!c.interactive).toBe(false);
          expect(c.steps.length).toBe(1);
        } else {
          expect(c).toBe(scene); // same object: same narration ids, same recorded audio
        }
      });
      copy.scenes.forEach(function (s) { expect(!!s.interactive).toBe(false); });
      expect(L.validate(copy)).toBe(copy);
    });
    // Binary keeps its "Did you know?" scene after the swapped "You try it!".
    var binary = M.movieLesson(L.get('binary'), 2);
    expect(binary.scenes.map(function (s) { return s.id; }).slice(-2)).toEqual(['movie-try', 'know']);
    // The lesson itself is not changed.
    expect(L.get('binary').scenes[0].id).toBe('switches');
  });

  it('plays one lesson on its own, and refuses unknown ones', function () {
    var list = M.playlist(L, 'silly');
    expect(list.map(function (e) { return e.kind; })).toEqual(['chapter', 'close']);
    expect(list[0].number).toBe(L.list().indexOf(L.get('silly')) + 1);
    expect(M.playlist(L, 'nope')).toBe(null);
    expect(M.playlist(L, 'demo')).toBe(null);
    expect(M.playlist(L.createRegistry())).toBe(null);
  });

  it('works for any registry, with chapter and "try later" lines', function () {
    var reg = L.createRegistry();
    reg.register(fakeLesson('aa', 1, false));
    var b = fakeLesson('bb', 2, true);
    b.tryLater = 'Later, in the bb lesson!';
    reg.register(b);
    var list = M.playlist(reg);
    expect(list.map(function (e) { return e.kind; })).toEqual(['open', 'chapter', 'chapter', 'close']);
    expect(list[1].lesson.scenes.map(function (s) { return s.id; })).toEqual(['movie-chapter', 'one', 'movie-try', 'after']);
    expect(list[1].lesson.scenes[0].steps[0].say).toBe('Chapter one. The aa lesson.');
    expect(list[1].lesson.scenes[2].steps[0].say).toBe(M.LINES.later);
    expect(list[2].lesson.scenes[2].steps[0].say).toBe('Later, in the bb lesson!');
    expect(M.chapterSay({ title: 'Wow!' }, 12)).toBe('Chapter twelve. Wow!');

    var lines = M.narrationLines(reg);
    expect(lines.map(function (l) { return l.id; })).toEqual([
      'aa.one.0', 'aa.one.1', 'aa.try.0', 'aa.after.0', 'bb.one.0', 'bb.one.1', 'bb.try.0',
      'movie.start.0', 'aa.movie-chapter.0', 'aa.movie-try.0', 'bb.movie-chapter.0', 'bb.movie-try.0', 'movie.end.0']);
    expect(lines[2].interactive).toBe(true);
    expect(lines[0].movie).toBe(false);
    expect(lines[7].movie).toBe(true);
    expect(lines[1].text).toBe('Two sentences. Right here!');
  });

  it('lists every narrated step of every lesson exactly once, plus the movie cards', function () {
    var lines = M.narrationLines();
    var ids = lines.map(function (l) { return l.id; });
    var seen = {};
    ids.forEach(function (id) { expect(seen[id]).toBe(undefined); seen[id] = true; });
    L.list().forEach(function (lesson) {
      lesson.scenes.forEach(function (scene) {
        scene.steps.forEach(function (step, i) {
          var id = L.stepId(lesson.id, scene.id, i);
          expect(seen[id]).toBe(true);
          expect(lines[ids.indexOf(id)].text).toBe(step.say);
        });
      });
    });
    // Movie card lines are words only (numbers in words, D15/lesson rule), and end like sentences.
    lines.filter(function (l) { return l.movie; }).forEach(function (l) {
      expect(/\d/.test(l.text)).toBe(false);
      expect(/[.!?]$/.test(l.text)).toBe(true);
    });
    expect(ids.indexOf('movie.start.0')).toBe(ids.length - lines.filter(function (l) { return l.movie; }).length);
    expect(ids[ids.length - 1]).toBe('movie.end.0');
  });

  it('every lesson has a spoken chapter title', function () {
    L.list().forEach(function (lesson) {
      expect(typeof lesson.spokenTitle).toBe('string');
      expect(/\d/.test(lesson.spokenTitle)).toBe(false);
    });
  });

  it('recorder helpers: groups, file types, cue sheets', function () {
    var R = NumSys.recorder.helpers;
    var groups = R.groups(M.narrationLines());
    expect(groups.map(function (g) { return g.key; })).toEqual(L.list().map(function (l) { return l.id; }).concat(['movie']));
    expect(groups[groups.length - 1].title).toBe('Movie cards');
    expect(R.extFor('audio/webm;codecs=opus')).toBe('webm');
    expect(R.extFor('audio/ogg; codecs=opus')).toBe('ogg');
    expect(R.extFor('audio/mp4')).toBe('m4a');
    expect(R.extFor('audio/mpeg')).toBe('mp3');
    expect(R.extFor('')).toBe('webm');
    var sheet = R.cueSheet([{ id: 'a.b.0', file: 'a.b.0.webm', text: 'Hello.' }], '2026-10-02T10:00:00.000Z');
    expect(sheet.kind).toBe('numsys-narration-cues');
    expect(sheet.lines[0]).toEqual({ id: 'a.b.0', file: 'a.b.0.webm', hash: NumSys.narrator.hashText('Hello.'), text: 'Hello.' });
  });

  it('chooses recorded audio only while its hash matches the text', function () {
    var N = NumSys.narrator;
    var text = 'Each finger is a switch.';
    var manifest = { 'x.y.0': { src: 'assets/audio/x.y.0.mp3', hash: N.hashText(text) } };
    var env = { manifest: manifest, voiceOn: true, speechAvailable: true };
    expect(N.chooseSource('x.y.0', text, env)).toBe('audio');
    expect(N.chooseSource('x.y.0', text + ' Changed!', env)).toBe('speech');
    expect(N.chooseSource('x.y.1', text, env)).toBe('speech');
    expect(N.chooseSource('x.y.0', text, { manifest: manifest, voiceOn: false, speechAvailable: true })).toBe('timed');
  });

  var hasDom = typeof document !== 'undefined';
  if (hasDom) {
    it('builds the movie cards in instant mode', function () {
      var list = M.playlist(L);
      [list[0], list[1], list[list.length - 1]].forEach(function (e) {
        var stage = document.createElement('div');
        var scene = e.lesson.scenes[0];
        var state = scene.setup(stage, {});
        var ctx = { instant: true, state: state, signal: new AbortController().signal };
        scene.steps[0].do(ctx);
        expect(!!stage.querySelector('.movie-card')).toBe(true);
        state.parts.forEach(function (p) { expect(p.style.opacity === '0').toBe(false); });
      });
    });
  }
});
