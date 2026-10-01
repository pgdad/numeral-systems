describe('router.parse', function () {
  var parse = NumSys.router.parse;

  it('parses home in all its spellings', function () {
    ['', '#', '#/', '#//', '/'].forEach(function (h) {
      var r = parse(h);
      expect(r.name).toBe('home');
      expect(r.redirected).toBe(undefined);
    });
  });

  it('parses a lesson route', function () {
    expect(parse('#/lesson/binary')).toEqual({ name: 'lesson', params: { id: 'binary' }, path: '/lesson/binary' });
  });

  it('parses a lesson deep link with numeric scene and step', function () {
    var r = parse('#/lesson/octal-hex/2/5');
    expect(r.name).toBe('lesson');
    expect(r.params).toEqual({ id: 'octal-hex', scene: 2, step: 5 });
  });

  it('parses playground and about, ignoring trailing slashes and query strings', function () {
    expect(parse('#/playground/').name).toBe('playground');
    expect(parse('#/about?x=1').name).toBe('about');
    expect(parse('#/gallery').name).toBe('gallery');
  });

  it('redirects unknown routes home', function () {
    ['#/nonsense', '#/lesson', '#/lesson/binary/one/two', '#/lesson/binary/1', '#/about/extra'].forEach(function (h) {
      var r = parse(h);
      expect(r.name).toBe('home');
      expect(r.redirected).toBe(true);
    });
  });

  it('decodes encoded segments', function () {
    expect(parse('#/lesson/my%2Dlesson').params.id).toBe('my-lesson');
  });

  it('href builds hashes that parse back', function () {
    var href = NumSys.router.href;
    expect(href('home')).toBe('#/');
    expect(href('lesson', { id: 'binary' })).toBe('#/lesson/binary');
    expect(href('lesson', { id: 'binary', scene: 1, step: 0 })).toBe('#/lesson/binary/1/0');
    expect(href('about')).toBe('#/about');
    expect(parse(href('lesson', { id: 'silly', scene: 3, step: 4 })).params).toEqual({ id: 'silly', scene: 3, step: 4 });
  });
});
