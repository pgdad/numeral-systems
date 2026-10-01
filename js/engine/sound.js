// Sound effects synthesised with WebAudio — no audio files. NS.sound.play('pop').
// The AudioContext is created lazily on first use (browsers need a user gesture first);
// call NS.sound.unlock() from a click handler to be safe.
(function (NS) {
  'use strict';

  var ac = null;
  var master = null;
  var muted = NS.util.storage.get('sound.muted', false);
  var volume = NS.util.storage.get('sound.volume', 0.5);

  function context() {
    if (ac) return ac;
    var AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = volume;
      master.connect(ac.destination);
    } catch (e) { ac = null; }
    return ac;
  }

  function unlock() {
    var c = context();
    if (c && c.state === 'suspended') c.resume().catch(function () {});
  }

  // --- building blocks ---------------------------------------------------------------
  function env(gain, t, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak || 0.8, t + attack);
    gain.gain.setValueAtTime(peak || 0.8, t + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return t + attack + hold + release;
  }

  // tone({type, freqs: [[time, hz], ...], at, attack, hold, release, peak, filter})
  function tone(o) {
    var c = ac;
    var t = c.currentTime + (o.at || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = o.type || 'sine';
    (o.freqs || [[0, 440]]).forEach(function (f, i) {
      if (i === 0) osc.frequency.setValueAtTime(f[1], t + f[0]);
      else osc.frequency.exponentialRampToValueAtTime(f[1], t + f[0]);
    });
    var node = osc;
    if (o.filter) {
      var bq = c.createBiquadFilter();
      bq.type = o.filter.type || 'lowpass';
      bq.frequency.value = o.filter.freq;
      bq.Q.value = o.filter.q || 1;
      osc.connect(bq);
      node = bq;
    }
    node.connect(g);
    g.connect(master);
    var end = env(g, t, o.attack || 0.01, o.hold || 0.05, o.release || 0.15, o.peak);
    osc.start(t);
    osc.stop(end + 0.05);
    return end - c.currentTime;
  }

  function noise(o) {
    var c = ac;
    var t = c.currentTime + (o.at || 0);
    var len = Math.floor(c.sampleRate * (o.duration || 0.3));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var bq = c.createBiquadFilter();
    bq.type = 'bandpass';
    bq.Q.value = o.q || 1;
    bq.frequency.setValueAtTime(o.from || 400, t);
    bq.frequency.exponentialRampToValueAtTime(o.to || 3000, t + (o.duration || 0.3));
    var g = c.createGain();
    src.connect(bq); bq.connect(g); g.connect(master);
    env(g, t, 0.02, (o.duration || 0.3) * 0.4, (o.duration || 0.3) * 0.5, o.peak || 0.5);
    src.start(t);
    src.stop(t + (o.duration || 0.3) + 0.05);
    return o.duration || 0.3;
  }

  // --- the sounds ------------------------------------------------------------------
  var SOUNDS = {
    pop: function () { return tone({ freqs: [[0, 380], [0.08, 900]], hold: 0.02, release: 0.08, peak: 0.6 }); },
    click: function () { return tone({ type: 'square', freqs: [[0, 1200]], attack: 0.002, hold: 0.01, release: 0.03, peak: 0.25 }); },
    ding: function () {
      tone({ freqs: [[0, 1320]], hold: 0.05, release: 0.8, peak: 0.5 });
      return tone({ freqs: [[0, 2640]], hold: 0.02, release: 0.4, peak: 0.15 });
    },
    whoosh: function () { return noise({ from: 300, to: 4000, duration: 0.35, q: 0.8, peak: 0.35 }); },
    tada: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone({ type: 'triangle', freqs: [[0, f]], at: i * 0.11, hold: i === 3 ? 0.35 : 0.06, release: 0.3, peak: 0.45 });
      });
      return 1.0;
    },
    carry: function () { // boing!
      return tone({ type: 'sine', freqs: [[0, 180], [0.12, 620], [0.35, 300]], hold: 0.2, release: 0.2, peak: 0.6 });
    },
    meow: function () {
      return tone({ type: 'sawtooth', freqs: [[0, 520], [0.15, 880], [0.5, 480]], attack: 0.05, hold: 0.3, release: 0.2,
        peak: 0.35, filter: { type: 'lowpass', freq: 1800, q: 4 } });
    },
    woof: function () {
      tone({ type: 'square', freqs: [[0, 220], [0.12, 130]], attack: 0.01, hold: 0.06, release: 0.08, peak: 0.4,
        filter: { type: 'lowpass', freq: 700, q: 3 } });
      noise({ from: 300, to: 200, duration: 0.15, q: 2, peak: 0.25 });
      return tone({ type: 'square', freqs: [[0, 200], [0.12, 120]], at: 0.25, attack: 0.01, hold: 0.06, release: 0.08,
        peak: 0.4, filter: { type: 'lowpass', freq: 700, q: 3 } }) + 0.25;
    },
    ribbit: function () {
      tone({ type: 'square', freqs: [[0, 260], [0.08, 320]], hold: 0.06, release: 0.03, peak: 0.3, filter: { type: 'bandpass', freq: 600, q: 5 } });
      return tone({ type: 'square', freqs: [[0, 300], [0.1, 220]], at: 0.14, hold: 0.08, release: 0.05, peak: 0.3,
        filter: { type: 'bandpass', freq: 600, q: 5 } }) + 0.14;
    },
    oink: function () {
      tone({ type: 'sawtooth', freqs: [[0, 160], [0.1, 260], [0.2, 180]], attack: 0.02, hold: 0.12, release: 0.08, peak: 0.4,
        filter: { type: 'bandpass', freq: 900, q: 6 } });
      return tone({ type: 'sawtooth', freqs: [[0, 170], [0.08, 240]], at: 0.3, attack: 0.02, hold: 0.08, release: 0.08,
        peak: 0.35, filter: { type: 'bandpass', freq: 900, q: 6 } }) + 0.3;
    },
    quack: function () {
      tone({ type: 'sawtooth', freqs: [[0, 420], [0.15, 330]], attack: 0.01, hold: 0.1, release: 0.06, peak: 0.4,
        filter: { type: 'bandpass', freq: 1300, q: 7 } });
      return tone({ type: 'sawtooth', freqs: [[0, 410], [0.15, 320]], at: 0.24, attack: 0.01, hold: 0.1, release: 0.06,
        peak: 0.4, filter: { type: 'bandpass', freq: 1300, q: 7 } }) + 0.24;
    }
  };

  // Play a sound; returns its approximate length in ms (0 when muted/unavailable/unknown).
  function play(name) {
    if (muted || !SOUNDS[name]) return 0;
    var c = context();
    if (!c) return 0;
    if (c.state === 'suspended') c.resume().catch(function () {});
    try { return Math.round(SOUNDS[name]() * 1000); } catch (e) { return 0; }
  }

  function setMuted(m) { muted = !!m; NS.util.storage.set('sound.muted', muted); }
  function isMuted() { return muted; }
  function setVolume(v) {
    volume = NS.util.clamp(v, 0, 1);
    NS.util.storage.set('sound.volume', volume);
    if (master) master.gain.value = volume;
  }

  NS.sound = {
    play: play,
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    setVolume: setVolume,
    names: Object.keys(SOUNDS)
  };
})(typeof window !== 'undefined' ? (window.NumSys = window.NumSys || {})
                                 : (globalThis.NumSys = globalThis.NumSys || {}));
