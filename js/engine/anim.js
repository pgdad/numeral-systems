// Animation helpers over the Web Animations API. Every helper returns a Promise and takes a
// `ctx` ({instant, speed, signal, reducedMotion}) — usually the player's step context.
//   - ctx.instant:       jump straight to the end state (used for deep links / Prev).
//   - ctx.speed:         playback rate (1 = normal); durations are divided by it.
//   - ctx.reducedMotion: movement is skipped (end state applied), fades are kept short.
//   - ctx.signal:        AbortSignal; aborting cancels the animation and rejects with AbortError.
// "Transient" effects (bounce, wiggle, highlight) leave no end state, so instant = no-op.
(function (NS) {
  'use strict';

  var U = NS.util;

  function opts(ctx) { return ctx || {}; }
  function speedOf(ctx) { return (ctx && ctx.speed) || 1; }

  // Copy the last keyframe's properties onto the element's inline style.
  function applyFinal(el, keyframes) {
    var last = keyframes[keyframes.length - 1] || {};
    Object.keys(last).forEach(function (prop) {
      if (prop === 'offset' || prop === 'easing' || prop === 'composite') return;
      el.style[prop] = last[prop];
    });
  }

  // Core runner. kind: 'persistent' (keeps end state) | 'transient' (returns to start).
  function run(el, keyframes, options, ctx, kind) {
    ctx = opts(ctx);
    kind = kind || 'persistent';
    if (!el) return Promise.resolve();
    if (ctx.signal && ctx.signal.aborted) return Promise.reject(U.abortError());
    var skip = ctx.instant || (ctx.reducedMotion && !(options && options.keepWhenReduced)) ||
      typeof el.animate !== 'function';
    if (skip) {
      if (kind === 'persistent') applyFinal(el, keyframes);
      return Promise.resolve();
    }
    var duration = ((options && options.duration) || 400) / speedOf(ctx);
    if (ctx.reducedMotion) duration = Math.min(duration, 150);
    var animation = el.animate(keyframes, {
      duration: duration,
      delay: ((options && options.delay) || 0) / speedOf(ctx),
      easing: (options && options.easing) || 'cubic-bezier(.34,1.56,.64,1)',
      iterations: (options && options.iterations) || 1,
      fill: 'forwards'
    });
    return new Promise(function (resolve, reject) {
      function onAbort() {
        animation.cancel();
        if (kind === 'persistent') applyFinal(el, keyframes);
        reject(U.abortError());
      }
      if (ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
      animation.finished.then(function () {
        if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
        if (kind === 'persistent') applyFinal(el, keyframes);
        animation.cancel(); // don't leave filling animations piling up
        resolve();
      }, function () { /* cancelled: handled by onAbort */ });
    });
  }

  function show(el) { if (el) { el.hidden = false; el.style.visibility = ''; } }

  function fadeIn(el, ctx, o) {
    show(el);
    return run(el, [{ opacity: 0 }, { opacity: 1 }], Object.assign({ duration: 400, easing: 'ease-out', keepWhenReduced: true }, o), ctx);
  }

  function fadeOut(el, ctx, o) {
    return run(el, [{ opacity: 1 }, { opacity: 0 }], Object.assign({ duration: 300, easing: 'ease-in', keepWhenReduced: true }, o), ctx);
  }

  // Grow from nothing with a little overshoot.
  function pop(el, ctx, o) {
    show(el);
    return run(el, [
      { opacity: 0, transform: 'scale(0.2)' },
      { opacity: 1, transform: 'scale(1.15)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1)' }
    ], Object.assign({ duration: 450, easing: 'ease-out' }, o), ctx);
  }

  // Slide to an offset (px) from the element's layout position: moveTo(el, ctx, {x: 100, y: 0}).
  function moveTo(el, ctx, o) {
    o = o || {};
    var from = el.style.transform || 'translate(0px, 0px)';
    var to = 'translate(' + (o.x || 0) + 'px, ' + (o.y || 0) + 'px)' + (o.scale ? ' scale(' + o.scale + ')' : '');
    return run(el, [{ transform: from }, { transform: to }], Object.assign({ duration: 600, easing: 'cubic-bezier(.65,0,.35,1)' }, o), ctx);
  }

  function bounce(el, ctx, o) {
    var base = el.style.transform || '';
    return run(el, [
      { transform: base + ' translateY(0)' },
      { transform: base + ' translateY(-30%)', offset: 0.35 },
      { transform: base + ' translateY(0)', offset: 0.7 },
      { transform: base + ' translateY(-8%)', offset: 0.85 },
      { transform: base + ' translateY(0)' }
    ], Object.assign({ duration: 650, easing: 'ease-in-out' }, o), ctx, 'transient');
  }

  function wiggle(el, ctx, o) {
    var base = el.style.transform || '';
    return run(el, [
      { transform: base + ' rotate(0deg)' },
      { transform: base + ' rotate(-10deg)' },
      { transform: base + ' rotate(10deg)' },
      { transform: base + ' rotate(-6deg)' },
      { transform: base + ' rotate(0deg)' }
    ], Object.assign({ duration: 500, easing: 'ease-in-out' }, o), ctx, 'transient');
  }

  // A glowing pulse to draw the eye.
  function highlight(el, ctx, o) {
    return run(el, [
      { filter: 'drop-shadow(0 0 0 rgba(255, 196, 0, 0))' },
      { filter: 'drop-shadow(0 0 14px rgba(255, 196, 0, 1))', offset: 0.4 },
      { filter: 'drop-shadow(0 0 0 rgba(255, 196, 0, 0))' }
    ], Object.assign({ duration: 900, easing: 'ease-in-out', keepWhenReduced: true }, o), ctx, 'transient');
  }

  // Count a number up (or down) inside el's text. o.format(n) customises the text;
  // o.onTick(n) runs on every new value (e.g. play a sound).
  function countUp(el, from, to, ctx, o) {
    ctx = opts(ctx);
    o = o || {};
    var fmt = o.format || String;
    if (ctx.instant || ctx.reducedMotion) {
      el.textContent = fmt(to);
      return Promise.resolve();
    }
    var steps = Math.abs(to - from);
    var perStep = (o.msPerStep || 250) / speedOf(ctx);
    var dir = to >= from ? 1 : -1;
    var n = from;
    el.textContent = fmt(n);
    function tick() {
      if (n === to) return Promise.resolve();
      return U.sleep(perStep, ctx.signal).then(function () {
        n += dir;
        el.textContent = fmt(n);
        if (o.onTick) o.onTick(n);
        return tick();
      });
    }
    return steps ? tick() : Promise.resolve();
  }

  // Run fn(item, i) for each item, starting each `gap` ms after the previous one.
  function stagger(list, fn, gap, ctx) {
    ctx = opts(ctx);
    var items = Array.prototype.slice.call(list);
    if (ctx.instant) return Promise.all(items.map(fn));
    return Promise.all(items.map(function (item, i) {
      return U.sleep((gap || 120) * i / speedOf(ctx), ctx.signal).then(function () { return fn(item, i); });
    }));
  }

  function parallel() {
    return Promise.all(Array.prototype.slice.call(arguments));
  }

  // Wait respecting speed, instant and abort.
  function wait(ms, ctx) {
    ctx = opts(ctx);
    if (ctx.instant) return Promise.resolve();
    return U.sleep(ms / speedOf(ctx), ctx.signal);
  }

  NS.anim = {
    run: run,
    applyFinal: applyFinal,
    fadeIn: fadeIn,
    fadeOut: fadeOut,
    pop: pop,
    moveTo: moveTo,
    bounce: bounce,
    wiggle: wiggle,
    highlight: highlight,
    countUp: countUp,
    stagger: stagger,
    parallel: parallel,
    wait: wait
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
