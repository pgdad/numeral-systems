// Movie mode (Phase 10, DECISIONS D4/D21): every lesson plays hands-free, one after another, like a video.
//   NS.movie.mount(stage, {id}) -> {destroy()}      routes #/movie (all lessons) and #/movie/:id (one lesson)
// How: each lesson is turned into a "movie copy" (movieLesson) whose interactive scenes are swapped for a short
// "Try this later" card and which starts with a chapter card. The copies (plus an opening and a closing card)
// are played one after another by the normal scene player in movie mode (NS.player.mount(..., {movie})).
// Real scenes keep their ids, so narration ids and recorded audio are the same as in the lesson.
// The pure parts (playlist, narrationLines) are on NS.movie.helpers and are used by tools/narration-export.js.
// Like lesson files, nothing here touches the DOM at load time.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;

  var MOVIE_ID = 'movie';           // narration ids of the opening/closing cards: movie.start.0, movie.end.0
  var TITLE = 'The Counting Movie';
  var GAP_MS = 700;                 // the player's pause between autoplayed steps

  var LINES = {
    start: 'Welcome to the counting movie! Sit back, watch, and listen.',
    end: 'The end! Thank you for watching. Now it is your turn: open a lesson, and try it yourself!',
    later: 'This part is for you to try. Do it later, in the lesson!'
  };

  // ---------------------------------------------------------------- pure helpers

  function sentence(text) {
    text = String(text || '').trim();
    return /[.!?…]$/.test(text) ? text : text + '.';
  }

  function chapterSay(lesson, number) {
    return 'Chapter ' + NS.digitsets.numberToWords(number) + '. ' + sentence(lesson.spokenTitle || lesson.shortTitle || lesson.title);
  }

  function hidden(el) { el.style.opacity = '0'; return el; }

  function glyph(kind) {
    kind = String(kind || '#');
    if (kind === 'dots') {
      return U.el('span', { class: 'movie-glyph movie-glyph-dots', 'aria-hidden': 'true' },
        U.el('i', { class: 'dot dot-red' }), U.el('i', { class: 'dot dot-yellow' }), U.el('i', { class: 'dot dot-green' }));
    }
    if (kind.indexOf('icon:') === 0) {
      return U.el('span', { class: 'movie-glyph movie-glyph-icon', 'aria-hidden': 'true' }, NS.icons.render(kind.slice(5)));
    }
    return U.el('span', { class: 'movie-glyph', 'aria-hidden': 'true', text: kind });
  }

  function popAll(ctx, list, sound) {
    if (ctx.sound && sound) ctx.sound(sound);
    return A.stagger(list, function (el) { return A.pop(el, ctx); }, 180, ctx);
  }

  // "Chapter 2 · Binary: Count to 1023 on Two Hands" card, the first scene of every movie copy.
  function chapterScene(lesson, number) {
    return {
      id: 'movie-chapter',
      title: 'Chapter ' + number,
      movieCard: 'chapter',
      setup: function (stage) {
        var parts = [
          hidden(U.el('p', { class: 'movie-card-kicker', text: 'Chapter ' + number })),
          hidden(glyph(lesson.glyph)),
          hidden(U.el('h3', { class: 'movie-card-title', text: lesson.title }))
        ];
        if (lesson.blurb) parts.push(hidden(U.el('p', { class: 'movie-card-text', text: lesson.blurb })));
        stage.appendChild(U.el('div', { class: 'movie-card movie-card-chapter' }, parts));
        return { parts: parts };
      },
      steps: [{ say: chapterSay(lesson, number), do: function (ctx) { return popAll(ctx, ctx.state.parts, 'whoosh'); } }]
    };
  }

  // Stand-in for an interactive scene ("You try it!"): the movie never waits for clicks.
  function laterScene(lesson, scene) {
    return {
      id: 'movie-' + scene.id,
      title: scene.title || 'You try it!',
      movieCard: 'later',
      setup: function (stage) {
        var parts = [
          hidden(U.el('span', { class: 'movie-glyph movie-glyph-icon', 'aria-hidden': 'true' }, NS.icons.render('hands', { kind: 'ui' }))),
          hidden(U.el('h3', { class: 'movie-card-title', text: scene.title || 'You try it!' })),
          hidden(U.el('p', { class: 'movie-card-text', text: 'Try this later in the lesson!' }))
        ];
        stage.appendChild(U.el('div', { class: 'movie-card movie-card-later' }, parts));
        return { parts: parts };
      },
      steps: [{ say: lesson.tryLater || LINES.later, do: function (ctx) { return popAll(ctx, ctx.state.parts, 'pop'); } }]
    };
  }

  // A copy of `lesson` for the movie: chapter card first, interactive scenes swapped for "later" cards.
  // The copy keeps the lesson's id (CSS scope, narration ids) and its real scene objects.
  function movieLesson(lesson, number) {
    var scenes = [chapterScene(lesson, number)].concat(lesson.scenes.map(function (scene) {
      return scene.interactive ? laterScene(lesson, scene) : scene;
    }));
    return Object.assign({}, lesson, { scenes: scenes, movieOf: lesson.id, movieChapter: number });
  }

  function cardLesson(sceneId, title, say, build) {
    return {
      id: MOVIE_ID, title: TITLE, shortTitle: 'Movie', theme: 'playground',
      scenes: [{
        id: sceneId, title: title, movieCard: sceneId,
        setup: function (stage) {
          var parts = build().map(hidden);
          stage.appendChild(U.el('div', { class: 'movie-card movie-card-' + sceneId }, parts));
          return { parts: parts };
        },
        steps: [{ say: say, do: function (ctx) { return popAll(ctx, ctx.state.parts, sceneId === 'end' ? 'tada' : 'whoosh'); } }]
      }]
    };
  }

  function openingLesson(lessons) {
    return cardLesson('start', 'Welcome', LINES.start, function () {
      return [
        U.el('h3', { class: 'movie-card-title movie-card-big', text: TITLE }),
        U.el('div', { class: 'movie-card-row' }, lessons.map(function (l) { return glyph(l.glyph); })),
        U.el('p', { class: 'movie-card-text', text: 'Sit back, watch and listen.' })
      ];
    });
  }

  function closingLesson() {
    return cardLesson('end', 'The end', LINES.end, function () {
      return [
        U.el('span', { class: 'movie-glyph movie-glyph-icon', 'aria-hidden': 'true' }, NS.icons.render('star')),
        U.el('h3', { class: 'movie-card-title movie-card-big', text: 'The End!' }),
        U.el('p', { class: 'movie-card-text', text: 'Now it is your turn: open a lesson and try it yourself!' })
      ];
    });
  }

  // How long a step should take (narration estimate + the autoplay gap), in ms at normal speed.
  function stepMs(step) {
    return NS.narrator.estimateMs(step.say, 1) / (NS.narrator.config.timeScale || 1) + GAP_MS;
  }

  // The whole movie: [{kind: 'open'|'chapter'|'close', lesson (the copy to play), source, number, title,
  //   weights: [ms per step], ms, startMs}]. `onlyId` = one lesson (no opening card). Unknown id -> null.
  function playlist(registry, onlyId) {
    registry = registry || NS.lessons;
    var lessons = registry.list();
    var entries = [];
    if (onlyId) {
      var only = lessons.filter(function (l) { return l.id === onlyId; })[0];
      if (!only) return null;
      entries.push({ kind: 'chapter', source: only, number: lessons.indexOf(only) + 1 });
    } else {
      if (!lessons.length) return null;
      entries.push({ kind: 'open', lesson: openingLesson(lessons) });
      lessons.forEach(function (l, i) { entries.push({ kind: 'chapter', source: l, number: i + 1 }); });
    }
    entries.push({ kind: 'close', lesson: closingLesson() });
    var at = 0;
    entries.forEach(function (e) {
      if (e.kind === 'chapter') e.lesson = movieLesson(e.source, e.number);
      e.title = e.kind === 'chapter' ? e.source.title : e.lesson.scenes[0].title;
      e.weights = [];
      e.lesson.scenes.forEach(function (sc) { sc.steps.forEach(function (st) { e.weights.push(stepMs(st)); }); });
      e.ms = e.weights.reduce(function (a, b) { return a + b; }, 0);
      e.startMs = at;
      at += e.ms;
    });
    entries.totalMs = at;
    return entries;
  }

  // Every narration line the app can play from a file: each step of each visible lesson, then the
  // movie's own cards. [{id, text, lessonId, lessonTitle, sceneId, sceneTitle, step, interactive, movie}]
  function narrationLines(registry) {
    registry = registry || NS.lessons;
    var out = [];
    function add(lesson, scene, i, extra) {
      out.push(Object.assign({
        id: NS.lessons.stepId(lesson.id, scene.id, i), text: scene.steps[i].say,
        lessonId: lesson.id, lessonTitle: lesson.title, sceneId: scene.id, sceneTitle: scene.title || '',
        step: i, interactive: !!scene.interactive, movie: false
      }, extra || {}));
    }
    registry.list().forEach(function (lesson) {
      lesson.scenes.forEach(function (scene) { scene.steps.forEach(function (st, i) { add(lesson, scene, i); }); });
    });
    var list = playlist(registry);
    (list || []).forEach(function (e) {
      e.lesson.scenes.forEach(function (scene) {
        if (!scene.movieCard) return;
        scene.steps.forEach(function (st, i) { add(e.lesson, scene, i, { movie: true }); });
      });
    });
    return out;
  }

  function minutes(ms) { return Math.max(1, Math.round(ms / 60000)); }

  // ---------------------------------------------------------------- the view

  // Screen recording of the movie (optional; Chrome/Edge over http(s)/localhost). Saves a .webm.
  function canRecordVideo() {
    return typeof navigator !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) &&
      typeof window.MediaRecorder === 'function';
  }

  function videoMime() {
    var types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < types.length; i++) {
      if (window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }

  function mount(stage, params) {
    params = params || {};
    var list = playlist(NS.lessons, params.id || null);
    var listeners = [];
    var destroyed = false;
    var current = -1;        // playlist index
    var player = null;
    var mode = 'idle';       // idle | playing | paused | ended
    var playerMode = 'idle';
    var playerPos = { scene: 0, step: 0 };
    var recorder = null;
    var videoUrl = null;
    var reducedMotion = U.prefersReducedMotion();

    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push(function () { target.removeEventListener(type, fn, opts); });
    }

    if (!list) {
      stage.appendChild(U.el('section', { class: 'placeholder' },
        U.el('h1', { class: 'view-heading', tabindex: '-1', text: 'Movie not found' }),
        U.el('p', { class: 'lead', text: 'There is no lesson called "' + params.id + '".' }),
        U.el('a', { class: 'btn btn-primary', href: NS.router.href('movie') }, 'Watch the whole movie')));
      return { destroy: function () {} };
    }

    var single = params.id ? list[0].source : null;
    var heading = single ? 'Movie: ' + (single.shortTitle || single.title) : TITLE;
    var chapters = list.filter(function (e) { return e.kind === 'chapter'; });

    // ---- controls
    function iconButton(name, label, onClick, cls) {
      return U.el('button', { type: 'button', class: 'icon-btn ' + (cls || ''), 'aria-label': label, title: label, onClick: onClick },
        NS.player.icon(name));
    }
    function setIcon(btn, name) { var p = btn.querySelector('path'); if (p) p.setAttribute('d', NS.player.ICONS[name]); }

    var prevBtn = iconButton('prev', 'Previous chapter', function () { prevChapter(); });
    var playBtn = iconButton('play', 'Play', function () { togglePlay(); }, 'icon-btn-main movie-play');
    var nextBtn = iconButton('next', 'Next chapter', function () { nextChapter(); });
    var voiceBtn = iconButton('voice', 'Voice', function () { toggleVoice(); });
    var soundBtn = iconButton('sound', 'Sound effects', function () { NS.sound.setMuted(!NS.sound.isMuted()); updateBar(); });
    var fsBtn = iconButton('fullscreen', 'Full screen', function () { toggleFullscreen(); });
    var closeLink = U.el('a', { class: 'icon-btn movie-close', href: NS.router.href('home'), 'aria-label': 'Close the movie', title: 'Close the movie' },
      NS.icons.render('home', { kind: 'ui', class: 'icon' }));
    var nowLabel = U.el('p', { class: 'movie-now', 'aria-live': 'polite' });
    var partLabel = U.el('p', { class: 'movie-part' });
    var recBadge = U.el('span', { class: 'movie-rec', hidden: true }, U.el('i', { 'aria-hidden': 'true' }), 'Recording',
      U.el('button', { type: 'button', class: 'btn btn-small', onClick: function () { stopRecording(); } }, 'Stop'));

    var fill = U.el('div', { class: 'movie-progress-fill' });
    var track = U.el('div', { class: 'movie-progress-track', role: 'progressbar', 'aria-label': 'Movie progress',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, fill);
    var markers = chapters.map(function (e) {
      var left = list.totalMs ? 100 * e.startMs / list.totalMs : 0;
      return U.el('button', {
        type: 'button', class: 'movie-marker theme-' + (e.source.theme || 'base10'),
        style: { left: left + '%' }, 'aria-label': 'Chapter ' + e.number + ': ' + e.title, title: 'Chapter ' + e.number + ': ' + e.title,
        onClick: function () { playEntry(list.indexOf(e)); }
      }, String(e.number));
    });
    var progress = U.el('div', { class: 'movie-progress' }, track, markers);

    var bar = U.el('div', { class: 'movie-bar' },
      U.el('div', { class: 'movie-bar-top' },
        U.el('h1', { class: 'view-heading movie-heading', tabindex: '-1', text: heading }), nowLabel, partLabel, recBadge),
      progress,
      U.el('div', { class: 'movie-controls' },
        U.el('div', { class: 'control-group' }, prevBtn, playBtn, nextBtn),
        U.el('div', { class: 'control-group' }, voiceBtn, soundBtn, fsBtn, closeLink)));

    var screen = U.el('div', { class: 'movie-screen' });
    var overlay = U.el('div', { class: 'movie-overlay' });
    var root = U.el('section', { class: 'movie theme-playground' }, bar, U.el('div', { class: 'movie-frame' }, screen, overlay));
    stage.appendChild(root);

    var captions = document.getElementById('captions');

    // ---- poster (before Start)
    function poster() {
      U.clear(overlay);
      var startBtn = U.el('button', { type: 'button', class: 'btn-start movie-start', onClick: function () { start(0, false); } },
        NS.player.icon('play'), U.el('span', { class: 'btn-start-label', text: 'Watch' }));
      var items = chapters.map(function (e) {
        return U.el('li', { class: 'theme-' + (e.source.theme || 'base10') },
          U.el('button', { type: 'button', class: 'movie-chapter-link', onClick: function () { start(list.indexOf(e), false); } },
            glyph(e.source.glyph), U.el('span', { class: 'movie-chapter-name', text: e.title }),
            U.el('span', { class: 'movie-chapter-min', text: minutes(e.ms) + ' min' })));
      });
      var recordRow = null;
      if (canRecordVideo()) {
        recordRow = U.el('div', { class: 'movie-record' },
          U.el('button', { type: 'button', class: 'btn', onClick: function () { recordAndStart(); } }, 'Record a video of it'),
          U.el('p', { class: 'muted movie-note', text: 'Pick "this tab" when the browser asks, and tick "share tab audio". ' +
            'Browser voices are often not recorded; see docs/making-a-video.md.' }));
      }
      overlay.appendChild(U.el('div', { class: 'movie-poster' },
        startBtn,
        U.el('p', { class: 'movie-poster-lead', text: (single ? 'This lesson' : 'Every lesson, one after another') +
          ', like a video. About ' + minutes(list.totalMs) + ' minutes. The "You try it!" parts are left for later.' }),
        chapters.length > 1 ? U.el('ol', { class: 'movie-chapter-list', 'aria-label': 'Chapters' }, items) : null,
        U.el('p', { class: 'movie-status', 'aria-live': 'polite' }),
        recordRow));
      overlay.hidden = false;
    }

    // ---- the end
    function finish() {
      mode = 'ended';
      if (player) { player.destroy(); player = null; }
      U.clear(screen);
      current = list.length - 1;
      if (recorder) stopRecording();
      NS.sound.play('tada');
      U.clear(overlay);
      var lessonLinks = chapters.map(function (e) {
        return U.el('a', { class: 'btn theme-' + (e.source.theme || 'base10'), href: NS.router.href('lesson', { id: e.source.id }) },
          e.source.shortTitle || e.title);
      });
      overlay.appendChild(U.el('div', { class: 'end-card movie-end' },
        reducedMotion ? null : confetti(),
        U.el('p', { class: 'end-title', text: 'The End!' }),
        U.el('p', { class: 'end-sub', text: 'Now try it yourself:' }),
        U.el('div', { class: 'end-actions' }, lessonLinks),
        videoBox(),
        U.el('div', { class: 'end-actions' },
          U.el('button', { type: 'button', class: 'btn btn-primary movie-again', onClick: function () { start(0, false); } }, 'Watch again'),
          U.el('a', { class: 'btn', href: NS.router.href('home') }, 'Home'))));
      overlay.hidden = false;
      if (captions) captions.hidden = true;
      updateBar();
      var again = overlay.querySelector('.movie-again');
      if (again) again.focus({ preventScroll: true });
    }

    function confetti() {
      var colors = ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#8e24aa', '#f07b16'];
      return U.el('div', { class: 'confetti', 'aria-hidden': 'true' }, U.range(40).map(function (i) {
        return U.el('i', { style: {
          left: (Math.random() * 100) + '%', background: colors[i % colors.length],
          animationDelay: (Math.random() * 0.6) + 's', animationDuration: (1.6 + Math.random() * 1.2) + 's'
        } });
      }));
    }

    // ---- playing
    function playEntry(i) {
      if (destroyed) return;
      if (i < 0) i = 0;
      if (i >= list.length) { finish(); return; }
      if (player) { player.destroy(); player = null; }
      U.clear(screen);
      overlay.hidden = true;
      current = i;
      mode = 'playing';
      playerMode = 'idle';
      playerPos = { scene: 0, step: 0 };
      var entry = list[i];
      root.className = 'movie theme-' + (entry.lesson.theme || 'playground');
      player = NS.player.mount(screen, entry.lesson, { scene: 0, step: 0 }, { movie: {
        onUpdate: function (s) {
          playerMode = s.mode;
          playerPos = s.pos;
          if (s.mode === 'paused') mode = 'paused';
          else if (s.mode === 'playing') mode = 'playing';
          updateBar();
        },
        onEnd: function () {
          // Defer: we are inside the old player's call stack.
          Promise.resolve().then(function () { if (!destroyed && current === i) playEntry(i + 1); });
        }
      } });
      updateBar();
    }

    function start(i, recording) {
      NS.narrator.unlock();
      NS.sound.unlock();
      if (!recording) enterFullscreen();
      playEntry(i);
      playBtn.focus({ preventScroll: true });
    }

    function togglePlay() {
      if (mode === 'idle') { start(0, false); return; }
      if (mode === 'ended') { start(0, false); return; }
      if (!player) return;
      if (mode === 'paused') { mode = 'playing'; player.play(); }
      else { mode = 'paused'; player.pause(); }
      updateBar();
    }

    function nextChapter() {
      if (mode === 'idle' || mode === 'ended') return;
      for (var i = current + 1; i < list.length; i++) if (list[i].kind === 'chapter') { playEntry(i); return; }
      playEntry(list.length - 1); // the closing card
    }

    function prevChapter() {
      if (mode === 'idle') return;
      // A little way into a chapter, "previous" restarts it (like a music player); at its start, go back one.
      var flat = player ? NS.playerState.flatIndex(list[current].lesson, playerPos) : 0;
      if (mode !== 'ended' && flat > 1) { playEntry(current); return; }
      for (var i = Math.min(current, list.length) - 1; i >= 0; i--) if (list[i].kind !== 'close') { playEntry(i); return; }
      playEntry(0);
    }

    function toggleVoice() {
      if (player) player.toggleVoice();
      else NS.narrator.setVoiceOn(!NS.narrator.isVoiceOn());
      updateBar();
    }

    // ---- full screen (the whole page, so the captions bar comes too; CSS fallback where the API is missing)
    function isFullscreen() { return document.documentElement.classList.contains('is-fullscreen'); }
    function enterFullscreen() {
      var docEl = document.documentElement;
      if (isFullscreen()) return;
      docEl.classList.add('is-fullscreen');
      if (docEl.requestFullscreen && !document.fullscreenElement) {
        try { var p = docEl.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* CSS fallback stays */ }
      }
      updateBar();
    }
    function exitFullscreen() {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
      document.documentElement.classList.remove('is-fullscreen');
      updateBar();
    }
    function toggleFullscreen() { if (isFullscreen()) exitFullscreen(); else enterFullscreen(); }
    on(document, 'fullscreenchange', function () {
      // Leaving real full screen (Esc) leaves the page view too.
      if (!document.fullscreenElement) document.documentElement.classList.remove('is-fullscreen');
      updateBar();
    });

    // ---- recording a video (optional)
    function status(text) {
      var el = overlay.querySelector('.movie-status');
      if (el) el.textContent = text;
    }

    function recordAndStart() {
      NS.narrator.unlock();
      NS.sound.unlock();
      status('Choose this tab in the box the browser shows…');
      var opts = { video: { frameRate: 30 }, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' };
      navigator.mediaDevices.getDisplayMedia(opts).then(function (stream) {
        if (destroyed) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        var chunks = [];
        var mime = videoMime();
        recorder = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); });
          if (videoUrl) URL.revokeObjectURL(videoUrl);
          videoUrl = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })) : null;
          recorder = null;
          updateBar();
          if (destroyed) return;
          var box = overlay.querySelector('.movie-video');
          if (box) box.replaceWith(videoBox());
          else if (mode !== 'ended') showVideoReady();
        };
        stream.getVideoTracks().forEach(function (t) { t.addEventListener('ended', function () { stopRecording(); }); });
        recorder.start(1000);
        start(0, true);
        updateBar();
      }).catch(function (err) {
        status('The recording did not start' + (err && err.name === 'NotAllowedError' ? ' (it was not allowed).' : err && err.name ? ' (' + err.name + ').' : '.') +
          ' You can still press Watch, and record with your computer\'s screen recorder.');
      });
    }

    function stopRecording() {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      updateBar();
    }

    function videoBox() {
      if (recorder) return U.el('div', { class: 'movie-video' }, U.el('p', { text: 'Getting the video ready…' }));
      if (!videoUrl) return null;
      return U.el('div', { class: 'movie-video' },
        U.el('a', { class: 'btn btn-primary', href: videoUrl, download: 'counting-movie.webm' }, 'Save the video'),
        U.el('p', { class: 'muted movie-note', text: 'It saves as counting-movie.webm. Most video players and YouTube can open it.' }));
    }

    // Recording stopped mid-movie (the "Stop" button, or sharing ended): pause and offer the file.
    function showVideoReady() {
      if (player && mode === 'playing') { mode = 'paused'; player.pause(); }
      U.clear(overlay);
      overlay.appendChild(U.el('div', { class: 'end-card' },
        U.el('p', { class: 'end-title', text: 'Recording stopped' }), videoBox(),
        U.el('div', { class: 'end-actions' },
          U.el('button', { type: 'button', class: 'btn', onClick: function () { overlay.hidden = true; togglePlay(); } }, 'Keep watching'))));
      overlay.hidden = false;
      updateBar();
    }

    // ---- bar
    function progressPct() {
      if (mode === 'ended') return 100;
      if (current < 0) return 0;
      var e = list[current];
      var flat = NS.playerState.flatIndex(e.lesson, playerPos) + (playerMode === 'waiting' || playerMode === 'ended' ? 1 : 0);
      var ms = e.startMs;
      for (var i = 0; i < flat && i < e.weights.length; i++) ms += e.weights[i];
      return list.totalMs ? Math.min(100, 100 * ms / list.totalMs) : 0;
    }

    function updateBar() {
      if (destroyed) return;
      var pct = progressPct();
      fill.style.width = pct.toFixed(2) + '%';
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
      var e = list[current];
      var label = '';
      if (mode === 'ended') label = 'The end';
      else if (e && e.kind === 'chapter') label = 'Chapter ' + e.number + ' of ' + (chapters.length === 1 ? NS.lessons.list().length : chapters.length) + ': ' + (e.source.shortTitle || e.title);
      else if (e) label = e.title;
      if (nowLabel.textContent !== label) nowLabel.textContent = label;
      // The part being played, unless it is one of the movie's own cards.
      var scene = e && mode !== 'ended' && e.lesson.scenes[playerPos.scene];
      var part = scene && !scene.movieCard ? scene.title || '' : '';
      if (partLabel.textContent !== part) partLabel.textContent = part;
      markers.forEach(function (m, k) {
        var idx = list.indexOf(chapters[k]);
        m.classList.toggle('is-current', idx === current && mode !== 'ended');
        m.classList.toggle('is-done', idx < current || mode === 'ended');
      });
      var playing = mode === 'playing';
      setIcon(playBtn, playing ? 'pause' : 'play');
      playBtn.setAttribute('aria-label', playing ? 'Pause' : (mode === 'paused' ? 'Resume' : 'Play'));
      playBtn.title = playing ? 'Pause (space)' : 'Play (space)';
      prevBtn.disabled = mode === 'idle';
      nextBtn.disabled = mode === 'idle' || mode === 'ended';
      var voiceOn = NS.narrator.isVoiceOn();
      voiceBtn.setAttribute('aria-pressed', String(voiceOn));
      setIcon(voiceBtn, voiceOn ? 'voice' : 'voiceOff');
      voiceBtn.title = voiceOn ? 'Voice on' : 'Voice off (captions only)';
      soundBtn.setAttribute('aria-pressed', String(!NS.sound.isMuted()));
      fsBtn.setAttribute('aria-pressed', String(isFullscreen()));
      recBadge.hidden = !recorder;
      root.dataset.mode = mode;
    }

    // ---- keyboard: Space pause/resume, ←/→ chapters, F full screen, Esc leaves the page full screen
    on(document, 'keydown', function (e) {
      if (destroyed || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (tag === 'BUTTON' || tag === 'A') return;
        e.preventDefault(); togglePlay();
      } else if (e.key === 'ArrowRight') { e.preventDefault(); nextChapter(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevChapter(); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
      else if (e.key === 'Escape' && isFullscreen() && !document.fullscreenElement) { exitFullscreen(); }
    });
    on(document, 'visibilitychange', function () {
      if (document.hidden && mode === 'playing' && player && !recorder) { mode = 'paused'; player.pause(); updateBar(); }
    });

    poster();
    updateBar();

    return {
      destroy: function () {
        destroyed = true;
        if (player) { player.destroy(); player = null; }
        if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch (e) { /* ignore */ } }
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        listeners.forEach(function (off) { off(); });
        listeners = [];
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
        document.documentElement.classList.remove('is-fullscreen');
        NS.narrator.stop();
      },
      // For tests:
      getState: function () { return { mode: mode, index: current, entry: current >= 0 ? list[current].kind : null, pos: playerPos, playerMode: playerMode }; }
    };
  }

  NS.movie = {
    mount: mount,
    helpers: {
      MOVIE_ID: MOVIE_ID,
      LINES: LINES,
      chapterSay: chapterSay,
      movieLesson: movieLesson,
      playlist: playlist,
      narrationLines: narrationLines,
      stepMs: stepMs
    }
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
