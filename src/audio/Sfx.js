// Procedural sound engine — every effect is synthesized with the Web Audio
// API, no audio files. The AudioContext unlocks on the first user gesture.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('elite-muted') === '1';
    this.volume = 0.35;
    this.engine = null;
  }

  // call from a click/keydown handler — browsers require a gesture
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    // shared 2s white-noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startEngineLoop();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('elite-muted', this.muted ? '1' : '0');
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // ---------- synth helpers ----------
  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.2, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 ?? f0), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise({ filter = 'lowpass', f0 = 1000, f1 = null, q = 0.8, dur = 0.3, vol = 0.3, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filter;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(Math.max(10, f0), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(10, f1 ?? f0), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ---------- one-shots ----------
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'laser':
        this.tone({ type: 'sawtooth', f0: 1600, f1: 180, dur: 0.15, vol: 0.15 });
        this.tone({ type: 'square', f0: 1200, f1: 140, dur: 0.1, vol: 0.08 });
        break;
      case 'missileLaunch':
        this.tone({ type: 'sawtooth', f0: 1800, f1: 150, dur: 0.25, vol: 0.2 });
        this.tone({ type: 'square', f0: 900, f1: 80, dur: 0.18, vol: 0.15 });
        this.noise({ filter: 'bandpass', f0: 800, f1: 200, q: 1.5, dur: 0.4, vol: 0.25, attack: 0.02 });
        break;
      case 'laserEnemy':
        this.tone({ type: 'square', f0: 420, f1: 110, dur: 0.16, vol: 0.09 });
        break;
      case 'hitSpark':
        this.noise({ filter: 'highpass', f0: 2400, dur: 0.08, vol: 0.14 });
        this.tone({ type: 'sine', f0: 1300, f1: 700, dur: 0.06, vol: 0.08 });
        break;
      case 'hitShield':
        this.tone({ type: 'sine', f0: 320, f1: 150, dur: 0.22, vol: 0.2 });
        this.noise({ filter: 'bandpass', f0: 900, q: 3, dur: 0.15, vol: 0.12 });
        break;
      case 'hitHull':
        this.noise({ filter: 'lowpass', f0: 500, f1: 90, dur: 0.28, vol: 0.4 });
        this.tone({ type: 'triangle', f0: 95, f1: 38, dur: 0.25, vol: 0.3 });
        break;
      case 'explosion':
        this.noise({ filter: 'lowpass', f0: 900, f1: 55, dur: 1.1, vol: 0.55, attack: 0.01 });
        this.tone({ type: 'sine', f0: 75, f1: 24, dur: 0.8, vol: 0.4 });
        this.noise({ filter: 'highpass', f0: 3000, dur: 0.25, vol: 0.12 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone({ type: 'square', f0: 620, dur: 0.11, vol: 0.07, delay: i * 0.24 });
          this.tone({ type: 'square', f0: 465, dur: 0.11, vol: 0.07, delay: i * 0.24 + 0.12 });
        }
        break;
      case 'cash':
        this.tone({ type: 'sine', f0: 880, dur: 0.07, vol: 0.14 });
        this.tone({ type: 'sine', f0: 1318, dur: 0.1, vol: 0.14, delay: 0.07 });
        break;
      case 'pickup':
        this.tone({ type: 'sine', f0: 520, f1: 1040, dur: 0.16, vol: 0.14 });
        break;
      case 'click':
        this.tone({ type: 'square', f0: 950, dur: 0.03, vol: 0.05 });
        break;
      case 'lockTick':
        this.tone({ type: 'sine', f0: 750, dur: 0.04, vol: 0.07 });
        break;
      case 'lockBeep':
        this.tone({ type: 'sine', f0: 1100, dur: 0.12, vol: 0.15 });
        this.tone({ type: 'sine', f0: 1100, dur: 0.12, vol: 0.15, delay: 0.08 });
        break;
      case 'toastInfo':
        this.tone({ type: 'sine', f0: 700, dur: 0.06, vol: 0.08 });
        break;
      case 'dockGranted':
        [523, 659, 784].forEach((f, i) =>
          this.tone({ type: 'sine', f0: f, dur: 0.35, vol: 0.1, delay: i * 0.1 }));
        break;
      case 'clamp':
        this.noise({ filter: 'lowpass', f0: 220, f1: 80, dur: 0.3, vol: 0.35 });
        this.tone({ type: 'sine', f0: 62, f1: 40, dur: 0.3, vol: 0.3 });
        break;
      case 'hyperCharge':
        this.tone({ type: 'sawtooth', f0: 80, f1: 380, dur: 1.2, vol: 0.12 });
        this.tone({ type: 'sine', f0: 160, f1: 760, dur: 1.2, vol: 0.08 });
        this.noise({ filter: 'bandpass', f0: 100, f1: 800, q: 1, dur: 1.2, vol: 0.15, attack: 0.2 });
        break;
      case 'superEngage':
        this.noise({ filter: 'bandpass', f0: 120, f1: 2400, q: 2, dur: 1.1, vol: 0.28, attack: 0.4 });
        this.tone({ type: 'sine', f0: 60, f1: 240, dur: 1.1, vol: 0.14 });
        break;
      case 'superDrop':
        this.noise({ filter: 'bandpass', f0: 2400, f1: 90, q: 2, dur: 0.6, vol: 0.25, attack: 0.02 });
        this.tone({ type: 'sine', f0: 240, f1: 55, dur: 0.6, vol: 0.14 });
        break;
    }
  }

  // ---------- continuous engine wind ----------
  startEngineLoop() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.master);

    // Subtle sub-bass hum (very quiet, just for body)
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 120;
    flt.Q.value = 0.5;
    flt.connect(g);

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 32;
    o1.connect(flt);
    o1.start();

    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = 34; // slight detune for a gentle beating
    o2.connect(flt);
    o2.start();

    // Wind noise: bandpass-filtered white noise for a smooth rushing sound
    const nz = ctx.createBufferSource();
    nz.buffer = this.noiseBuf;
    nz.loop = true;
    const nzFlt = ctx.createBiquadFilter();
    nzFlt.type = 'bandpass';
    nzFlt.frequency.value = 600;
    nzFlt.Q.value = 0.4;
    const nzHi = ctx.createBiquadFilter();
    nzHi.type = 'lowpass';
    nzHi.frequency.value = 1800;
    nzHi.Q.value = 0.3;
    const nzGain = ctx.createGain();
    nzGain.gain.value = 0.5;
    nz.connect(nzFlt);
    nzFlt.connect(nzHi);
    nzHi.connect(nzGain);
    nzGain.connect(g);
    nz.start();

    this.engine = { gain: g, o1, o2, flt, nzFlt, nzHi, nzGain };
  }

  // called every flight frame; throttle 0..1
  setEngine(throttle, boosting, superMode) {
    if (!this.engine || this.muted) return;
    const t = this.ctx.currentTime;
    let vol, freq, windCenter, windHi;
    if (superMode) {
      vol = 0.06; freq = 24; windCenter = 900; windHi = 2800; // gentle deep rush
    } else {
      vol = throttle * 0.04 + (boosting ? 0.03 : 0);
      freq = 28 + throttle * 15 + (boosting ? 10 : 0);
      windCenter = 400 + throttle * 600 + (boosting ? 500 : 0);
      windHi = 1200 + throttle * 1200 + (boosting ? 800 : 0);
    }
    this.engine.gain.gain.setTargetAtTime(vol, t, 0.15);
    this.engine.o1.frequency.setTargetAtTime(freq, t, 0.15);
    this.engine.o2.frequency.setTargetAtTime(freq * 1.06, t, 0.15);
    this.engine.flt.frequency.setTargetAtTime(80 + throttle * 60, t, 0.15);
    this.engine.nzFlt.frequency.setTargetAtTime(windCenter, t, 0.12);
    this.engine.nzHi.frequency.setTargetAtTime(windHi, t, 0.12);
  }

  startBlueDanube() {
    if (!this.ctx || this.muted) return;
    this.stopBlueDanube();
    
    const bpm = 110;
    const quarter = 60 / bpm; // ~0.545s per beat
    
    // Notes of Blue Danube: [freq, beatOffset, durationInBeats]
    const melody = [
      [293.66, 0, 1],   // D4
      [369.99, 1, 1],   // F#4
      [440.00, 2, 0.75], // A4
      [440.00, 3, 0.75], // A4
      [440.00, 4, 0.75], // A4
      
      [293.66, 6, 1],   // D4
      [369.99, 7, 1],   // F#4
      [440.00, 8, 0.75], // A4
      [440.00, 9, 0.75], // A4
      [440.00, 10, 0.75], // A4
      
      [293.66, 12, 1],   // D4
      [369.99, 13, 1],   // F#4
      [440.00, 14, 0.75], // A4
      [440.00, 15, 0.75], // A4
      
      [369.99, 18, 1],   // F#4
      [369.99, 19, 1],   // F#4
      [293.66, 20, 0.75], // D4
      [293.66, 21, 0.75], // D4
      
      [369.99, 24, 1],   // F#4
      [369.99, 25, 1],   // F#4
      [293.66, 26, 0.75], // D4
      [293.66, 27, 0.75], // D4
    ];
    
    const playSeq = () => {
      if (this.muted) return;
      melody.forEach(([freq, beat, durBeats]) => {
        const delay = beat * quarter;
        const dur = durBeats * quarter;
        this.tone({ type: 'sine', f0: freq, dur: dur, vol: 0.08, delay: delay });
      });
    };
    
    playSeq();
    // Loop the sequence every 30 beats
    this.danubeLoop = setInterval(playSeq, 30 * quarter * 1000);
  }
  
  stopBlueDanube() {
    if (this.danubeLoop) {
      clearInterval(this.danubeLoop);
      this.danubeLoop = null;
    }
  }
}
