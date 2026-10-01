// Pure step-position logic for the player (no DOM; unit-tested).
// A position is {scene, step} (0-based). The "current" step is the one being shown/played.
(function (NS) {
  'use strict';

  function counts(lesson) {
    return lesson.scenes.map(function (s) { return s.steps.length; });
  }

  // Clamp any (possibly missing / out-of-range) position into the lesson.
  function clampPos(lesson, pos) {
    var c = counts(lesson);
    var scene = pos && Number.isInteger(pos.scene) ? pos.scene : 0;
    scene = Math.max(0, Math.min(c.length - 1, scene));
    var step = pos && Number.isInteger(pos.step) ? pos.step : 0;
    step = Math.max(0, Math.min(c[scene] - 1, step));
    return { scene: scene, step: step };
  }

  // Next position, or null at the end of the lesson.
  function next(lesson, pos) {
    var c = counts(lesson);
    if (pos.step + 1 < c[pos.scene]) return { scene: pos.scene, step: pos.step + 1 };
    if (pos.scene + 1 < c.length) return { scene: pos.scene + 1, step: 0 };
    return null;
  }

  // Previous position (stays at the very first step).
  function prev(lesson, pos) {
    var c = counts(lesson);
    if (pos.step > 0) return { scene: pos.scene, step: pos.step - 1 };
    if (pos.scene > 0) return { scene: pos.scene - 1, step: c[pos.scene - 1] - 1 };
    return { scene: 0, step: 0 };
  }

  function totalSteps(lesson) {
    return counts(lesson).reduce(function (a, b) { return a + b; }, 0);
  }

  // 0-based index of a position across the whole lesson.
  function flatIndex(lesson, pos) {
    var c = counts(lesson);
    var n = 0;
    for (var i = 0; i < pos.scene; i++) n += c[i];
    return n + pos.step;
  }

  function fromFlat(lesson, index) {
    var c = counts(lesson);
    var i = Math.max(0, Math.min(totalSteps(lesson) - 1, index));
    for (var s = 0; s < c.length; s++) {
      if (i < c[s]) return { scene: s, step: i };
      i -= c[s];
    }
    return { scene: c.length - 1, step: c[c.length - 1] - 1 };
  }

  function isLast(lesson, pos) { return next(lesson, pos) === null; }

  function samePos(a, b) { return !!a && !!b && a.scene === b.scene && a.step === b.step; }

  // How to get from the live scene state to `target`:
  //   'continue' - target is the very next step of the live, fully-played scene: just play it.
  //   'rebuild'  - re-run setup, instant-replay steps before target, then play target.
  // live = {scene, completedThrough} describes what is on screen (completedThrough = last
  // step index fully played in the live scene, -1 after a fresh setup; null scene = nothing).
  function plan(live, target) {
    if (live && live.scene === target.scene && live.completedThrough === target.step - 1) return 'continue';
    return 'rebuild';
  }

  NS.playerState = {
    clampPos: clampPos,
    next: next,
    prev: prev,
    totalSteps: totalSteps,
    flatIndex: flatIndex,
    fromFlat: fromFlat,
    isLast: isLast,
    samePos: samePos,
    plan: plan
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
