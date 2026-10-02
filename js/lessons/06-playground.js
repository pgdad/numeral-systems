// Lesson 6: Playground (docs/plan/CONTENT.md § Lesson 6). Not narrated scene by scene: a short narrated
// intro that shows the three corners of the playground, then a "pick one" card that links to #/playground.
// The playground itself is js/playground.js (NS.playground.mount). The home card links straight to
// #/playground (NS.app.PLANNED route); this lesson is the talking way in.
// Lesson files must not touch the DOM at load time: everything happens inside setup/do.
(function (NS) {
  'use strict';

  var U = NS.util;
  var A = NS.anim;

  function hidden(el) { el.style.opacity = '0'; return el; }
  function sound(ctx, name) { if (ctx.sound) ctx.sound(name); }

  // The three corners: tab id (route #/playground/<tab>), title, blurb, picture.
  var CORNERS = [
    { tab: 'converter', title: 'Converter', blurb: 'One number in every system at once.' },
    { tab: 'make', title: 'Make Your Own', blurb: 'Invent a number system with your own symbols.' },
    { tab: 'quiz', title: 'Quiz', blurb: 'Ten questions. Collect the stars!' }
  ];

  // The picture on each corner card.
  function picture(tab) {
    if (tab === 'converter') {
      return U.el('span', { class: 'pgl-pic pgl-pic-converter', 'aria-hidden': 'true' },
        U.el('span', { class: 'pgl-chip theme-base10', text: '13' }),
        U.el('span', { class: 'pgl-chip theme-binary', text: '1101' }),
        U.el('span', { class: 'pgl-chip theme-hex', text: 'D' }),
        NS.symbols.strip(13, 'animals', { class: 'pgl-strip' }));
    }
    if (tab === 'make') {
      return U.el('span', { class: 'pgl-pic', 'aria-hidden': 'true' },
        ['robot', 'banana', 'rocket'].map(function (name) { return NS.icons.render(name, { size: 56 }); }));
    }
    return U.el('span', { class: 'pgl-pic', 'aria-hidden': 'true' },
      [0, 1, 2].map(function () { return NS.icons.render('star', { size: 56 }); }));
  }

  function card(corner, asLink) {
    var inner = [picture(corner.tab),
      U.el('span', { class: 'pgl-card-title', text: corner.title }),
      U.el('span', { class: 'pgl-card-blurb', text: corner.blurb })];
    if (asLink) {
      return U.el('a', { class: 'pgl-card pgl-go', href: '#/playground/' + corner.tab, dataset: { tab: corner.tab } }, inner);
    }
    return U.el('div', { class: 'pgl-card', dataset: { tab: corner.tab } }, inner);
  }

  var welcome = {
    id: 'welcome',
    title: 'Welcome to the Playground',
    setup: function (stage) {
      var state = {};
      state.title = hidden(U.el('h2', { class: 'pgl-title' }, NS.icons.render('star', { size: 64 }), ' Playground'));
      state.cards = CORNERS.map(function (c) { return hidden(card(c, false)); });
      stage.appendChild(U.el('div', { class: 'pgl-scene' }, state.title,
        U.el('div', { class: 'pgl-cards' }, state.cards)));
      return state;
    },
    steps: [
      {
        say: 'Welcome to the playground! Here you can play with everything you learned.',
        do: function (ctx) { sound(ctx, 'whoosh'); return A.pop(ctx.state.title, ctx); }
      },
      {
        say: 'In the converter, type any number and see it in every system at once.',
        do: function (ctx) { sound(ctx, 'pop'); return A.pop(ctx.state.cards[0], ctx); }
      },
      {
        say: 'You can even invent your own number system, with robots, bananas and rockets!',
        do: function (ctx) { sound(ctx, 'pop'); return A.pop(ctx.state.cards[1], ctx); }
      },
      {
        say: 'And when you are ready, take the quiz and collect stars!',
        do: function (ctx) { sound(ctx, 'ding'); return A.pop(ctx.state.cards[2], ctx); }
      }
    ]
  };

  var go = {
    id: 'go',
    title: 'Where shall we play?',
    interactive: true,
    setup: function (stage) {
      var links = CORNERS.map(function (c) { return card(c, true); });
      stage.appendChild(U.el('div', { class: 'pgl-scene' },
        U.el('h2', { class: 'pgl-title', text: 'Pick one!' }),
        U.el('nav', { class: 'pgl-cards', 'aria-label': 'Playground corners' }, links)));
      return { links: links };
    },
    steps: [
      {
        say: 'Pick one to start playing!',
        do: function (ctx) { return A.stagger(ctx.state.links, function (el) { return A.pop(el, ctx); }, 150, ctx); }
      }
    ]
  };

  NS.lessons.register({
    id: 'playground',
    order: 60,
    title: 'Playground',
    shortTitle: 'Playground',
    blurb: 'Convert numbers, invent your own number system, and take a quiz.',
    ageHint: 'all',
    theme: 'playground',
    icon: 'star',
    glyph: 'icon:star',
    scenes: [welcome, go],
    helpers: { CORNERS: CORNERS }
  });
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
