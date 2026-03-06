// audio.js — Hex Collapse: Procedural sound effects via Web Audio API
// No external audio files needed. All sounds generated with oscillators.

(function () {
  'use strict';

  var ctx = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // Helper: play a tone with envelope
  function playTone(freq, type, duration, volume, startTime) {
    var c = ensureCtx();
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.15, startTime || c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, (startTime || c.currentTime) + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(startTime || c.currentTime);
    osc.stop((startTime || c.currentTime) + duration);
  }

  // Helper: noise burst for whoosh/rumble effects
  function playNoise(duration, volume, lowpass) {
    var c = ensureCtx();
    var bufferSize = c.sampleRate * duration;
    var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    var source = c.createBufferSource();
    source.buffer = buffer;
    var filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 400;
    var gain = c.createGain();
    gain.gain.setValueAtTime(volume || 0.1, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();
    source.stop(c.currentTime + duration);
  }

  var Audio = {
    // Short click/pop for tile placement
    tilePlace: function () {
      playTone(800, 'sine', 0.08, 0.12);
      playTone(1200, 'sine', 0.05, 0.06);
    },

    // Satisfying chime for match — pitch increases with chain length
    match: function (chainDepth) {
      var c = ensureCtx();
      var baseFreq = 440 + (chainDepth || 0) * 120;
      var t = c.currentTime;
      playTone(baseFreq, 'sine', 0.25, 0.15, t);
      playTone(baseFreq * 1.25, 'sine', 0.2, 0.10, t + 0.08);
      playTone(baseFreq * 1.5, 'sine', 0.15, 0.08, t + 0.16);
    },

    // Low whoosh/rumble for gravity shift
    gravityShift: function () {
      playTone(80, 'sawtooth', 0.4, 0.10);
      playTone(60, 'sine', 0.5, 0.08);
      playNoise(0.35, 0.06, 300);
    },

    // Ascending arpeggio for level complete
    levelComplete: function () {
      var c = ensureCtx();
      var t = c.currentTime;
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) {
        playTone(notes[i], 'sine', 0.3, 0.12, t + i * 0.12);
        playTone(notes[i] * 1.005, 'sine', 0.3, 0.06, t + i * 0.12); // slight detune for richness
      }
    },

    // Descending tone for game over
    gameOver: function () {
      var c = ensureCtx();
      var t = c.currentTime;
      var notes = [440, 370, 311, 261, 220];
      for (var i = 0; i < notes.length; i++) {
        playTone(notes[i], 'triangle', 0.4, 0.12, t + i * 0.15);
      }
    },

    // Subtle UI click for buttons
    uiClick: function () {
      playTone(600, 'sine', 0.04, 0.08);
    }
  };

  window.GameAudio = Audio;

})();
