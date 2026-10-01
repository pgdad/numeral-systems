// Narrator: speaks a step's text and shows it as captions (DECISIONS D3).
//   speak(id, text, {rate, signal, onSentence}) -> Promise (resolves when done; rejects AbortError if aborted)
//   onSentence(i) is called as sentence i starts (and for any skipped ones at the end), so
//   animations can follow the words (the player exposes it to steps as ctx.cue(i)).
// Order of preference:
//   1. a recorded file listed in NS.audioManifest[id] whose hash matches the text,
//   2. the browser's speechSynthesis (voice on + available),
//   3. a silent timed wait based on reading speed (captions only).
// Captions always show; the current sentence (and word, where the browser reports
// word boundaries) is highlighted.
(function (NS) {
  'use strict';

  var U = NS.util;

  var config = {
    wpm: 160,          // reading speed for the captions-only timing
    minMs: 1200,       // shortest captions-only step
    timeScale: 1,      // tests can shrink all timed waits (e.g. 0.02)
    // Voice name fragments in order of preference (natural/neural voices first).
    preferredVoices: ['Natural', 'Neural', 'Google US English', 'Samantha', 'Microsoft Aria', 'Microsoft Jenny',
      'Microsoft Zira', 'Karen', 'Daniel', 'Moira', 'Google UK English Female', 'Alex']
  };

  var voiceOn = U.storage.get('narrator.voiceOn', true);
  var preferredVoiceName = U.storage.get('narrator.voiceName', null);
  var captionEl = null;
  var currentAudio = null;

  // ---------- pure helpers (unit-tested) ----------------------------------------------

  // Split text into sentences, keeping punctuation. "Hi! How are you? Fine." -> 3 parts.
  function splitSentences(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return [];
    var parts = t.match(/[^.!?…]+(?:[.!?…]+["')\]]*|$)/g) || [t];
    return parts.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // How long a captions-only step should last at a given rate.
  function estimateMs(text, rate) {
    var words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    var ms = (words / config.wpm) * 60000 / (rate || 1) + 500;
    return Math.max(config.minMs, Math.round(ms)) * config.timeScale;
  }

  // Pick the best English voice. `voices` is speechSynthesis.getVoices() (or test fakes).
  function pickVoice(voices, preferredName) {
    if (!voices || !voices.length) return null;
    if (preferredName) {
      var exact = voices.filter(function (v) { return v.name === preferredName; })[0];
      if (exact) return exact;
    }
    var english = voices.filter(function (v) { return /^en([-_]|$)/i.test(v.lang || ''); });
    var pool = english.length ? english : voices;
    for (var i = 0; i < config.preferredVoices.length; i++) {
      var frag = config.preferredVoices[i];
      var hit = pool.filter(function (v) { return v.name.indexOf(frag) !== -1 && /^en/i.test(v.lang || 'en'); })[0];
      if (hit) return hit;
    }
    var us = pool.filter(function (v) { return /^en[-_]US/i.test(v.lang || ''); });
    var defaults = (us.length ? us : pool).filter(function (v) { return v.default; });
    return defaults[0] || (us.length ? us : pool)[0];
  }

  // Small stable hash of narration text (djb2), used to detect stale recorded audio.
  function hashText(text) {
    var h = 5381;
    var s = String(text || '');
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  // Which source will speak this step? 'audio' | 'speech' | 'timed'
  function chooseSource(id, text, env) {
    var entry = env.manifest && env.manifest[id];
    if (entry) {
      var src = typeof entry === 'string' ? entry : entry.src;
      var fresh = typeof entry === 'string' || !entry.hash || entry.hash === hashText(text);
      if (src && fresh && env.voiceOn) return 'audio';
    }
    if (env.voiceOn && env.speechAvailable) return 'speech';
    return 'timed';
  }

  // ---------- speech synthesis -------------------------------------------------------

  function synth() {
    return (typeof window !== 'undefined' && window.speechSynthesis &&
      typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;
  }

  function isSpeechAvailable() { return !!synth(); }

  var voicesPromise = null;
  // Voices load asynchronously in Chrome; wait (briefly) for them.
  function loadVoices() {
    var s = synth();
    if (!s) return Promise.resolve([]);
    var now = s.getVoices();
    if (now && now.length) return Promise.resolve(now);
    if (!voicesPromise) {
      voicesPromise = new Promise(function (resolve) {
        var done = false;
        function finish() {
          if (done) return;
          done = true;
          resolve(s.getVoices() || []);
        }
        try { s.addEventListener('voiceschanged', finish, { once: true }); } catch (e) { /* old Safari */ }
        setTimeout(finish, 1000);
      }).then(function (v) { voicesPromise = null; return v; });
    }
    return voicesPromise;
  }

  function listVoices() {
    return loadVoices().then(function (voices) {
      return voices.filter(function (v) { return /^en/i.test(v.lang || ''); });
    });
  }

  function setVoiceName(name) {
    preferredVoiceName = name || null;
    U.storage.set('narrator.voiceName', preferredVoiceName);
  }

  // Speak one sentence. Resolves on end (or a safety timeout: some browsers never fire 'end').
  function speakSentence(sentence, voice, rate, signal, onBoundary) {
    var s = synth();
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) { reject(U.abortError()); return; }
      var u = new window.SpeechSynthesisUtterance(sentence);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-US'; }
      u.rate = rate || 1;
      u.pitch = 1.05;
      var settled = false;
      var safety = setTimeout(finish, estimateMs(sentence, rate) * 2 / config.timeScale + 3000);
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      }
      function onAbort() {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        s.cancel();
        reject(U.abortError());
      }
      u.onend = finish;
      u.onerror = function (e) {
        // 'interrupted'/'canceled' happen when we cancel; anything else: just move on.
        finish();
      };
      u.onboundary = function (e) { if (onBoundary && e.name !== 'sentence') onBoundary(e.charIndex, e.charLength); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      s.speak(u);
      // Chrome sometimes leaves the queue paused after a cancel; nudge it.
      if (s.paused) s.resume();
    });
  }

  function speakWithSynth(text, rate, signal, onSentence) {
    var s = synth();
    var sentences = splitSentences(text);
    // Chrome bug: speaking straight after cancel() can be dropped — cancel, then wait a tick.
    s.cancel();
    return U.sleep(60, signal).then(function () { return loadVoices(); }).then(function (voices) {
      var voice = pickVoice(voices, preferredVoiceName);
      // One utterance per sentence: avoids Chrome's ~15s utterance cut-off and lets us
      // highlight the current sentence.
      var chain = Promise.resolve();
      sentences.forEach(function (sentence, i) {
        chain = chain.then(function () {
          highlightSentence(i);
          onSentence(i);
          return speakSentence(sentence, voice, rate, signal, function (charIndex) { highlightWord(i, charIndex); });
        });
      });
      return chain;
    });
  }

  // ---------- recorded audio ---------------------------------------------------------

  function speakWithAudio(src, rate, signal) {
    return new Promise(function (resolve, reject) {
      var audio = new Audio(src);
      currentAudio = audio;
      audio.playbackRate = rate || 1;
      function cleanup() {
        audio.onended = audio.onerror = null;
        if (signal) signal.removeEventListener('abort', onAbort);
        if (currentAudio === audio) currentAudio = null;
      }
      function onAbort() { audio.pause(); cleanup(); reject(U.abortError()); }
      audio.onended = function () { cleanup(); resolve(); };
      audio.onerror = function () { cleanup(); reject(new Error('audio failed: ' + src)); };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      var p = audio.play();
      if (p && p.catch) p.catch(function (e) { cleanup(); reject(e); });
    });
  }

  // ---------- captions -------------------------------------------------------------

  function setCaptionElement(el) { captionEl = el; }

  function showCaption(text) {
    if (!captionEl) return;
    U.clear(captionEl);
    captionEl.hidden = !text;
    splitSentences(text).forEach(function (sentence, si) {
      var span = U.el('span', { class: 'cap-sentence', dataset: { i: String(si) } });
      // Wrap words with their character offsets so boundary events can highlight them.
      var re = /\S+/g, m;
      var last = 0;
      while ((m = re.exec(sentence))) {
        if (m.index > last) span.appendChild(document.createTextNode(sentence.slice(last, m.index)));
        span.appendChild(U.el('span', { class: 'cap-word', dataset: { start: String(m.index) }, text: m[0] }));
        last = m.index + m[0].length;
      }
      captionEl.appendChild(span);
      captionEl.appendChild(document.createTextNode(' '));
    });
  }

  function highlightSentence(index) {
    if (!captionEl) return;
    Array.prototype.forEach.call(captionEl.querySelectorAll('.cap-sentence'), function (s) {
      s.classList.toggle('is-current', s.dataset.i === String(index));
      s.classList.toggle('is-done', +s.dataset.i < index);
    });
    Array.prototype.forEach.call(captionEl.querySelectorAll('.cap-word.is-current'), function (w) { w.classList.remove('is-current'); });
  }

  function highlightWord(sentenceIndex, charIndex) {
    if (!captionEl) return;
    var sentence = captionEl.querySelector('.cap-sentence[data-i="' + sentenceIndex + '"]');
    if (!sentence) return;
    var words = sentence.querySelectorAll('.cap-word');
    var current = null;
    Array.prototype.forEach.call(words, function (w) {
      w.classList.remove('is-current');
      if (+w.dataset.start <= charIndex) current = w;
    });
    if (current) current.classList.add('is-current');
  }

  function clearHighlights() { highlightSentence(-1); }

  // ---------- main API ---------------------------------------------------------------

  function speak(id, text, options) {
    options = options || {};
    var rate = options.rate || 1;
    var signal = options.signal;
    var reached = -1;
    function onSentence(i) {
      if (i <= reached) return;
      reached = i;
      if (options.onSentence) { try { options.onSentence(i); } catch (e) { console.error(e); } }
    }
    showCaption(text);
    var source = chooseSource(id, text, {
      manifest: NS.audioManifest, voiceOn: voiceOn, speechAvailable: isSpeechAvailable()
    });

    function timed() {
      var sentences = splitSentences(text);
      var chain = Promise.resolve();
      sentences.forEach(function (sentence, i) {
        chain = chain.then(function () {
          highlightSentence(i);
          onSentence(i);
          return U.sleep(estimateMs(sentence, rate), signal);
        });
      });
      return chain;
    }

    var run;
    if (source === 'audio') {
      var entry = NS.audioManifest[id];
      highlightSentence(0);
      onSentence(0);
      // A recording has no sentence events: estimate when each later sentence starts.
      var at = 0;
      splitSentences(text).forEach(function (sentence, i) {
        if (i) U.sleep(at, signal).then(function () { onSentence(i); }, function () {});
        at += estimateMs(sentence, rate) / config.timeScale;
      });
      run = speakWithAudio(typeof entry === 'string' ? entry : entry.src, rate, signal).catch(function (e) {
        if (U.isAbortError(e)) throw e;
        return isSpeechAvailable() && voiceOn ? speakWithSynth(text, rate, signal, onSentence) : timed();
      });
    } else if (source === 'speech') {
      run = speakWithSynth(text, rate, signal, onSentence);
    } else {
      run = timed();
    }
    return run.then(function () {
      clearHighlights();
      onSentence(Infinity); // release any cue still waiting
      return source;
    });
  }

  // Stop anything that is speaking right now.
  function stop() {
    var s = synth();
    if (s) s.cancel();
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  }

  // Call from a user gesture (e.g. the Start button) so Safari/iOS allow speech later.
  function unlock() {
    var s = synth();
    if (!s) return;
    try {
      var u = new window.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    } catch (e) { /* ignore */ }
    loadVoices();
  }

  function setVoiceOn(on) {
    voiceOn = !!on;
    U.storage.set('narrator.voiceOn', voiceOn);
    if (!voiceOn) stop();
  }

  NS.narrator = {
    config: config,
    speak: speak,
    stop: stop,
    unlock: unlock,
    setVoiceOn: setVoiceOn,
    isVoiceOn: function () { return voiceOn; },
    isSpeechAvailable: isSpeechAvailable,
    listVoices: listVoices,
    setVoiceName: setVoiceName,
    setCaptionElement: setCaptionElement,
    showCaption: showCaption,
    // pure helpers, exported for tests and tools
    splitSentences: splitSentences,
    estimateMs: estimateMs,
    pickVoice: pickVoice,
    hashText: hashText,
    chooseSource: chooseSource
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
