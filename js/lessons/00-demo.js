// Demo lesson (hidden from the menu): exercises the player, narration, sounds and animations.
// Open index.html#/lesson/demo. Kept as a regression check for the engine.
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;

  function shape(kind, color) {
    var body = {
      circle: U.svg('circle', { cx: 50, cy: 50, r: 42, fill: color }),
      square: U.svg('rect', { x: 10, y: 10, width: 80, height: 80, rx: 14, fill: color }),
      triangle: U.svg('path', { d: 'M50 8 L92 88 H8 Z', fill: color, 'stroke-linejoin': 'round' })
    }[kind];
    return U.svg('svg', { viewBox: '0 0 100 100', class: 'demo-shape demo-' + kind, role: 'img', 'aria-label': kind,
      style: { opacity: '0' } }, body);
  }

  var ANIMALS = [
    { name: 'Cat', sound: 'meow' }, { name: 'Dog', sound: 'woof' }, { name: 'Frog', sound: 'ribbit' },
    { name: 'Pig', sound: 'oink' }, { name: 'Duck', sound: 'quack' }
  ];

  NS.lessons.register({
    id: 'demo',
    order: 0,
    hidden: true,
    title: 'Demo: How the Player Works',
    shortTitle: 'Demo',
    theme: 'playground',
    scenes: [
      {
        id: 'shapes',
        title: 'Shapes say hello',
        setup: function (stage) {
          var shapes = [shape('circle', '#2f6fde'), shape('square', '#f07b16'), shape('triangle', '#1f9d55')];
          stage.appendChild(U.el('div', { class: 'demo-row' }, shapes));
          return { shapes: shapes };
        },
        steps: [
          {
            say: "Hello! This is the demo lesson. Let's make a circle appear.",
            do: function (ctx) {
              ctx.sound('pop');
              return A.pop(ctx.state.shapes[0], ctx);
            }
          },
          {
            say: 'Here come a square and a triangle.',
            do: function (ctx) {
              return A.stagger(ctx.state.shapes.slice(1), function (el) {
                ctx.sound('pop');
                return A.pop(el, ctx);
              }, 400, ctx);
            }
          },
          {
            say: 'Watch them bounce, and then wiggle!',
            do: function (ctx) {
              var s = ctx.state.shapes;
              return A.stagger(s, function (el) { return A.bounce(el, ctx); }, 150, ctx)
                .then(function () { return A.parallel.apply(null, s.map(function (el) { return A.wiggle(el, ctx); })); });
            }
          }
        ]
      },
      {
        id: 'counting',
        title: 'Counting and silly sounds',
        setup: function (stage) {
          var number = U.el('div', { class: 'demo-number', text: '0' });
          var animals = ANIMALS.map(function (a) {
            return U.el('span', { class: 'demo-animal', text: a.name, style: { opacity: '0' } });
          });
          stage.appendChild(U.el('div', { class: 'demo-counting' }, number, U.el('div', { class: 'demo-animals' }, animals)));
          return { number: number, animals: animals };
        },
        steps: [
          {
            say: "Let's count to ten.",
            do: function (ctx) {
              return A.countUp(ctx.state.number, 0, 10, ctx, { msPerStep: 260, onTick: function () { ctx.sound('click'); } });
            }
          },
          {
            say: 'Now the number slides up to make room.',
            do: function (ctx) {
              ctx.sound('whoosh');
              return A.moveTo(ctx.state.number, ctx, { x: 0, y: -30, scale: 0.7 });
            }
          },
          {
            say: 'Animals make silly sounds. Meow, woof, ribbit, oink, and quack!',
            do: function (ctx) {
              var chain = Promise.resolve();
              ctx.state.animals.forEach(function (el, i) {
                chain = chain.then(function () {
                  ctx.sound(ANIMALS[i].sound);
                  return A.parallel(A.pop(el, ctx), ctx.wait(650));
                });
              });
              return chain;
            }
          },
          {
            say: "That's the end of the demo. Hooray!",
            do: function (ctx) {
              ctx.sound('tada');
              return A.parallel(A.highlight(ctx.state.number, ctx), A.bounce(ctx.state.number, ctx));
            }
          }
        ]
      },
      {
        id: 'try',
        title: 'You try it!',
        interactive: true,
        setup: function (stage, ctx) {
          var count = U.el('div', { class: 'demo-number', text: '0', 'aria-live': 'polite' });
          var n = 0;
          var button = U.el('button', { type: 'button', class: 'btn btn-primary demo-press', onClick: function () {
            n += 1;
            count.textContent = String(n);
            NS.sound.play('pop');
            A.bounce(count, { speed: 1, reducedMotion: ctx.reducedMotion }).catch(function () {});
          } }, 'Press me!');
          stage.appendChild(U.el('div', { class: 'demo-counting' }, count, button));
          return { count: count, button: button };
        },
        steps: [
          { say: 'Your turn! Press the button as many times as you like. Then press the big button that says, I\'m done.' }
        ]
      }
    ]
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
