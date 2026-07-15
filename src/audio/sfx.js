// Web-Audio synthesized SFX + SpeechSynthesis-Ansagen
window.BUG = window.BUG || {};
BUG.SFX = (function () {
  let ctx = null;
  let muted = false;
  let voice = null;

  function ensureCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { console.warn('WebAudio nicht verfügbar', e); }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.15, sweep = null) {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type; osc.frequency.value = freq;
    if (sweep) osc.frequency.exponentialRampToValueAtTime(sweep, c.currentTime + dur);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    osc.connect(g).connect(c.destination);
    osc.start(); osc.stop(c.currentTime + dur);
  }

  function noise(dur, gain = 0.1, filterFreq = 800) {
    const c = ensureCtx(); if (!c || muted) return;
    const bufferSize = c.sampleRate * dur;
    const buf = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filt).connect(g).connect(c.destination);
    src.start(); src.stop(c.currentTime + dur);
  }

  function speak(text, opts = {}) {
    if (muted || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = opts.rate || 1.0; u.pitch = opts.pitch || 1.0; u.volume = opts.volume ?? 0.9;
      const voices = window.speechSynthesis.getVoices();
      const de = voices.find(v => v.lang && v.lang.startsWith('de'));
      if (de) u.voice = de;
      window.speechSynthesis.speak(u);
    } catch (e) { /* silent */ }
  }

  return {
    init() { ensureCtx(); if (window.speechSynthesis) window.speechSynthesis.getVoices(); },
    setMuted(v) { muted = v; if (muted && window.speechSynthesis) window.speechSynthesis.cancel(); },
    isMuted() { return muted; },

    doorBeep() { tone(880, 0.09); setTimeout(() => tone(880, 0.09), 130); setTimeout(() => tone(880, 0.16), 260); },
    coin() { tone(1200, 0.08, 'square', 0.14); setTimeout(() => tone(1800, 0.12, 'square', 0.12), 60); },
    hit() { noise(0.15, 0.25, 1200); tone(120, 0.14, 'sawtooth', 0.18); },
    step() { noise(0.05, 0.05, 400); },
    whistle() { tone(2000, 0.4, 'sine', 0.15, 3000); },
    engine(intensity = 0.5) { tone(80 + intensity * 60, 0.2, 'sawtooth', 0.05 + intensity * 0.05); },
    trainSqueal() { tone(1600, 0.7, 'sine', 0.06, 400); noise(0.7, 0.04, 3200); },
    honk() { tone(340, 0.18, 'square', 0.15); },
    police() { tone(880, 0.25, 'sine', 0.12); setTimeout(() => tone(440, 0.25, 'sine', 0.12), 260); },
    ding() { tone(1760, 0.18, 'sine', 0.13); },
    fail() { tone(220, 0.3, 'sawtooth', 0.15, 110); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'triangle', 0.15), i * 90)); },
    speak,
    announce(text) { speak(text, { rate: 0.95, pitch: 0.95 }); },
  };
})();
