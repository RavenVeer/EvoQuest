/* Procedural audio using Web Audio API — no external assets needed */
const AudioSys = (() => {
  let ctx = null;
  let master = null;
  let muted = false;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.2, filterFreq = 1000) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  const sfx = {
    eat() { tone(300, 0.12, 'sine', 0.25, 600); tone(600, 0.1, 'sine', 0.2, 900, 0.02); },
    evolve() {
      tone(330, 0.4, 'triangle', 0.3, 660);
      tone(440, 0.4, 'triangle', 0.3, 880, 0.1);
      tone(660, 0.6, 'triangle', 0.3, 1320, 0.2);
      noise(0.5, 0.15, 2000);
    },
    shoot() { tone(700, 0.1, 'sawtooth', 0.15, 250); },
    hit() { noise(0.12, 0.25, 900); tone(150, 0.15, 'square', 0.2, 80); },
    hurt() { tone(220, 0.25, 'sawtooth', 0.25, 90); noise(0.2, 0.2, 600); },
    kill() {
      tone(500, 0.4, 'square', 0.25, 100);
      tone(800, 0.5, 'sine', 0.2, 200, 0.05);
      noise(0.4, 0.3, 1500);
    },
    dash() { noise(0.2, 0.2, 3000); tone(400, 0.15, 'sawtooth', 0.15, 900); },
    jump() { tone(250, 0.12, 'triangle', 0.2, 450); },
    gameover() { tone(400, 0.6, 'sawtooth', 0.3, 60); tone(300, 0.8, 'sawtooth', 0.3, 40, 0.2); },
    ambientWind() {
      if (ctx && !muted) { noise(1.5, 0.04, 400); }
    }
  };

  return { init, resume, sfx, setMuted(m) { muted = m; }, get muted() { return muted; } };
})();
