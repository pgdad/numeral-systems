// User-facing strings for the app shell (DECISIONS D9). Lesson text lives in lesson files.
(function (NS) {
  'use strict';
  NS.strings = {
    appTitle: 'Counting Is Fun!',
    appSubtitle: 'How people (and computers, and cats) write numbers',
    home: 'Home',
    playground: 'Playground',
    about: 'About',
    movie: 'Movie',
    watchMovie: 'Watch the movie',
    watchMovieSub: 'Every lesson, hands-free, like a video',
    record: 'Record your voice',
    homeHeading: "Let's learn how numbers are written!",
    homeIntro: 'Pick a lesson. Start at the top and work your way down, or jump to any one you like.',
    comingSoon: 'Coming soon',
    finished: 'Done!',
    finishedCount: function (done, total) { return 'You finished ' + done + ' of ' + total + '. Keep going!'; },
    allFinished: 'You finished every lesson! You are a number-system expert!',
    settings: 'Settings',
    startLesson: 'Start',
    lessonNotReady: 'This lesson is still being built. Check back soon!',
    playerNotReady: 'The lesson player is still being built. Check back soon!',
    backHome: 'Back to home',
    playgroundSoon: 'The playground is still being built: a number converter, your own number system, and a quiz!',
    noscript: 'This app needs JavaScript turned on. Please enable it and reload the page.'
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
