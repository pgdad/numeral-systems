// App boot: renders the home menu from the lesson registry and routes into #stage.
// Later phases plug in through optional namespaces:
//   NS.player.mount(stage, lesson, {scene, step}) -> {destroy()}   (Phase 02)
//   NS.playground.mount(stage, {tab}) -> {destroy()}                 (Phase 09)
//   NS.gallery.mount(stage) -> {destroy()}                           (Phase 03, #/gallery)
//   NS.movie.mount(stage, {id}) -> {destroy()}                        (Phase 10, #/movie[/:id])
//   NS.recorder.mount(stage) -> {destroy()}                           (Phase 10, #/record)
(function (NS) {
  'use strict';

  var U = NS.util;
  var S = NS.strings;

  // Lessons from the plan (docs/plan/PLAN.md). A registered lesson with the same id
  // replaces its placeholder; the rest show as "Coming soon" cards.
  var PLANNED = [
    { id: 'base10', order: 10, theme: 'base10', glyph: '123', title: 'Base‑10: Counting on Our Fingers',
      blurb: 'Ten fingers, ten digits, and the magic of bundling tens.', ageHint: '5+' },
    { id: 'binary', order: 20, theme: 'binary', glyph: '101', title: 'Binary: Count to 1023 on Two Hands',
      blurb: 'Every finger is a switch. Ten fingers can count way past ten!', ageHint: '7+' },
    { id: 'octal-hex', order: 30, theme: 'hex', glyph: '7F', title: 'Octal & Hexadecimal',
      blurb: 'Eight-fingered aliens, sixteen digits, and secret color codes.', ageHint: '8+' },
    { id: 'silly', order: 40, theme: 'silly', glyph: 'dots', title: 'Silly Number Systems',
      blurb: 'Numbers made of cats, dogs and frogs, and numbers made of colors.', ageHint: '5+' },
    { id: 'addition', order: 50, theme: 'addition', glyph: '+', title: 'Adding in Every System',
      blurb: 'Carrying in tens, in binary, in hex, and with jumping animals.', ageHint: '7+' },
    { id: 'playground', order: 60, theme: 'playground', glyph: 'icon:star', title: 'Playground',
      blurb: 'Convert numbers, invent your own number system, and take a quiz.', ageHint: 'all', route: 'playground' }
  ];

  var stage, currentView = null;

  function destroyCurrentView() {
    if (currentView && typeof currentView.destroy === 'function') {
      try { currentView.destroy(); } catch (e) { console.error(e); }
    }
    currentView = null;
  }

  function glyph(kind) {
    if (kind === 'dots') {
      return U.el('span', { class: 'card-glyph card-glyph-dots', 'aria-hidden': 'true' },
        U.el('i', { class: 'dot dot-red' }), U.el('i', { class: 'dot dot-yellow' }), U.el('i', { class: 'dot dot-green' }));
    }
    if (kind.indexOf('icon:') === 0 && NS.icons) {
      return U.el('span', { class: 'card-glyph card-glyph-icon', 'aria-hidden': 'true' }, NS.icons.render(kind.slice(5)));
    }
    return U.el('span', { class: 'card-glyph', 'aria-hidden': 'true', text: kind });
  }

  // Merge registered lessons with planned placeholders. `registry` defaults to NS.lessons.
  function homeEntries(registry) {
    var registered = (registry || NS.lessons).list();
    var byId = {};
    registered.forEach(function (l) { byId[l.id] = l; });
    var entries = PLANNED.map(function (p) {
      var real = byId[p.id];
      delete byId[p.id];
      return {
        id: p.id,
        order: real ? real.order : p.order,
        title: real ? real.title : p.title,
        blurb: (real && real.blurb) || p.blurb,
        ageHint: (real && real.ageHint) || p.ageHint,
        theme: (real && real.theme) || p.theme,
        glyph: (real && real.glyph) || p.glyph,
        ready: !!real || (p.route === 'playground' && !!(NS.playground && NS.playground.mount)),
        href: p.route ? NS.router.href(p.route) : NS.router.href('lesson', { id: p.id })
      };
    });
    // Registered lessons that are not in the plan list (future additions).
    Object.keys(byId).forEach(function (id) {
      var l = byId[id];
      entries.push({ id: id, order: l.order, title: l.title, blurb: l.blurb || '', ageHint: l.ageHint,
        theme: l.theme || 'base10', glyph: l.glyph || '#', ready: true, href: NS.router.href('lesson', { id: id }) });
    });
    return entries.sort(function (a, b) { return a.order - b.order; });
  }

  function lessonCard(entry, index) {
    var inner = [
      U.el('span', { class: 'card-number', 'aria-hidden': 'true', text: String(index + 1) }),
      glyph(entry.glyph),
      U.el('span', { class: 'card-title', text: entry.title }),
      U.el('span', { class: 'card-blurb', text: entry.blurb }),
      U.el('span', { class: 'card-footer' },
        entry.ageHint ? U.el('span', { class: 'badge', text: 'Ages ' + entry.ageHint }) : null,
        entry.ready ? U.el('span', { class: 'card-go', text: S.startLesson + ' →' })
                    : U.el('span', { class: 'badge badge-soon', text: S.comingSoon }))
    ];
    var attrs = { class: ['lesson-card', 'theme-' + entry.theme, entry.ready ? '' : 'is-soon'], dataset: { lesson: entry.id } };
    if (entry.ready) {
      attrs.href = entry.href;
      return U.el('a', attrs, inner);
    }
    attrs['aria-disabled'] = 'true';
    return U.el('div', attrs, inner);
  }

  function renderHome() {
    document.title = S.appTitle;
    var entries = homeEntries();
    var watch = NS.movie && NS.movie.mount && NS.player
      ? U.el('a', { class: 'btn-watch', href: NS.router.href('movie') },
          U.el('span', { class: 'btn-watch-play', 'aria-hidden': 'true' }, NS.player.icon('play')),
          U.el('span', { class: 'btn-watch-text' },
            U.el('span', { class: 'btn-watch-title', text: S.watchMovie }),
            U.el('span', { class: 'btn-watch-sub', text: S.watchMovieSub })))
      : null;
    stage.appendChild(U.el('section', { class: 'home' },
      U.el('div', { class: 'hero' },
        U.el('h1', { class: 'view-heading', tabindex: '-1', text: S.homeHeading }),
        U.el('p', { class: 'lead', text: S.homeIntro }),
        watch),
      U.el('nav', { class: 'lesson-grid', 'aria-label': 'Lessons' }, entries.map(lessonCard))
    ));
  }

  function notReady(title, message) {
    stage.appendChild(U.el('section', { class: 'placeholder' },
      U.el('h1', { class: 'view-heading', tabindex: '-1', text: title }),
      U.el('p', { class: 'lead', text: message }),
      U.el('a', { class: 'btn btn-primary', href: NS.router.href('home'), text: S.backHome })));
  }

  function renderLesson(params) {
    var lesson = NS.lessons.get(params.id);
    var planned = PLANNED.filter(function (p) { return p.id === params.id; })[0];
    if (!lesson) {
      var t = planned ? planned.title : 'Lesson not found';
      document.title = t + ' · ' + S.appTitle;
      notReady(t, planned ? S.lessonNotReady : 'We could not find that lesson.');
      return;
    }
    document.title = lesson.title + ' · ' + S.appTitle;
    if (!NS.player) {
      notReady(lesson.title, S.playerNotReady);
      return;
    }
    currentView = NS.player.mount(stage, lesson, { scene: params.scene, step: params.step });
  }

  function renderPlayground(params) {
    document.title = S.playground + ' · ' + S.appTitle;
    if (NS.playground && NS.playground.mount) currentView = NS.playground.mount(stage, { tab: params.tab });
    else notReady(S.playground, S.playgroundSoon);
  }

  function renderGallery() {
    document.title = 'Component gallery · ' + S.appTitle;
    if (NS.gallery) currentView = NS.gallery.mount(stage);
    else notReady('Component gallery', 'The gallery is not available.');
  }

  function renderMovie(params) {
    document.title = S.movie + ' · ' + S.appTitle;
    if (NS.movie && NS.movie.mount && NS.player) currentView = NS.movie.mount(stage, { id: params.id });
    else notReady(S.movie, S.playerNotReady);
  }

  function renderRecord() {
    document.title = S.record + ' · ' + S.appTitle;
    if (NS.recorder && NS.recorder.mount) currentView = NS.recorder.mount(stage);
    else notReady(S.record, 'Recording is not available.');
  }

  function renderAbout() {
    document.title = S.about + ' · ' + S.appTitle;
    var lessons = NS.lessons.list();
    stage.appendChild(U.el('section', { class: 'about prose' },
      U.el('h1', { class: 'view-heading', tabindex: '-1', text: 'About ' + S.appTitle }),
      U.el('p', { text: 'A set of animated, talking lessons about how we write numbers: counting in tens on our ' +
        'fingers, counting to 1023 in binary on two hands, octal and hexadecimal, silly number systems made of ' +
        'animals and colors, and adding in all of them.' }),
      U.el('h2', { text: 'For the grown-up' }),
      U.el('ul', {},
        U.el('li', { text: 'Sit together and go through one lesson at a time, in order from the home screen.' }),
        U.el('li', { text: 'Each lesson talks and shows captions. Pause any time to ask "what comes next?"' }),
        U.el('li', { text: 'Finish with the "You try it!" part, and let the child drive the mouse.' })),
      U.el('h2', { text: 'Watch it like a video' }),
      U.el('p', {}, 'The ', U.el('a', { href: NS.router.href('movie') }, 'movie'),
        ' plays every lesson hands-free, one after another, with chapter cards in between. Or watch one lesson: ',
        lessons.map(function (l, i) {
          return [i ? (i === lessons.length - 1 ? ' or ' : ', ') : '', U.el('a', { href: NS.router.href('movie', { id: l.id }) }, l.shortTitle || l.title)];
        }), '.'),
      U.el('p', {}, 'Would you like the lessons to talk in your own voice? ',
        U.el('a', { class: 'about-record', href: '#/record' }, 'Record the narration'),
        ' line by line, then follow the steps on that page.'),
      U.el('h2', { text: 'Works anywhere' }),
      U.el('p', { text: 'This app is just files. It runs offline by opening index.html, and can be copied to any web host or CDN.' }),
      U.el('p', { class: 'muted', text: 'Version ' + NS.version })
    ));
  }

  function render(route) {
    destroyCurrentView();
    U.clear(stage);
    var captions = document.getElementById('captions');
    if (captions) { captions.hidden = true; U.clear(captions); }

    switch (route.name) {
      case 'lesson': renderLesson(route.params); break;
      case 'playground': renderPlayground(route.params); break;
      case 'about': renderAbout(); break;
      case 'gallery': renderGallery(); break;
      case 'movie': renderMovie(route.params); break;
      case 'record': renderRecord(); break;
      default: renderHome();
    }

    document.body.dataset.route = route.name;
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      if (a.getAttribute('data-nav') === route.name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // Move focus to the new view's heading for screen readers / keyboard users,
    // but not on first load (don't steal focus from the browser).
    if (render.count++ > 0) {
      var heading = stage.querySelector('.view-heading');
      if (heading) heading.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }
  render.count = 0;

  function boot() {
    stage = document.getElementById('stage');
    if (!stage) return;
    if (U.prefersReducedMotion()) document.documentElement.classList.add('reduced-motion');
    NS.router.onChange(render);
    NS.router.start();
  }

  NS.app = { boot: boot, homeEntries: homeEntries, PLANNED: PLANNED };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
