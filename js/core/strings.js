// User-facing strings for the app shell (DECISIONS D9). Lesson text lives in lesson files.
(function (NS) {
  'use strict';
  NS.strings = {
    appTitle: 'Counting Is Fun!',
    appSubtitle: 'How people (and computers, and cats) write numbers',
    home: 'Home',
    playground: 'Playground',
    about: 'About',
    homeHeading: "Let's learn how numbers are written!",
    homeIntro: 'Pick a lesson. Start at the top and work your way down, or jump to any one you like.',
    comingSoon: 'Coming soon',
    startLesson: 'Start',
    lessonNotReady: 'This lesson is still being built. Check back soon!',
    playerNotReady: 'The lesson player is still being built. Check back soon!',
    backHome: 'Back to home',
    playgroundSoon: 'The playground is still being built: a number converter, your own number system, and a quiz!',
    noscript: 'This app needs JavaScript turned on. Please enable it and reload the page.'
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
