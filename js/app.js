// App boot: renders the home menu from the lesson registry and routes into #stage.
// Later phases plug in through optional namespaces:
//   NS.player.mount(stage, lesson, {scene, step}) -> {destroy()}   (Phase 02)
//   NS.playground.mount(stage, {tab}) -> {destroy()}                 (Phase 09)
//   NS.gallery.mount(stage) -> {destroy()}                           (Phase 03, #/gallery)
//   NS.movie.mount(stage, {id}) -> {destroy()}                        (Phase 10, #/movie[/:id])
//   NS.recorder.mount(stage) -> {destroy()}                           (Phase 10, #/record)
//   NS.settings.apply()/open(opener)                                   (Phase 11, the header gear)
//   NS.progress.isDone(id)                                             (Phase 11, ✓ on finished lessons)
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
        done: !!(NS.progress && NS.progress.isDone(p.id)),
        href: p.route ? NS.router.href(p.route) : NS.router.href('lesson', { id: p.id })
      };
    });
    // Registered lessons that are not in the plan list (future additions).
    Object.keys(byId).forEach(function (id) {
      var l = byId[id];
      entries.push({ id: id, order: l.order, title: l.title, blurb: l.blurb || '', ageHint: l.ageHint,
        theme: l.theme || 'base10', glyph: l.glyph || '#', ready: true, done: !!(NS.progress && NS.progress.isDone(id)),
        href: NS.router.href('lesson', { id: id }) });
    });
    return entries.sort(function (a, b) { return a.order - b.order; });
  }

  function lessonCard(entry, index) {
    var inner = [
      U.el('span', { class: 'card-number', 'aria-hidden': 'true', text: String(index + 1) }),
      entry.done && entry.ready
        ? U.el('span', { class: 'card-done' }, NS.icons ? NS.icons.render('check', { kind: 'ui' }) : '✓', U.el('span', { text: S.finished }))
        : null,
      glyph(entry.glyph),
      U.el('span', { class: 'card-title', text: entry.title }),
      U.el('span', { class: 'card-blurb', text: entry.blurb }),
      U.el('span', { class: 'card-footer' },
        entry.ageHint ? U.el('span', { class: 'badge', text: 'Ages ' + entry.ageHint }) : null,
        entry.ready ? U.el('span', { class: 'card-go', text: S.startLesson + ' →' })
                    : U.el('span', { class: 'badge badge-soon', text: S.comingSoon }))
    ];
    var attrs = { class: ['lesson-card', 'theme-' + entry.theme, entry.ready ? '' : 'is-soon', entry.done && entry.ready ? 'is-done' : ''],
      dataset: { lesson: entry.id } };
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
    var ready = entries.filter(function (e) { return e.ready; });
    var done = ready.filter(function (e) { return e.done; }).length;
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
        done ? U.el('p', { class: 'home-progress', text: done === ready.length ? S.allFinished : S.finishedCount(done, ready.length) }) : null,
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
    var entries = homeEntries().filter(function (e) { return e.ready; });
    function lessonLink(e) { return U.el('a', { href: e.href }, e.title); }
    function key(k) { return U.el('kbd', { text: k }); }
    stage.appendChild(U.el('section', { class: 'about prose' },
      U.el('h1', { class: 'view-heading', tabindex: '-1', text: 'About ' + S.appTitle }),
      U.el('p', { text: 'A set of animated, talking lessons about how we write numbers: counting in tens on our ' +
        'fingers, counting to 1023 in binary on two hands, octal and hexadecimal, silly number systems made of ' +
        'animals and colors, and adding in all of them.' }),

      U.el('h2', { text: 'For the grown-up: using it together' }),
      U.el('ul', { class: 'about-tips' },
        U.el('li', {}, U.el('strong', { text: 'Sit together. ' }),
          'The lessons work best with a grown-up beside the child. Each one takes 5 to 10 minutes.'),
        U.el('li', {}, U.el('strong', { text: 'One lesson at a time. ' }),
          'Stop when it stops being fun. The home screen puts a ✓ on every lesson you finish, so you can pick up next time.'),
        U.el('li', {}, U.el('strong', { text: 'Pause and ask. ' }),
          'Press pause (or the space bar) and ask "what comes next?" before the lesson shows it. Guessing is the fun part.'),
        U.el('li', {}, U.el('strong', { text: 'Use real fingers. ' }),
          'Hold your hands up and count along. In binary, a finger up is 1 and a finger down is 0.'),
        U.el('li', {}, U.el('strong', { text: 'Let the child drive "You try it!" ' }),
          'Those parts wait for the child. Press "I\'m done!" when you\'re ready to move on.'),
        U.el('li', {}, U.el('strong', { text: 'Make it comfortable. ' }),
          'The gear button (Settings) at the top lets you slow the voice down, make the captions bigger, choose a voice, ' +
          'change the hand color, turn sound effects off, or switch to dark colors.')),

      U.el('h2', { text: 'Suggested order and ages' }),
      U.el('ol', { class: 'about-order' }, entries.map(function (e) {
        return U.el('li', {}, lessonLink(e), e.ageHint && e.ageHint !== 'all' ? ' (ages ' + e.ageHint + ')' : ' (any age)');
      })),
      U.el('p', { text: 'Younger children (5 and 6) enjoy Base‑10, Silly Number Systems and the Playground converter. ' +
        'From about 7, try Binary and Adding. Octal and Hexadecimal suits 8 and up. Any lesson can be watched again: ' +
        'children often like the second time best.' }),

      U.el('h2', { text: 'Watch it like a video' }),
      U.el('p', {}, 'The ', U.el('a', { href: NS.router.href('movie') }, 'movie'),
        ' plays every lesson hands-free, one after another, with chapter cards in between. Or watch one lesson: ',
        lessons.map(function (l, i) {
          return [i ? (i === lessons.length - 1 ? ' or ' : ', ') : '', U.el('a', { href: NS.router.href('movie', { id: l.id }) }, l.shortTitle || l.title)];
        }), '.'),
      U.el('p', {}, 'Would you like the lessons to talk in your own voice? ',
        U.el('a', { class: 'about-record', href: '#/record' }, 'Record the narration'),
        ' line by line, then follow the steps on that page.'),

      U.el('h2', { text: 'Keyboard' }),
      U.el('ul', {},
        U.el('li', {}, key('Space'), ' play or pause'),
        U.el('li', {}, key('→'), ' next step, ', key('←'), ' previous step (in the movie: next and previous chapter)'),
        U.el('li', {}, key('Tab'), ' moves between buttons; ', key('Enter'), ' or ', key('Space'), ' presses one (fingers too)'),
        U.el('li', {}, key('F'), ' full screen in the movie; ', key('Esc'), ' leaves full screen or closes Settings')),

      U.el('h2', { text: 'Privacy' }),
      U.el('p', { text: 'Nothing leaves this computer. There are no accounts, ads or tracking. Finished lessons, settings and ' +
        'home-made number systems are kept only in this browser.' }),

      U.el('h2', { text: 'Works anywhere' }),
      U.el('p', { text: 'This app is just files. It runs offline by opening index.html, and can be copied to any web host or CDN.' }),

      U.el('h2', { text: 'Credits' }),
      U.el('ul', {},
        U.el('li', { text: 'Lessons, pictures and code: made for this app. Every drawing (hands, animals, aliens) is drawn in code.' }),
        U.el('li', { text: 'Sound effects are made on the spot by the browser; there are no sound files.' }),
        U.el('li', { text: 'The voice is your browser\'s own speech, or recordings you add yourself.' }),
        U.el('li', { text: 'No outside libraries, fonts or services. Built with help from Claude, an AI assistant by Anthropic.' })),
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

  function setupSettingsButton() {
    var btn = document.querySelector('[data-settings]');
    if (!btn || !NS.settings) return;
    if (NS.icons) btn.appendChild(NS.icons.render('gear', { kind: 'ui' }));
    btn.appendChild(U.el('span', { class: 'settings-btn-label', text: S.settings }));
    btn.hidden = false;
    btn.addEventListener('click', function () { NS.settings.open(btn); });
  }

  function boot() {
    stage = document.getElementById('stage');
    if (!stage) return;
    if (U.prefersReducedMotion()) document.documentElement.classList.add('reduced-motion');
    if (NS.settings) NS.settings.apply();
    setupSettingsButton();
    // --cap-h = the captions bar's height (0 when hidden), so sticky controls can sit just above it (D22).
    var cap = document.getElementById('captions');
    if (cap && window.ResizeObserver) {
      new window.ResizeObserver(function () {
        document.documentElement.style.setProperty('--cap-h', (cap.hidden ? 0 : cap.offsetHeight) + 'px');
      }).observe(cap);
    }
    // Never keep talking in a hidden tab (the player and movie also pause themselves).
    document.addEventListener('visibilitychange', function () { if (document.hidden && NS.narrator) NS.narrator.stop(); });
    // A finished lesson changes the home screen's ✓ marks.
    if (NS.progress) NS.progress.onChange(function () {
      var r = NS.router.current();
      if (r && r.name === 'home' && stage.querySelector('.home')) { U.clear(stage); renderHome(); }
    });
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
