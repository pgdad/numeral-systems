// Scene player: plays a lesson (scenes of steps) with narration, captions and controls.
//   NS.player.mount(stage, lesson, {scene, step}) -> { destroy() }      (DECISIONS D11)
//
// How a step plays: narration (NS.narrator) and the step's do(ctx) animation run together;
// the step is finished when both are. Jumping anywhere (Prev, chapter dots, deep links) is done
// by re-running the scene's setup and replaying earlier steps with ctx.instant = true.
// Every run has its own AbortController, so skipping mid-animation stops everything cleanly.
(function (NS) {
  'use strict';

  var U = NS.util;
  var SPEEDS = [0.75, 1, 1.25];

  // Inline SVG icons (24x24 viewBox). Phase 03 may move these into components/icons.js.
  var ICONS = {
    play: 'M8 5.5v13l11-6.5z',
    pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
    prev: 'M16 4.5 7.5 12l8.5 7.5 1.8-2.1-6-5.4 6-5.4z',
    next: 'M8 4.5l8.5 7.5L8 19.5l-1.8-2.1 6-5.4-6-5.4z',
    replay: 'M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H4.5A7.5 7.5 0 1 0 12 5z',
    restart: 'M5 5h2.5v14H5zM19 5v14l-9-7z',
    voice: 'M4 9v6h4l5 4.5V4.5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
    voiceOff: 'M4 9v6h4l5 4.5V4.5L8 9zm11.3-1.2L14 9.1l2.9 2.9L14 14.9l1.3 1.3 2.9-2.9 2.9 2.9 1.3-1.3-2.9-2.9 2.9-2.9-1.3-1.3-2.9 2.9z',
    sound: 'M9 3v10.6A4 4 0 1 0 11 17V7h6V3z',
    fullscreen: 'M4 4h6v2.5H6.5V10H4zm10 0h6v6h-2.5V6.5H14zM4 14h2.5v3.5H10V20H4zm13.5 0H20v6h-6v-2.5h3.5z',
    autoplay: 'M4 6h10v2.5H4zm0 4.75h10v2.5H4zM4 15.5h6V18H4zm11-4v9l6.5-4.5z'
  };

  function icon(name) {
    return U.svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', class: 'icon' },
      U.svg('path', { d: ICONS[name], fill: 'currentColor' }));
  }

  function iconButton(name, label, onClick, extra) {
    var attrs = Object.assign({ type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onClick: onClick }, extra || {});
    return U.el('button', attrs, icon(name));
  }

  function setIcon(button, name) {
    var path = button.querySelector('path');
    if (path) path.setAttribute('d', ICONS[name]);
  }

  function mount(stage, lesson, startPos) {
    var PS = NS.playerState;
    var settings = {
      speed: U.storage.get('player.speed', 1),
      autoplay: U.storage.get('player.autoplay', false)
    };
    if (SPEEDS.indexOf(settings.speed) === -1) settings.speed = 1;

    var deepLinked = !!(startPos && Number.isInteger(startPos.scene) && Number.isInteger(startPos.step));
    var pos = PS.clampPos(lesson, startPos);
    var live = null;      // {scene, state, completedThrough}; completedThrough -2 = "dirty"
    var mode = 'idle';    // idle | playing | waiting | paused | ended
    var runCtrl = null;
    var gen = 0;
    var destroyed = false;
    var reducedMotion = U.prefersReducedMotion();
    var listeners = [];

    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push(function () { target.removeEventListener(type, fn, opts); });
    }

    // ---------------------------------------------------------------- DOM
    var sceneTitle = U.el('p', { class: 'scene-title' });
    var stageEl = U.el('div', { class: 'player-stage', role: 'region', 'aria-label': 'Lesson picture' });
    var startBtn = U.el('button', { type: 'button', class: 'btn-start', onClick: function () { play(); } },
      icon('play'), U.el('span', { class: 'btn-start-label', text: deepLinked && (pos.scene || pos.step) ? 'Start here' : 'Start' }));
    var startOverlay = U.el('div', { class: 'player-overlay player-overlay-start' }, startBtn);
    var endOverlay = U.el('div', { class: 'player-overlay player-overlay-end', hidden: true });
    var frame = U.el('div', { class: 'player-frame' }, stageEl, startOverlay, endOverlay);

    var progressFill = U.el('div', { class: 'player-progress-fill' });
    var progress = U.el('div', { class: 'player-progress', role: 'progressbar', 'aria-label': 'Lesson progress',
      'aria-valuemin': '0', 'aria-valuemax': '100' }, progressFill);

    var chapterBtns = lesson.scenes.map(function (scene, i) {
      return U.el('button', {
        type: 'button', class: 'chapter-dot', title: scene.title || ('Part ' + (i + 1)),
        'aria-label': 'Part ' + (i + 1) + (scene.title ? ': ' + scene.title : ''),
        onClick: function () { go({ scene: i, step: 0 }); }
      }, String(i + 1));
    });
    var chapters = U.el('nav', { class: 'player-chapters', 'aria-label': 'Lesson parts' }, chapterBtns);

    var prevBtn = iconButton('prev', 'Previous step', function () { go(PS.prev(lesson, pos)); });
    var playBtn = iconButton('play', 'Play', function () { togglePlay(); }, { class: 'icon-btn icon-btn-main' });
    var nextBtn = U.el('button', { type: 'button', class: 'icon-btn next-btn', 'aria-label': 'Next step', title: 'Next step',
      onClick: function () { goNext(); } }, icon('next'), U.el('span', { class: 'next-label', text: 'Next' }));
    var replayBtn = iconButton('replay', 'Replay this step', function () { go(pos); });
    var restartBtn = iconButton('restart', 'Restart this part', function () { go({ scene: pos.scene, step: 0 }); });

    var autoBtn = iconButton('autoplay', 'Autoplay', function () { setAutoplay(!settings.autoplay); },
      { 'aria-pressed': String(settings.autoplay) });
    var speedBtn = U.el('button', { type: 'button', class: 'icon-btn speed-btn', title: 'Speed',
      onClick: function () { cycleSpeed(); } });
    var voiceBtn = iconButton(NS.narrator.isVoiceOn() ? 'voice' : 'voiceOff', 'Voice', function () { toggleVoice(); },
      { 'aria-pressed': String(NS.narrator.isVoiceOn()) });
    var soundBtn = iconButton('sound', 'Sound effects', function () { toggleSound(); },
      { 'aria-pressed': String(!NS.sound.isMuted()) });
    var fsBtn = iconButton('fullscreen', 'Full screen', function () { toggleFullscreen(); });

    var controls = U.el('div', { class: 'player-controls' },
      U.el('div', { class: 'control-group' }, prevBtn, playBtn, nextBtn),
      U.el('div', { class: 'control-group' }, replayBtn, restartBtn),
      U.el('div', { class: 'control-group control-settings' }, autoBtn, speedBtn, voiceBtn, soundBtn, fsBtn));

    var root = U.el('section', { class: ['player', 'lesson-' + lesson.id, 'theme-' + (lesson.theme || 'base10')] },
      U.el('header', { class: 'player-head' },
        U.el('h1', { class: 'view-heading', tabindex: '-1', text: lesson.title }), sceneTitle),
      frame, progress, chapters, controls);
    stage.appendChild(root);

    var captions = document.getElementById('captions');
    NS.narrator.setCaptionElement(captions);
    if (captions) captions.hidden = true;

    // ---------------------------------------------------------------- running steps
    function makeCtx(scene, state, instant, signal) {
      var ctx = {
        lesson: lesson, scene: scene, stage: stageEl, state: state,
        instant: !!instant, speed: settings.speed, reducedMotion: reducedMotion,
        signal: signal, abortSignal: signal, anim: NS.anim, player: api
      };
      ctx.wait = function (ms) { return NS.anim.wait(ms, ctx); };
      ctx.sound = function (name) { return (ctx.instant || signal.aborted) ? 0 : NS.sound.play(name); };
      return ctx;
    }

    function teardownLive() {
      if (!live) return;
      var scene = lesson.scenes[live.scene];
      if (scene.teardown) {
        try { scene.teardown(stageEl, makeCtx(scene, live.state, true, new AbortController().signal)); }
        catch (e) { console.error(e); }
      }
      live = null;
    }

    // Fresh setup of `sceneIndex`, then instant-replay steps [0, uptoStep).
    function rebuild(sceneIndex, uptoStep, signal) {
      teardownLive();
      U.clear(stageEl);
      var scene = lesson.scenes[sceneIndex];
      stageEl.className = 'player-stage scene-' + scene.id;
      var state = {};
      live = { scene: sceneIndex, state: state, completedThrough: -2 };
      var ctx = makeCtx(scene, state, true, signal);
      return Promise.resolve(scene.setup ? scene.setup(stageEl, ctx) : null).then(function (ret) {
        if (ret && typeof ret === 'object' && ret !== state) Object.assign(state, ret);
        var chain = Promise.resolve();
        for (var i = 0; i < uptoStep; i++) {
          (function (step) {
            chain = chain.then(function () {
              if (signal.aborted) throw U.abortError();
              return step.do ? step.do(ctx) : null;
            });
          })(scene.steps[i]);
        }
        return chain;
      }).then(function () {
        live.completedThrough = uptoStep - 1;
      });
    }

    function abortRun() {
      if (runCtrl) runCtrl.abort();
      runCtrl = null;
    }

    function playStep(target) {
      var myGen = ++gen;
      abortRun();
      NS.narrator.stop();
      var ctrl = new AbortController();
      runCtrl = ctrl;
      var signal = ctrl.signal;
      pos = target;
      mode = 'playing';
      hideOverlays();
      updateUI();
      updateHash();

      var scene = lesson.scenes[target.scene];
      var step = scene.steps[target.step];
      var needsRebuild = PS.plan(live, target) === 'rebuild';

      return Promise.resolve(needsRebuild ? rebuild(target.scene, target.step, signal) : null).then(function () {
        if (myGen !== gen) return;
        live.completedThrough = -2; // dirty until this step finishes
        var ctx = makeCtx(scene, live.state, false, signal);
        var id = NS.lessons.stepId(lesson.id, scene.id, target.step);
        if (captions) captions.hidden = false;
        return Promise.all([
          NS.narrator.speak(id, step.say, { rate: settings.speed, signal: signal }),
          step.do ? step.do(ctx) : null
        ]).then(function () {
          if (myGen !== gen) return;
          live.completedThrough = target.step;
          mode = 'waiting';
          updateUI();
          if (settings.autoplay && !scene.interactive) {
            return U.sleep(700 / settings.speed, signal).then(function () {
              if (myGen === gen && mode === 'waiting') goNext();
            });
          }
        });
      }).catch(function (err) {
        if (U.isAbortError(err)) return;
        console.error('Step failed:', NS.lessons.stepId(lesson.id, scene.id, target.step), err);
        if (myGen === gen) { mode = 'waiting'; updateUI(); }
      });
    }

    // Show the picture as it is just before `target` (no narration). Used on mount and deep links.
    function prepare(target) {
      var myGen = ++gen;
      abortRun();
      var ctrl = new AbortController();
      runCtrl = ctrl;
      pos = target;
      updateUI();
      return rebuild(target.scene, target.step, ctrl.signal).catch(function (err) {
        if (!U.isAbortError(err)) console.error(err);
      }).then(function () { if (myGen === gen) updateUI(); });
    }

    // ---------------------------------------------------------------- actions
    function ensureStarted() {
      if (mode !== 'idle') return;
      NS.narrator.unlock();
      NS.sound.unlock();
    }

    function go(target) {
      if (destroyed || !target) return;
      ensureStarted();
      playStep(PS.clampPos(lesson, target));
    }

    function goNext() {
      if (destroyed) return;
      ensureStarted();
      if (mode === 'idle') { playStep(pos); return; }
      var n = PS.next(lesson, pos);
      if (n) playStep(n);
      else showEnd();
    }

    function play() {
      ensureStarted();
      if (mode === 'idle' || mode === 'paused') playStep(pos);
      else if (mode === 'waiting') goNext();
      else if (mode === 'ended') playStep({ scene: 0, step: 0 });
    }

    function pause() {
      if (mode !== 'playing' && mode !== 'waiting') return;
      ++gen;
      abortRun();
      NS.narrator.stop();
      if (live) live.completedThrough = -2; // picture may be mid-step; Play rebuilds and replays
      mode = 'paused';
      updateUI();
    }

    function togglePlay() {
      if (mode === 'playing') pause();
      else play();
    }

    function setAutoplay(onOff) {
      settings.autoplay = !!onOff;
      U.storage.set('player.autoplay', settings.autoplay);
      updateUI();
      if (settings.autoplay && mode === 'waiting' && !lesson.scenes[pos.scene].interactive) goNext();
    }

    function cycleSpeed() {
      settings.speed = SPEEDS[(SPEEDS.indexOf(settings.speed) + 1) % SPEEDS.length];
      U.storage.set('player.speed', settings.speed);
      updateUI();
    }

    function toggleVoice() {
      NS.narrator.setVoiceOn(!NS.narrator.isVoiceOn());
      updateUI();
      if (mode === 'playing') playStep(pos); // restart the step in the new mode
    }

    function toggleSound() {
      NS.sound.setMuted(!NS.sound.isMuted());
      updateUI();
    }

    // Full screen: the whole page (so the caption bar comes along); header/footer hide via CSS.
    // Falls back to a CSS-only "pseudo full screen" where the API is missing (e.g. iPhone).
    function isFullscreen() { return document.documentElement.classList.contains('is-fullscreen'); }
    function syncFullscreenClass() {
      document.documentElement.classList.toggle('is-fullscreen', !!document.fullscreenElement);
      updateUI();
    }
    function toggleFullscreen() {
      var docEl = document.documentElement;
      if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); return; }
      if (isFullscreen()) { docEl.classList.remove('is-fullscreen'); updateUI(); return; }
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(function () { docEl.classList.add('is-fullscreen'); updateUI(); });
      } else {
        docEl.classList.add('is-fullscreen');
        updateUI();
      }
    }

    // ---------------------------------------------------------------- end of lesson
    function nextLesson() {
      var visible = NS.lessons.list();
      var idx = visible.indexOf(lesson);
      return visible[idx + 1] || null;
    }

    function confetti() {
      if (reducedMotion) return null;
      var colors = ['#e53935', '#fbc02d', '#43a047', '#1e88e5', '#8e24aa', '#f07b16'];
      return U.el('div', { class: 'confetti', 'aria-hidden': 'true' }, U.range(40).map(function (i) {
        return U.el('i', { style: {
          left: (Math.random() * 100) + '%',
          background: colors[i % colors.length],
          animationDelay: (Math.random() * 0.6) + 's',
          animationDuration: (1.6 + Math.random() * 1.2) + 's',
          transform: 'rotate(' + Math.round(Math.random() * 360) + 'deg)'
        } });
      }));
    }

    function showEnd() {
      ++gen;
      abortRun();
      NS.narrator.stop();
      mode = 'ended';
      if (captions) captions.hidden = true;
      NS.sound.play('tada');
      var nl = nextLesson();
      U.clear(endOverlay);
      endOverlay.appendChild(U.el('div', { class: 'end-card' },
        confetti(),
        U.el('p', { class: 'end-title', text: 'Hooray! You finished!' }),
        U.el('p', { class: 'end-sub', text: lesson.title }),
        U.el('div', { class: 'end-actions' },
          U.el('button', { type: 'button', class: 'btn', onClick: function () { go({ scene: 0, step: 0 }); } }, 'Watch again'),
          nl ? U.el('a', { class: 'btn btn-primary', href: NS.router.href('lesson', { id: nl.id }) }, 'Next: ' + (nl.shortTitle || nl.title)) : null,
          U.el('a', { class: 'btn', href: NS.router.href('home') }, 'Home'))));
      endOverlay.hidden = false;
      updateUI();
      var first = endOverlay.querySelector('.btn-primary, .btn');
      if (first) first.focus({ preventScroll: true });
    }

    function hideOverlays() {
      startOverlay.hidden = true;
      endOverlay.hidden = true;
    }

    // ---------------------------------------------------------------- UI sync
    function updateHash() {
      NS.router.replace(NS.router.href('lesson', { id: lesson.id, scene: pos.scene, step: pos.step }));
    }

    function updateUI() {
      if (destroyed) return;
      var scene = lesson.scenes[pos.scene];
      sceneTitle.textContent = 'Part ' + (pos.scene + 1) + ' of ' + lesson.scenes.length + (scene.title ? ': ' + scene.title : '');
      chapterBtns.forEach(function (b, i) {
        b.classList.toggle('is-current', i === pos.scene);
        b.classList.toggle('is-done', i < pos.scene || mode === 'ended');
        if (i === pos.scene) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      var total = PS.totalSteps(lesson);
      var done = mode === 'ended' ? total : PS.flatIndex(lesson, pos) + (mode === 'waiting' ? 1 : 0);
      var pct = Math.round(100 * done / total);
      progressFill.style.width = pct + '%';
      progress.setAttribute('aria-valuenow', String(pct));

      var playing = mode === 'playing';
      setIcon(playBtn, playing ? 'pause' : 'play');
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      playBtn.title = playing ? 'Pause (space)' : 'Play (space)';
      prevBtn.disabled = mode === 'idle' || (pos.scene === 0 && pos.step === 0);

      var interactive = !!scene.interactive;
      nextBtn.classList.toggle('is-cta', (interactive || !settings.autoplay) && mode === 'waiting');
      nextBtn.querySelector('.next-label').textContent = interactive && mode === 'waiting' ? "I'm done!" : 'Next';
      root.classList.toggle('is-interactive', interactive);
      root.dataset.mode = mode;

      autoBtn.setAttribute('aria-pressed', String(settings.autoplay));
      speedBtn.textContent = (settings.speed === 0.75 ? '¾' : settings.speed === 1.25 ? '1¼' : '1') + '×';
      speedBtn.setAttribute('aria-label', 'Speed ' + settings.speed + ' times');
      var voiceOn = NS.narrator.isVoiceOn();
      voiceBtn.setAttribute('aria-pressed', String(voiceOn));
      setIcon(voiceBtn, voiceOn ? 'voice' : 'voiceOff');
      voiceBtn.title = voiceOn ? 'Voice on' : 'Voice off (captions only)';
      soundBtn.setAttribute('aria-pressed', String(!NS.sound.isMuted()));
      fsBtn.setAttribute('aria-pressed', String(isFullscreen()));
    }

    // ---------------------------------------------------------------- keyboard & visibility
    on(document, 'keydown', function (e) {
      if (destroyed || e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      var tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (tag === 'BUTTON' || tag === 'A') return; // let the focused control handle it
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (mode !== 'idle') go(PS.prev(lesson, pos));
      } else if (e.key === 'Escape' && isFullscreen() && !document.fullscreenElement) {
        document.documentElement.classList.remove('is-fullscreen');
        updateUI();
      }
    });
    on(document, 'fullscreenchange', syncFullscreenClass);
    on(document, 'visibilitychange', function () { if (document.hidden && mode === 'playing') pause(); });

    // ---------------------------------------------------------------- public API
    var api = {
      destroy: function () {
        destroyed = true;
        ++gen;
        abortRun();
        NS.narrator.stop();
        teardownLive();
        listeners.forEach(function (off) { off(); });
        listeners = [];
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
        document.documentElement.classList.remove('is-fullscreen');
        if (captions) { captions.hidden = true; U.clear(captions); }
        NS.narrator.setCaptionElement(null);
      },
      // For lessons/tests/Movie mode:
      play: play, pause: pause, next: goNext, go: go,
      setAutoplay: setAutoplay,
      getMode: function () { return mode; },
      getPosition: function () { return { scene: pos.scene, step: pos.step }; }
    };

    updateUI();
    prepare(pos);
    return api;
  }

  NS.player = { mount: mount, ICONS: ICONS, icon: icon };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
