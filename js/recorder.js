// "Record the narration" page (Phase 10, #/record, linked from About; DECISIONS D21).
//   NS.recorder.mount(stage) -> {destroy()}
// Steps through every narration line (NS.movie.helpers.narrationLines), records each one with MediaRecorder,
// lets the grown-up play it back and redo it, and saves one audio file per line (<id>.webm/.ogg/.m4a) plus a
// cue sheet (narration-cues-<group>.json: id, file, hash of the text read). Those go into assets/audio/, and
// `node tools/build-audio-manifest.js` registers them in js/engine/audio-manifest.js.
// Recordings live in memory only: they are lost when the page closes, so the page asks you to save them.
// Microphones need a secure page: a localhost web server or https works everywhere; file:// works in Chrome and
// Firefox on most computers, not in Safari (see docs/recording-your-voice.md).
(function (NS) {
  'use strict';

  var U = NS.util;

  var MIMES = [
    { type: 'audio/webm;codecs=opus', ext: 'webm' },
    { type: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { type: 'audio/mp4', ext: 'm4a' },
    { type: 'audio/webm', ext: 'webm' }
  ];

  // ---------------------------------------------------------------- pure helpers

  // Lines grouped for the picker: one group per lesson, then the movie's own cards.
  function groups(lines) {
    var out = [];
    var byKey = {};
    lines.forEach(function (line) {
      var key = line.movie ? 'movie' : line.lessonId;
      if (!byKey[key]) {
        byKey[key] = { key: key, title: line.movie ? 'Movie cards' : line.lessonTitle, lines: [] };
        out.push(byKey[key]);
      }
      byKey[key].lines.push(line);
    });
    return out;
  }

  function extFor(mime) {
    var m = String(mime || '').toLowerCase();
    if (m.indexOf('ogg') !== -1) return 'ogg';
    if (m.indexOf('mp4') !== -1 || m.indexOf('aac') !== -1) return 'm4a';
    if (m.indexOf('mpeg') !== -1) return 'mp3';
    if (m.indexOf('wav') !== -1) return 'wav';
    return 'webm';
  }

  // The cue sheet tools/build-audio-manifest.js reads: which file holds which line, recorded from which text.
  function cueSheet(entries, when) {
    return {
      kind: 'numsys-narration-cues',
      version: 1,
      recordedAt: when,
      lines: entries.map(function (e) {
        return { id: e.id, file: e.file, hash: NS.narrator.hashText(e.text), text: e.text };
      })
    };
  }

  function seconds(ms) { return (Math.round(ms / 100) / 10).toFixed(1) + 's'; }

  // ---------------------------------------------------------------- the view

  function canRecord() {
    return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      typeof window.MediaRecorder === 'function';
  }

  function pickMime() {
    var MR = window.MediaRecorder;
    for (var i = 0; i < MIMES.length; i++) {
      if (MR.isTypeSupported && MR.isTypeSupported(MIMES[i].type)) return MIMES[i].type;
    }
    return '';
  }

  function mount(stage) {
    var ctrl = new AbortController();
    var signal = ctrl.signal;
    var all = groups(NS.movie.helpers.narrationLines());
    var takes = {};          // id -> {blob, url, ext, ms, saved}
    var group = all[0];
    var index = 0;
    var stream = null;
    var rec = null;          // {recorder, id, started}
    var audio = null;
    var tick = null;

    function on(target, type, fn) { target.addEventListener(type, fn, { signal: signal }); }

    // ---- DOM
    var supported = canRecord();
    var select = U.el('select', { id: 'rec-group', class: 'rec-select' }, all.map(function (g, i) {
      return U.el('option', { value: String(i), text: g.title + ' (' + g.lines.length + ' lines)' });
    }));
    var counter = U.el('p', { class: 'rec-count', 'aria-live': 'polite' });
    var where = U.el('p', { class: 'rec-where' });
    var lineText = U.el('p', { class: 'rec-text' });
    var idText = U.el('code', { class: 'rec-id' });
    var timer = U.el('span', { class: 'rec-timer', 'aria-live': 'off' });
    var statusEl = U.el('p', { class: 'rec-status', role: 'status' });

    var recBtn = U.el('button', { type: 'button', class: 'btn btn-primary rec-record', onClick: function () { toggleRecord(); } }, 'Record');
    var playBtn = U.el('button', { type: 'button', class: 'btn rec-play', onClick: function () { playTake(current().id); } }, 'Play');
    var prevBtn = U.el('button', { type: 'button', class: 'btn rec-prev', onClick: function () { select_(index - 1); } }, '← Previous');
    var nextBtn = U.el('button', { type: 'button', class: 'btn rec-next', onClick: function () { select_(index + 1); } }, 'Next →');
    var listEl = U.el('ol', { class: 'rec-list' });
    var saveAllBtn = U.el('button', { type: 'button', class: 'btn btn-primary rec-save-all', onClick: function () { saveAll(); } }, 'Save recorded lines');
    var cuesBtn = U.el('button', { type: 'button', class: 'btn rec-save-cues', onClick: function () { saveCues(); } }, 'Save the cue sheet');

    var panel = U.el('div', { class: 'rec-panel' },
      U.el('div', { class: 'rec-panel-top' }, where, idText),
      lineText,
      U.el('div', { class: 'rec-buttons' }, recBtn, timer, playBtn),
      statusEl,
      U.el('div', { class: 'rec-buttons rec-nav' }, prevBtn, nextBtn));

    stage.appendChild(U.el('section', { class: 'recorder prose-wide' },
      U.el('h1', { class: 'view-heading', tabindex: '-1', text: 'Record the narration' }),
      U.el('p', { class: 'lead', text: 'Read each line out loud, and the lessons will talk in your voice.' }),
      U.el('ol', { class: 'rec-how' },
        U.el('li', { text: 'Pick a lesson. Press Record, read the line, then press Stop (or the R key).' }),
        U.el('li', { text: 'Press Play to listen. Not happy? Just record it again.' }),
        U.el('li', { text: 'Press "Save recorded lines" and "Save the cue sheet". Your browser saves the files in Downloads.' }),
        U.el('li', {}, 'Copy them into the app\'s ', U.el('code', { text: 'assets/audio/' }), ' folder and run ',
          U.el('code', { text: 'node tools/build-audio-manifest.js' }), '. Details: ', U.el('code', { text: 'docs/recording-your-voice.md' }), '.')),
      supported ? null : U.el('p', { class: 'rec-warning', role: 'alert', text: 'This browser cannot record here. Try Chrome, Edge or Firefox, ' +
        'and if it still does not work, open the app from a small local web server (see docs/recording-your-voice.md).' }),
      U.el('p', { class: 'rec-warning rec-keep', text: 'Recordings are only kept while this page is open. Save them before you leave!' }),
      U.el('div', { class: 'rec-pick' }, U.el('label', { for: 'rec-group', text: 'Lesson: ' }), select, counter),
      panel,
      listEl,
      U.el('div', { class: 'rec-save' }, saveAllBtn, cuesBtn,
        U.el('p', { class: 'muted', text: 'The browser may ask once whether this page may save several files. Say yes.' }))));

    if (!supported) { recBtn.disabled = true; }

    // ---- state
    function current() { return group.lines[index]; }

    function render() {
      var line = current();
      var take = takes[line.id];
      where.textContent = 'Line ' + (index + 1) + ' of ' + group.lines.length + (line.sceneTitle ? ' · ' + line.sceneTitle : '');
      idText.textContent = line.id;
      lineText.textContent = line.text;
      var recording = !!(rec && rec.id === line.id);
      recBtn.textContent = recording ? 'Stop' : (take ? 'Record again' : 'Record');
      recBtn.classList.toggle('is-recording', recording);
      recBtn.setAttribute('aria-pressed', String(recording));
      playBtn.disabled = !take || recording;
      prevBtn.disabled = index === 0 || !!rec;
      nextBtn.disabled = index === group.lines.length - 1 || !!rec;
      select.disabled = !!rec;
      timer.textContent = recording ? '● ' + seconds(Date.now() - rec.started) : (take ? seconds(take.ms) : '');
      var done = group.lines.filter(function (l) { return takes[l.id]; }).length;
      var total = Object.keys(takes).length;
      counter.textContent = done + ' of ' + group.lines.length + ' recorded' + (total > done ? ' (' + total + ' in all)' : '');
      saveAllBtn.disabled = !total;
      cuesBtn.disabled = !total;
      renderList();
    }

    function renderList() {
      U.clear(listEl);
      group.lines.forEach(function (line, i) {
        var take = takes[line.id];
        listEl.appendChild(U.el('li', { class: ['rec-row', i === index ? 'is-current' : '', take ? 'is-done' : ''] },
          U.el('button', { type: 'button', class: 'rec-row-pick', 'aria-current': i === index ? 'true' : null,
            onClick: function () { select_(i); } },
            U.el('span', { class: 'rec-row-status', text: take ? '✓' : '·', 'aria-label': take ? 'recorded' : 'not recorded yet' }),
            U.el('span', { class: 'rec-row-text', text: line.text })),
          take ? U.el('span', { class: 'rec-row-time', text: seconds(take.ms) + (take.saved ? ' · saved' : '') }) : null));
      });
    }

    function select_(i) {
      if (rec) return;
      index = Math.max(0, Math.min(group.lines.length - 1, i));
      stopPlayback();
      statusEl.textContent = '';
      render();
    }

    function status(text) { statusEl.textContent = text; }

    // ---- recording
    function getStream() {
      if (stream) return Promise.resolve(stream);
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        .then(function (s) {
          if (signal.aborted) { s.getTracks().forEach(function (t) { t.stop(); }); throw U.abortError(); }
          stream = s;
          return s;
        });
    }

    function toggleRecord() {
      if (rec) { stopRecord(); return; }
      var line = current();
      stopPlayback();
      status('Asking for the microphone…');
      getStream().then(function (s) {
        var mime = pickMime();
        var recorder = new window.MediaRecorder(s, mime ? { mimeType: mime } : undefined);
        var chunks = [];
        rec = { recorder: recorder, id: line.id, started: Date.now() };
        recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = function () {
          var ms = Date.now() - rec.started;
          var type = recorder.mimeType || mime || 'audio/webm';
          rec = null;
          clearInterval(tick);
          if (signal.aborted) return;
          if (!chunks.length) { status('Nothing was recorded. Is the microphone on?'); render(); return; }
          var old = takes[line.id];
          if (old) URL.revokeObjectURL(old.url);
          var blob = new Blob(chunks, { type: type });
          takes[line.id] = { blob: blob, url: URL.createObjectURL(blob), ext: extFor(type), ms: ms, text: line.text, saved: false };
          status('Recorded. Press Play to listen, or Next for the next line.');
          render();
          if (!nextBtn.disabled) nextBtn.focus({ preventScroll: true });
        };
        recorder.start();
        status('Recording… read the line, then press Stop.');
        tick = setInterval(function () { if (rec) timer.textContent = '● ' + seconds(Date.now() - rec.started); }, 200);
        render();
        recBtn.focus({ preventScroll: true });
      }).catch(function (err) {
        if (U.isAbortError(err)) return;
        status(err && err.name === 'NotAllowedError'
          ? 'The microphone was not allowed. Allow it in the address bar, then try again.'
          : err && err.name === 'NotFoundError'
          ? 'No microphone was found. Plug one in (a headset works well), then try again.'
          : 'Could not start the microphone' + (err && err.name ? ' (' + err.name + ')' : '') + '. See docs/recording-your-voice.md.');
        render();
      });
    }

    function stopRecord() {
      if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop();
    }

    function stopPlayback() {
      if (audio) { audio.pause(); audio = null; }
    }

    function playTake(id) {
      var take = takes[id];
      if (!take) return;
      stopPlayback();
      audio = new Audio(take.url);
      var p = audio.play();
      if (p && p.catch) p.catch(function () { status('Could not play it back in this browser.'); });
    }

    // ---- saving (one download per line; the sandbox of a browser has no folders or zip)
    function download(url, name) {
      var a = U.el('a', { href: url, download: name, hidden: true });
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function recordedIds() {
      // Every take, in narration order.
      var ids = [];
      all.forEach(function (g) { g.lines.forEach(function (l) { if (takes[l.id]) ids.push(l.id); }); });
      return ids;
    }

    function saveAll() {
      var ids = recordedIds();
      var i = 0;
      status('Saving ' + ids.length + ' file' + (ids.length === 1 ? '' : 's') + '…');
      (function nextFile() {
        if (signal.aborted) return;
        if (i >= ids.length) { status('Saved ' + ids.length + ' file' + (ids.length === 1 ? '' : 's') + '. Now save the cue sheet too.'); render(); return; }
        var id = ids[i++];
        download(takes[id].url, id + '.' + takes[id].ext);
        takes[id].saved = true;
        U.sleep(350, signal).then(nextFile, function () {});
      })();
    }

    function saveCues() {
      var ids = recordedIds();
      var sheet = cueSheet(ids.map(function (id) { return { id: id, file: id + '.' + takes[id].ext, text: takes[id].text }; }),
        new Date().toISOString());
      var url = URL.createObjectURL(new Blob([JSON.stringify(sheet, null, 2) + '\n'], { type: 'application/json' }));
      download(url, 'narration-cues-' + new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '') + '.json');
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      status('Cue sheet saved. Put it in assets/audio/ next to the sound files.');
    }

    // ---- events
    on(select, 'change', function () { group = all[+select.value] || all[0]; index = 0; stopPlayback(); status(''); render(); });
    on(document, 'keydown', function (e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'r' || e.key === 'R') && !recBtn.disabled) { e.preventDefault(); toggleRecord(); }
      else if ((e.key === 'p' || e.key === 'P') && !playBtn.disabled) { e.preventDefault(); playTake(current().id); }
      else if (e.key === 'ArrowRight' && !rec) { e.preventDefault(); select_(index + 1); }
      else if (e.key === 'ArrowLeft' && !rec) { e.preventDefault(); select_(index - 1); }
    });
    on(window, 'beforeunload', function (e) {
      var unsaved = Object.keys(takes).some(function (id) { return !takes[id].saved; });
      if (unsaved) { e.preventDefault(); e.returnValue = ''; }
    });

    render();

    return {
      destroy: function () {
        ctrl.abort();
        clearInterval(tick);
        if (rec && rec.recorder.state !== 'inactive') { try { rec.recorder.stop(); } catch (e) { /* ignore */ } }
        stopPlayback();
        if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
        Object.keys(takes).forEach(function (id) { URL.revokeObjectURL(takes[id].url); });
      }
    };
  }

  NS.recorder = { mount: mount, helpers: { groups: groups, extFor: extFor, cueSheet: cueSheet } };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
