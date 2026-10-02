// Phase 11: lesson progress, settings, caption auto-hide and the About page.
describe('lesson progress (home ✓ marks)', function () {
  function memoryStore(broken) {
    var data = {};
    return {
      get: function (k, fb) {
        if (broken) return fb;
        return Object.prototype.hasOwnProperty.call(data, k) ? JSON.parse(data[k]) : fb;
      },
      set: function (k, v) { if (broken) return false; data[k] = JSON.stringify(v); return true; }
    };
  }

  it('marks lessons done, lists them, resets, and tells listeners', function () {
    var p = NumSys.progress.create(memoryStore());
    var calls = 0;
    var off = p.onChange(function () { calls++; });
    expect(p.isDone('binary')).toBe(false);
    p.markDone('binary');
    p.markDone('binary'); // a second time changes nothing
    p.markDone('silly');
    expect(p.isDone('binary')).toBe(true);
    expect(p.doneIds().sort()).toEqual(['binary', 'silly']);
    expect(calls).toBe(2);
    p.reset();
    expect(p.doneIds()).toEqual([]);
    expect(calls).toBe(3);
    off();
    p.markDone('base10');
    expect(calls).toBe(3);
  });

  it('works (forgets) when storage is blocked, and ignores junk in storage', function () {
    var p = NumSys.progress.create(memoryStore(true));
    p.markDone('binary');
    expect(p.isDone('binary')).toBe(false);
    var junk = memoryStore();
    junk.set('progress', ['binary']);
    expect(NumSys.progress.create(junk).isDone('0')).toBe(false);
    expect(NumSys.progress.create(junk).doneIds()).toEqual([]);
  });

  it('home entries carry the done flag', function () {
    var reg = NumSys.lessons.createRegistry();
    reg.register({ id: 'binary', order: 20, title: 'Binary', scenes: [{ id: 's', steps: [{ say: 'hi' }] }] });
    var real = NumSys.progress;
    var fake = NumSys.progress.create(memoryStore());
    fake.markDone('binary');
    NumSys.progress = fake;
    try {
      var entries = NumSys.app.homeEntries(reg);
      expect(entries.filter(function (e) { return e.done; }).map(function (e) { return e.id; })).toEqual(['binary']);
    } finally { NumSys.progress = real; }
  });
});

describe('settings', function () {
  it('resolves the theme from the choice and the computer', function () {
    var r = NumSys.settings.resolveTheme;
    expect(r('light', true)).toBe('light');
    expect(r('dark', false)).toBe('dark');
    expect(r('auto', true)).toBe('dark');
    expect(r('auto', false)).toBe('light');
    expect(r('nonsense', false)).toBe('light');
  });

  it('has safe defaults and only known choices', function () {
    var S = NumSys.settings;
    expect(S.DEFAULTS).toEqual({ theme: 'light', captions: 'm', speed: 1 });
    expect(S.THEMES).toEqual(['light', 'dark', 'auto']);
    expect(S.CAPTION_SIZES).toEqual(['s', 'm', 'l']);
    expect(S.SPEEDS).toEqual([0.75, 1, 1.25]);
    ['theme', 'captions', 'speed'].forEach(function (k) {
      expect(S[k === 'theme' ? 'THEMES' : k === 'captions' ? 'CAPTION_SIZES' : 'SPEEDS']).toContain(S.get(k));
    });
  });

  it('has the UI icons the panel and header use', function () {
    ['gear', 'close', 'check', 'speaker'].forEach(function (n) { expect(NumSys.icons.UI[n]).toBeTruthy(); });
  });

  var hasDom = typeof document !== 'undefined';
  it('opens as a dialog, saves a choice, and gives focus back when closed', function () {
    if (!hasDom) return;
    var opener = document.createElement('button');
    document.body.appendChild(opener);
    var before = NumSys.settings.get('captions');
    var seen = [];
    var off = NumSys.settings.onChange(function (k) { seen.push(k); });
    try {
      var panel = NumSys.settings.open(opener);
      expect(NumSys.settings.isOpen()).toBe(true);
      expect(panel.dialog.getAttribute('aria-labelledby')).toBe('settings-title');
      var large = panel.dialog.querySelector('input[type="radio"][value="l"]');
      large.checked = true;
      large.dispatchEvent(new Event('change'));
      expect(document.documentElement.getAttribute('data-captions')).toBe('l');
      expect(seen).toContain('captions');
      // every control has a label
      Array.prototype.forEach.call(panel.dialog.querySelectorAll('input, select, button'), function (c) {
        var named = c.getAttribute('aria-label') || c.textContent.trim() || (c.closest('label') && c.closest('label').textContent.trim()) ||
          (c.id && panel.dialog.querySelector('label[for="' + c.id + '"]'));
        expect(!!named).toBe(true);
      });
      NumSys.settings.close();
      expect(NumSys.settings.isOpen()).toBe(false);
      expect(document.activeElement).toBe(opener);
    } finally {
      NumSys.settings.set('captions', before);
      off();
      opener.remove();
    }
  });
});

describe('captions auto-hide (interactive parts)', function () {
  it('hides the captions a while after a line, unless another line started', function () {
    if (typeof document === 'undefined') return;
    var N = NumSys.narrator;
    var el = document.createElement('div');
    var oldScale = N.config.timeScale, oldVoice = N.isVoiceOn();
    N.config.timeScale = 0.01;
    N.setVoiceOn(false); // timed captions only
    N.setCaptionElement(el);
    N.setCaptionAutoHide(30);
    function restore() {
      N.setCaptionAutoHide(null);
      N.setCaptionElement(null);
      N.config.timeScale = oldScale;
      N.setVoiceOn(oldVoice);
    }
    return N.speak('t.a.0', 'Hello there.').then(function () {
      expect(el.hidden).toBe(false);
      return new Promise(function (r) { setTimeout(r, 80); });
    }).then(function () {
      expect(el.hidden).toBe(true);
      N.setCaptionAutoHide(null);
      return N.speak('t.a.1', 'Stay.');
    }).then(function () {
      return new Promise(function (r) { setTimeout(r, 60); });
    }).then(function () {
      expect(el.hidden).toBe(false);
      restore();
    }, function (e) { restore(); throw e; });
  });
});

describe('narrator.stop ends the whole line', function () {
  it('rejects a speak() that had no signal, so no later sentence is read (hidden tab, playground)', function () {
    var N = NumSys.narrator;
    var oldScale = N.config.timeScale, oldVoice = N.isVoiceOn();
    N.config.timeScale = 0.01;
    N.setVoiceOn(false);
    var reached = [];
    var p = N.speak('t.stop.0', 'One. Two. Three. Four.', { onSentence: function (i) { reached.push(i); } });
    N.stop();
    function restore() { N.config.timeScale = oldScale; N.setVoiceOn(oldVoice); }
    return p.then(function () { restore(); throw new Error('should have been stopped'); }, function (e) {
      restore();
      expect(e.name).toBe('AbortError');
      expect(reached.indexOf(3)).toBe(-1);
    });
  });
});
