// Settings panel (Phase 11, DECISIONS D22): the gear button in the header opens a dialog with
// voice, speech speed, sound effects, caption size, hand color, light/dark look and reset progress.
// Every choice is saved at once (localStorage via U.storage, so nothing breaks when storage is blocked)
// and announced with a window event 'numsys:settings' {detail: {key}}, so open views (player, movie,
// playground) can refresh their own quick buttons.
//   NS.settings.apply()            apply the look (theme, caption size); app.js calls it on boot
//   NS.settings.open(opener)       open the panel; focus returns to `opener` when it closes
//   NS.settings.onChange(fn)       -> off()
//   pure helpers for tests: THEMES, CAPTION_SIZES, SPEEDS, resolveTheme(pref, systemDark), get(key)
(function (NS) {
  'use strict';

  var U = NS.util;
  var EVENT = 'numsys:settings';

  var THEMES = ['light', 'dark', 'auto'];
  var CAPTION_SIZES = ['s', 'm', 'l'];
  var SPEEDS = [0.75, 1, 1.25];
  var DEFAULTS = { theme: 'light', captions: 'm', speed: 1 };
  var STORE_KEYS = { theme: 'theme', captions: 'captions.size', speed: 'player.speed' };
  var ALLOWED = { theme: THEMES, captions: CAPTION_SIZES, speed: SPEEDS };

  function get(key) {
    var v = U.storage.get(STORE_KEYS[key], DEFAULTS[key]);
    return ALLOWED[key].indexOf(v) === -1 ? DEFAULTS[key] : v;
  }

  function resolveTheme(pref, systemDark) {
    if (pref === 'dark' || pref === 'light') return pref;
    return systemDark ? 'dark' : 'light';
  }

  function emit(key) {
    if (typeof window === 'undefined') return;
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: key } })); } catch (e) { /* very old browsers */ }
  }

  function onChange(fn) {
    function handler(e) { fn((e.detail && e.detail.key) || null); }
    window.addEventListener(EVENT, handler);
    return function off() { window.removeEventListener(EVENT, handler); };
  }

  function set(key, value) {
    U.storage.set(STORE_KEYS[key], value);
    apply();
    emit(key);
  }

  // ---------- applying the look ----------
  var darkQuery = null;
  function systemDark() {
    try {
      if (!darkQuery && window.matchMedia) darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      return !!(darkQuery && darkQuery.matches);
    } catch (e) { return false; }
  }

  var watching = false;
  function apply() {
    if (typeof document === 'undefined') return;
    var root = document.documentElement;
    var theme = resolveTheme(get('theme'), systemDark());
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    root.setAttribute('data-captions', get('captions'));
    if (!watching && darkQuery) {
      watching = true;
      var follow = function () { if (get('theme') === 'auto') apply(); };
      if (darkQuery.addEventListener) darkQuery.addEventListener('change', follow);
      else if (darkQuery.addListener) darkQuery.addListener(follow);
    }
  }

  // ---------- the panel ----------
  function icon(name) { return NS.icons.render(name, { kind: 'ui' }); }

  var uid = 0;
  // A row of radio buttons styled as pills, inside a fieldset with a legend.
  function choiceGroup(legend, name, options, current, onPick, hint) {
    var group = 'set-' + name + '-' + (++uid);
    return U.el('fieldset', { class: 'set-group' },
      U.el('legend', { text: legend }),
      hint ? U.el('p', { class: 'set-hint', text: hint }) : null,
      U.el('div', { class: 'set-choices' }, options.map(function (o) {
        var input = U.el('input', { type: 'radio', name: group, value: String(o.value),
          onChange: function () { if (input.checked) onPick(o.value); } });
        input.checked = o.value === current;
        return U.el('label', { class: 'set-choice' }, input, U.el('span', { text: o.label }));
      })));
  }

  // An on/off switch: a real checkbox with a big label.
  function toggle(label, checked, onToggle, hint) {
    var input = U.el('input', { type: 'checkbox', class: 'set-switch-input',
      onChange: function () { onToggle(input.checked); } });
    input.checked = !!checked;
    return U.el('div', { class: 'set-row' },
      U.el('label', { class: 'set-switch' }, input, U.el('span', { class: 'set-switch-track', 'aria-hidden': 'true' }),
        U.el('span', { class: 'set-switch-label', text: label })),
      hint ? U.el('p', { class: 'set-hint', text: hint }) : null);
  }

  function voiceSection() {
    var hasSpeech = NS.narrator.isSpeechAvailable();
    var select = U.el('select', { class: 'set-select', disabled: !hasSpeech,
      onChange: function () {
        NS.narrator.setVoiceName(select.value || null);
        emit('voice');
      } });
    select.appendChild(U.el('option', { value: '', text: 'Automatic (the nicest one we can find)' }));
    var saved = U.storage.get('narrator.voiceName', null);
    if (hasSpeech) {
      NS.narrator.listVoices().then(function (voices) {
        if (!select.isConnected && !select.parentNode) return;
        var best = NS.narrator.pickVoice(voices, null);
        if (best) select.options[0].textContent = 'Automatic (' + best.name + ')';
        voices.forEach(function (v) {
          var o = U.el('option', { value: v.name, text: v.name + (v.lang ? ' · ' + v.lang : '') });
          if (v.name === saved) o.selected = true;
          select.appendChild(o);
        });
        if (!voices.length) select.options[0].textContent = 'Automatic (this browser has no English voice)';
      });
    }
    var tryBtn = U.el('button', { type: 'button', class: 'btn btn-sm', disabled: !hasSpeech,
      onClick: function () {
        NS.narrator.unlock();
        NS.narrator.speak('settings.try', 'Hello! One, two, three. Counting is fun!', { rate: get('speed') }).then(function () {
          var c = document.getElementById('captions');
          setTimeout(function () { if (c && !document.querySelector('.player, .movie')) c.hidden = true; }, 1500);
        }, function () {});
      } }, icon('speaker'), 'Try the voice');
    var voiceId = 'set-voice-' + (++uid);
    select.id = voiceId;
    return U.el('section', { class: 'set-section' },
      U.el('h3', { text: 'Voice' }),
      toggle('Read the lessons out loud', NS.narrator.isVoiceOn(), function (on) {
        NS.narrator.setVoiceOn(on);
        emit('voiceOn');
      }, 'When this is off, the words only show as captions.'),
      U.el('div', { class: 'set-row' },
        U.el('label', { class: 'set-label', for: voiceId, text: 'Which voice' }),
        U.el('div', { class: 'set-inline' }, select, tryBtn),
        hasSpeech ? null : U.el('p', { class: 'set-hint', text: 'This browser cannot talk, so the lessons show captions only.' })),
      choiceGroup('How fast', 'speed', [
        { value: 0.75, label: '¾ Slower' }, { value: 1, label: 'Normal' }, { value: 1.25, label: '1¼ Faster' }
      ], get('speed'), function (v) { set('speed', v); }));
  }

  function progressSection(close) {
    var lessons = NS.app ? NS.app.homeEntries().filter(function (e) { return e.ready; }) : [];
    var line = U.el('p', { class: 'set-progress-line' });
    var resetBtn = U.el('button', { type: 'button', class: 'btn btn-sm' });
    var confirming = false, timer = null;
    function draw() {
      var done = lessons.filter(function (e) { return NS.progress.isDone(e.id); }).length;
      line.textContent = done === 0 ? 'No lessons finished yet.'
        : done + ' of ' + lessons.length + ' finished. They have a ✓ on the home screen.';
      resetBtn.textContent = confirming ? 'Yes, start over' : 'Reset progress';
      resetBtn.classList.toggle('btn-danger', confirming);
      resetBtn.disabled = done === 0 && !confirming;
    }
    resetBtn.addEventListener('click', function () {
      if (!confirming) {
        confirming = true;
        draw();
        timer = setTimeout(function () { confirming = false; draw(); }, 5000);
        return;
      }
      clearTimeout(timer);
      confirming = false;
      NS.progress.reset();
      draw();
      line.textContent = 'Done: every lesson is new again.';
    });
    draw();
    return U.el('section', { class: 'set-section' },
      U.el('h3', { text: 'Progress' }), line,
      U.el('div', { class: 'set-row' }, resetBtn,
        U.el('p', { class: 'set-hint', text: 'Takes the ✓ marks away (your own number systems and quiz scores stay).' })));
  }

  var openDialog = null;

  function open(opener) {
    if (openDialog) return openDialog;
    var dialog = U.el('dialog', { class: 'settings-dialog', 'aria-labelledby': 'settings-title' });
    var closeBtn = U.el('button', { type: 'button', class: 'icon-btn set-close', 'aria-label': 'Close settings', title: 'Close',
      onClick: function () { close(); } }, icon('close'));

    var skin = NS.hands && NS.hands.skinPicker
      ? U.el('section', { class: 'set-section' },
          U.el('h3', { text: 'Hand color' }),
          U.el('p', { class: 'set-hint', text: 'The counting hands in the lessons.' }),
          NS.hands.skinPicker(function () { emit('skin'); }))
      : null;

    dialog.appendChild(U.el('div', { class: 'set-inner' },
      U.el('div', { class: 'set-head' },
        U.el('h2', { id: 'settings-title', text: 'Settings' }), closeBtn),
      voiceSection(),
      U.el('section', { class: 'set-section' },
        U.el('h3', { text: 'Sounds and words' }),
        toggle('Sound effects (pops, dings, animal noises)', !NS.sound.isMuted(), function (on) {
          NS.sound.setMuted(!on);
          if (on) { NS.sound.unlock(); NS.sound.play('ding'); }
          emit('sound');
        }),
        choiceGroup('Caption size', 'captions', [
          { value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }
        ], get('captions'), function (v) { set('captions', v); })),
      skin,
      U.el('section', { class: 'set-section' },
        U.el('h3', { text: 'Look' }),
        choiceGroup('Colors', 'theme', [
          { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Same as this computer' }
        ], get('theme'), function (v) { set('theme', v); })),
      progressSection(),
      U.el('div', { class: 'set-foot' },
        U.el('button', { type: 'button', class: 'btn btn-primary', onClick: function () { close(); } }, 'Done'))));

    function close() {
      if (!openDialog) return;
      openDialog = null;
      if (dialog.open && dialog.close) dialog.close();
      dialog.removeEventListener('close', onNativeClose);
      document.removeEventListener('keydown', onKey, true);
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      document.documentElement.classList.remove('settings-open');
      if (opener && opener.focus) opener.focus();
    }
    function onNativeClose() { close(); }
    // Esc closes (native dialogs do it themselves; this covers the fallback) and keys don't reach the player.
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (dialog.contains(e.target)) e.stopPropagation();
    }
    dialog.addEventListener('close', onNativeClose);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); }); // the backdrop
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(dialog);
    document.documentElement.classList.add('settings-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    var first = dialog.querySelector('input, select, button:not(.set-close)');
    if (first) first.focus();
    openDialog = { dialog: dialog, close: close };
    return openDialog;
  }

  function isOpen() { return !!openDialog; }
  function closePanel() { if (openDialog) openDialog.close(); }

  NS.settings = {
    EVENT: EVENT, THEMES: THEMES, CAPTION_SIZES: CAPTION_SIZES, SPEEDS: SPEEDS, DEFAULTS: DEFAULTS,
    get: get, set: set, resolveTheme: resolveTheme, apply: apply,
    open: open, close: closePanel, isOpen: isOpen, onChange: onChange
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
