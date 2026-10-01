describe('util', function () {
  var U = NumSys.util;

  it('clamp keeps numbers in range', function () {
    expect(U.clamp(5, 0, 10)).toBe(5);
    expect(U.clamp(-3, 0, 10)).toBe(0);
    expect(U.clamp(42, 0, 10)).toBe(10);
  });

  it('range works with one, two and three arguments', function () {
    expect(U.range(3)).toEqual([0, 1, 2]);
    expect(U.range(2, 5)).toEqual([2, 3, 4]);
    expect(U.range(0, 10, 5)).toEqual([0, 5]);
    expect(U.range(3, 0, -1)).toEqual([3, 2, 1]);
    expect(U.range(0)).toEqual([]);
  });

  it('sleep resolves after the delay', function () {
    var start = Date.now();
    return U.sleep(20).then(function () {
      expect(Date.now() - start >= 15).toBeTruthy();
    });
  });

  it('sleep rejects with AbortError when aborted', function () {
    var ctrl = new AbortController();
    var p = U.sleep(10000, ctrl.signal);
    ctrl.abort();
    return expect(p).toRejectWith('AbortError');
  });

  it('sleep rejects immediately for an already-aborted signal', function () {
    var ctrl = new AbortController();
    ctrl.abort();
    return expect(U.sleep(10, ctrl.signal)).toRejectWith('AbortError');
  });

  it('isAbortError recognises abort errors only', function () {
    expect(U.isAbortError(U.abortError())).toBe(true);
    expect(U.isAbortError(new Error('x'))).toBe(false);
    expect(U.isAbortError(null)).toBe(false);
  });

  it('storage never throws, even without localStorage', function () {
    expect(U.storage.get('missing', 7)).toBe(7);
    expect(typeof U.storage.set('k', 1)).toBe('boolean');
  });
});
