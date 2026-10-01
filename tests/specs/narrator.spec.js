describe('narrator helpers', function () {
  var N = NumSys.narrator;

  it('splitSentences keeps punctuation and handles odd spacing', function () {
    expect(N.splitSentences('Hi! How are you?  Fine.')).toEqual(['Hi!', 'How are you?', 'Fine.']);
    expect(N.splitSentences('No punctuation here')).toEqual(['No punctuation here']);
    expect(N.splitSentences("Ten fingers! That's why.")).toEqual(['Ten fingers!', "That's why."]);
    expect(N.splitSentences('Wait… what?!')).toEqual(['Wait…', 'what?!']);
    expect(N.splitSentences('   ')).toEqual([]);
  });

  it('estimateMs grows with length, shrinks with rate, has a minimum', function () {
    var short = N.estimateMs('Hi.', 1);
    var long = N.estimateMs('This is a much longer sentence with quite a lot of words in it to read out loud.', 1);
    expect(short).toBe(N.config.minMs);
    expect(long > short).toBe(true);
    expect(N.estimateMs('one two three four five six seven eight nine ten eleven twelve', 1.25) <
      N.estimateMs('one two three four five six seven eight nine ten eleven twelve', 0.75)).toBe(true);
  });

  it('pickVoice prefers natural English voices, then en-US default', function () {
    var voices = [
      { name: 'Deutsch', lang: 'de-DE', default: true },
      { name: 'English (America)', lang: 'en-US', default: false },
      { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' },
      { name: 'Google UK English Female', lang: 'en-GB' }
    ];
    expect(N.pickVoice(voices).name).toBe('Microsoft Aria Online (Natural)');
    expect(N.pickVoice(voices, 'Google UK English Female').name).toBe('Google UK English Female');
    expect(N.pickVoice([voices[0], voices[1]]).name).toBe('English (America)');
    expect(N.pickVoice([])).toBe(null);
    expect(N.pickVoice([{ name: 'Only', lang: 'fr-FR' }]).name).toBe('Only');
  });

  it('hashText is stable and sensitive to changes', function () {
    expect(N.hashText('Hello')).toBe(N.hashText('Hello'));
    expect(N.hashText('Hello') === N.hashText('Hello!')).toBe(false);
    expect(N.hashText('')).toMatch(/^[0-9a-f]+$/);
  });

  it('chooseSource: fresh audio file > speech > timed captions', function () {
    var text = 'Hello there.';
    var manifest = {
      'l.s.0': { src: 'assets/audio/l.s.0.mp3', hash: N.hashText(text) },
      'l.s.1': { src: 'assets/audio/l.s.1.mp3', hash: 'stale' }
    };
    expect(N.chooseSource('l.s.0', text, { manifest: manifest, voiceOn: true, speechAvailable: true })).toBe('audio');
    expect(N.chooseSource('l.s.1', text, { manifest: manifest, voiceOn: true, speechAvailable: true })).toBe('speech');
    expect(N.chooseSource('l.s.9', text, { manifest: manifest, voiceOn: true, speechAvailable: false })).toBe('timed');
    expect(N.chooseSource('l.s.0', text, { manifest: manifest, voiceOn: false, speechAvailable: true })).toBe('timed');
  });

  it('speak uses a timed wait (captions only) when the voice is off', function () {
    var oldScale = N.config.timeScale;
    var wasOn = N.isVoiceOn();
    N.config.timeScale = 0.01;
    N.setVoiceOn(false);
    function restore() { N.config.timeScale = oldScale; N.setVoiceOn(wasOn); }
    return N.speak('t.t.0', 'One. Two.', { rate: 1 }).then(function (source) {
      restore();
      expect(source).toBe('timed');
    }, function (e) { restore(); throw e; });
  });

  it('speak rejects with AbortError when aborted', function () {
    var ctrl = new AbortController();
    var p = N.speak('t.t.1', 'A long sentence that would take a while.', { signal: ctrl.signal });
    ctrl.abort();
    return expect(p).toRejectWith('AbortError');
  });
});

describe('anim helpers without a DOM', function () {
  it('wait is instant in instant mode and abortable otherwise', function () {
    var A = NumSys.anim;
    var ctrl = new AbortController();
    var p = A.wait(10000, { signal: ctrl.signal });
    ctrl.abort();
    return Promise.all([A.wait(10000, { instant: true }), expect(p).toRejectWith('AbortError')]);
  });

  it('applyFinal copies the last keyframe onto inline style', function () {
    var el = { style: {} };
    NumSys.anim.applyFinal(el, [{ opacity: 0 }, { opacity: 1, transform: 'scale(1)', offset: 1 }]);
    expect(el.style).toEqual({ opacity: 1, transform: 'scale(1)' });
  });

  it('run with instant applies the end state for persistent animations only', function () {
    var A = NumSys.anim;
    var el = { style: {}, animate: function () { throw new Error('should not animate'); } };
    return A.run(el, [{ opacity: 0 }, { opacity: 1 }], {}, { instant: true }).then(function () {
      expect(el.style.opacity).toBe(1);
      var el2 = { style: {}, animate: el.animate };
      return A.run(el2, [{ opacity: 0 }, { opacity: 1 }], {}, { instant: true }, 'transient').then(function () {
        expect(el2.style).toEqual({});
      });
    });
  });
});
