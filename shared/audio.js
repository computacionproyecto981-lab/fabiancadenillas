/* DOCE · motor de audio: síntesis de efectos, música adaptativa por capas, reverberación y paneo estéreo */
(function () {
  'use strict';
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  const A = {
    ctx: null, master: null, musicBus: null, sfxBus: null, verb: null, noiseBuf: null,
    musicOn: get('doce.music') !== '0', sfxOn: get('doce.sfx') !== '0',
    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        const c = this.ctx = new AC();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .25;
        this.master = c.createGain(); this.master.gain.value = .85;
        this.master.connect(comp); comp.connect(c.destination);
        this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? .5 : 0; this.musicBus.connect(this.master);
        this.duckGain = c.createGain(); this.duckGain.gain.value = 1; this.duckGain.connect(this.musicBus);
        this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxOn ? .9 : 0; this.sfxBus.connect(this.master);
        this.verb = c.createConvolver(); this.verb.buffer = this._ir(2.4);
        const vg = c.createGain(); vg.gain.value = .32; this.verb.connect(vg); vg.connect(this.master);
        const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = nb;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    _ir(sec) {
      const c = this.ctx, len = (c.sampleRate * sec) | 0, b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      return b;
    },
    setMusic(on) { this.musicOn = on; set('doce.music', on ? '1' : '0'); if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? .5 : 0, this.ctx.currentTime, .05); },
    setSfx(on) { this.sfxOn = on; set('doce.sfx', on ? '1' : '0'); if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? .9 : 0, this.ctx.currentTime, .05); },
    now() { return this.ctx ? this.ctx.currentTime : 0; }
  };

  function route(node, dest, pan, verb) {
    const c = A.ctx; let n = node;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); n = p; }
    n.connect(dest);
    if (verb) { const s = c.createGain(); s.gain.value = verb; n.connect(s); s.connect(A.verb); }
  }
  /* una voz sintetizada con envolvente, filtro, deslizamiento de tono y vibrato */
  function voice(o) {
    const c = A.ctx; if (!c) return;
    const t = o.t != null ? o.t : c.currentTime, d = o.dur != null ? o.dur : .2, v = o.vol != null ? o.vol : .2;
    const a = o.attack != null ? o.attack : .004, rel = o.release != null ? o.release : .08;
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t + a);
    if (o.hold) { g.gain.setValueAtTime(v, t + a + d); g.gain.exponentialRampToValueAtTime(.0001, t + a + d + rel); }
    else g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    const end = t + a + d + rel + .05;
    let src;
    if (o.type === 'noise') { src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true; if (o.rate) src.playbackRate.value = o.rate; }
    else {
      src = c.createOscillator(); src.type = o.type || 'sine';
      src.frequency.setValueAtTime(o.f, t);
      if (o.slide) src.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideT || d));
      if (o.detune) src.detune.value = o.detune;
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vibRate || 5.5; lg.gain.value = o.vib; l.connect(lg); lg.connect(src.frequency); l.start(t); l.stop(end); }
    }
    let n = src;
    if (o.filter) {
      const f = c.createBiquadFilter(); f.type = o.ftype || 'lowpass';
      f.frequency.setValueAtTime(o.filter, t);
      if (o.fslide) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.fslide), t + (o.fslideT || d));
      f.Q.value = o.q != null ? o.q : .7; n.connect(f); n = f;
    }
    n.connect(g);
    route(g, o.dest || A.sfxBus, o.pan, o.verb);
    src.start(t, o.type === 'noise' ? Math.random() * 1.5 : 0); src.stop(end);
  }

  /* ---------------- instrumentos (música y efectos) ---------------- */
  const INST = {
    pluck: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'triangle', dur: Math.min(d, .5), vol: v, filter: f * 5, fslide: f * 1.5 }); voice({ ...x, t, f: f * 2, type: 'sine', dur: .08, vol: v * .3 }); },
    marimba: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sine', dur: .35, vol: v }); voice({ ...x, t, f: f * 4, type: 'sine', dur: .05, vol: v * .35 }); },
    bell: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sine', dur: 1.2, vol: v }); voice({ ...x, t, f: f * 2.76, type: 'sine', dur: .4, vol: v * .35 }); voice({ ...x, t, f: f * 5.4, type: 'sine', dur: .15, vol: v * .15 }); },
    piano: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'triangle', dur: Math.max(.4, d * 1.4), vol: v, filter: 2600, fslide: 900 }); voice({ ...x, t, f: f * 2, type: 'sine', dur: .25, vol: v * .25 }); },
    lead: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'square', dur: d * .9, vol: v * .55, filter: 2400, q: 2, vib: f * .012, attack: .01, hold: true, release: .08 }); },
    saw: (t, f, d, v, x) => { for (const dt of [-7, 7]) voice({ ...x, t, f, type: 'sawtooth', detune: dt, dur: d * .9, vol: v * .4, filter: 2200, fslide: 1200, attack: .01, hold: true, release: .1 }); },
    flute: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sine', dur: d * .95, vol: v, vib: f * .01, attack: .05, hold: true, release: .15 }); voice({ ...x, t, f, type: 'noise', dur: .05, vol: v * .08, filter: f * 2, ftype: 'bandpass', q: 3 }); },
    banjo: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sawtooth', dur: .22, vol: v * .6, filter: 3500, fslide: 700, q: 3 }); voice({ ...x, t, f: f * 2, type: 'square', dur: .05, vol: v * .12 }); },
    padSaw: (t, f, d, v, x) => { for (const dt of [-10, 0, 10]) voice({ ...x, t, f, type: 'sawtooth', detune: dt, dur: d, vol: v * .2, filter: 900, q: .5, attack: .35, hold: true, release: .6 }); },
    padSoft: (t, f, d, v, x) => { for (const dt of [-6, 6]) voice({ ...x, t, f, type: 'triangle', detune: dt, dur: d, vol: v * .35, attack: .4, hold: true, release: .7 }); },
    bassSaw: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sawtooth', dur: d * .85, vol: v * .7, filter: 420, fslide: 220, q: 4, hold: true, release: .05 }); voice({ ...x, t, f, type: 'sine', dur: d * .85, vol: v * .6, hold: true, release: .05 }); },
    bassSub: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'sine', dur: d * .9, vol: v, hold: true, release: .06 }); voice({ ...x, t, f: f * 2, type: 'triangle', dur: .06, vol: v * .25 }); },
    bassPluck: (t, f, d, v, x) => { voice({ ...x, t, f, type: 'square', dur: .25, vol: v * .5, filter: 700, fslide: 150, q: 6 }); voice({ ...x, t, f, type: 'sine', dur: .3, vol: v * .6 }); },
    kick: (t, v, x) => { voice({ ...x, t, f: 160, slide: 42, slideT: .12, type: 'sine', dur: .28, vol: v }); voice({ ...x, t, type: 'noise', dur: .012, vol: v * .25, filter: 3000, ftype: 'highpass' }); },
    snare: (t, v, x) => { voice({ ...x, t, type: 'noise', dur: .16, vol: v * .55, filter: 1800, ftype: 'bandpass', q: .8 }); voice({ ...x, t, f: 190, slide: 120, type: 'triangle', dur: .1, vol: v * .5 }); },
    clap: (t, v, x) => { for (let i = 0; i < 3; i++) voice({ ...x, t: t + i * .012, type: 'noise', dur: i === 2 ? .14 : .02, vol: v * .45, filter: 1400, ftype: 'bandpass', q: 1.2 }); },
    hat: (t, v, x) => { voice({ ...x, t, type: 'noise', dur: .035, vol: v * .3, filter: 7500, ftype: 'highpass' }); },
    ohat: (t, v, x) => { voice({ ...x, t, type: 'noise', dur: .18, vol: v * .22, filter: 6500, ftype: 'highpass' }); },
    shaker: (t, v, x) => { voice({ ...x, t, type: 'noise', dur: .05, vol: v * .18, filter: 5000, ftype: 'bandpass', q: 2, attack: .015 }); },
    tom: (t, v, x) => { voice({ ...x, t, f: 140, slide: 70, type: 'sine', dur: .3, vol: v * .8 }); }
  };

  /* ---------------- efectos de sonido ---------------- */
  const SFX = {
    click: o => voice({ ...o, f: 1300 * o.p, slide: 900 * o.p, type: 'triangle', dur: .04, vol: .12 * o.v }),
    select: o => { voice({ ...o, f: 660 * o.p, type: 'triangle', dur: .06, vol: .14 * o.v }); voice({ ...o, t: A.now() + .05, f: 990 * o.p, type: 'triangle', dur: .08, vol: .12 * o.v }); },
    back: o => { voice({ ...o, f: 700 * o.p, type: 'triangle', dur: .05, vol: .12 * o.v }); voice({ ...o, t: A.now() + .045, f: 470 * o.p, type: 'triangle', dur: .07, vol: .1 * o.v }); },
    jump: o => voice({ ...o, f: 240 * o.p, slide: 640 * o.p, type: 'square', dur: .16, vol: .09 * o.v, filter: 2200 }),
    land: o => { voice({ ...o, f: 150 * o.p, slide: 55, type: 'sine', dur: .14, vol: .35 * o.v }); voice({ ...o, type: 'noise', dur: .06, vol: .12 * o.v, filter: 600 }); },
    thud: o => { voice({ ...o, f: 110 * o.p, slide: 40, type: 'sine', dur: .2, vol: .45 * o.v }); voice({ ...o, type: 'noise', dur: .08, vol: .18 * o.v, filter: 900 * o.p }); },
    wood: o => { voice({ ...o, f: 520 * o.p, type: 'sine', dur: .05, vol: .25 * o.v }); voice({ ...o, type: 'noise', dur: .03, vol: .12 * o.v, filter: 2200 * o.p, ftype: 'bandpass', q: 4 }); },
    slide: o => voice({ ...o, type: 'noise', dur: .1, vol: .1 * o.v, filter: 700 * o.p, fslide: 1400 * o.p, ftype: 'bandpass', q: 1.5, attack: .02 }),
    coin: o => { voice({ ...o, f: 988 * o.p, type: 'square', dur: .07, vol: .06 * o.v, filter: 5000 }); voice({ ...o, t: A.now() + .07, f: 1319 * o.p, type: 'square', dur: .18, vol: .06 * o.v, filter: 5000, verb: .15 }); },
    pickup: o => [0, 4, 7, 12].forEach((s, i) => voice({ ...o, t: A.now() + i * .035, f: 880 * o.p * Math.pow(2, s / 12), type: 'sine', dur: .12, vol: .1 * o.v, verb: .25 })),
    sparkle: o => { for (let i = 0; i < 5; i++) voice({ ...o, t: A.now() + i * .03, f: (1800 + Math.random() * 2400) * o.p, type: 'sine', dur: .09, vol: .05 * o.v, verb: .4 }); },
    chime: o => INST.bell(A.now(), 1047 * o.p, .5, .12 * o.v, { ...o, verb: .35 }),
    combo: o => { INST.bell(A.now(), 523 * o.p, .4, .1 * o.v, { ...o, verb: .3 }); INST.bell(A.now() + .06, 784 * o.p, .4, .08 * o.v, { ...o, verb: .3 }); },
    hit: o => { voice({ ...o, type: 'noise', dur: .09, vol: .3 * o.v, filter: 1600 * o.p, ftype: 'bandpass', q: 1 }); voice({ ...o, f: 220 * o.p, slide: 90, type: 'square', dur: .1, vol: .08 * o.v, filter: 1200 }); },
    clack: o => { voice({ ...o, f: 1500 * o.p, type: 'sine', dur: .025, vol: .25 * o.v }); voice({ ...o, type: 'noise', dur: .02, vol: .15 * o.v, filter: 4000, ftype: 'highpass' }); },
    pop: o => voice({ ...o, f: 380 * o.p, slide: 1100 * o.p, slideT: .06, type: 'sine', dur: .09, vol: .22 * o.v }),
    whoosh: o => voice({ ...o, type: 'noise', dur: .28, vol: .16 * o.v, filter: 350 * o.p, fslide: 2600 * o.p, ftype: 'bandpass', q: 1.4, attack: .06 }),
    swish: o => voice({ ...o, type: 'noise', dur: .12, vol: .12 * o.v, filter: 1800 * o.p, fslide: 5000 * o.p, ftype: 'bandpass', q: 1.8, attack: .02 }),
    slice: o => { voice({ ...o, type: 'noise', dur: .12, vol: .2 * o.v, filter: 3000, fslide: 9000, ftype: 'highpass', attack: .005 }); voice({ ...o, f: 2600 * o.p, slide: 1800 * o.p, type: 'sine', dur: .18, vol: .07 * o.v, verb: .2 }); },
    shatter: o => { voice({ ...o, type: 'noise', dur: .25, vol: .2 * o.v, filter: 4500, ftype: 'highpass' }); for (let i = 0; i < 6; i++) voice({ ...o, t: A.now() + Math.random() * .08, f: (2000 + Math.random() * 3500) * o.p, type: 'sine', dur: .2 + Math.random() * .3, vol: .04 * o.v, verb: .35 }); },
    snap: o => { voice({ ...o, type: 'noise', dur: .04, vol: .3 * o.v, filter: 2500 * o.p, ftype: 'bandpass', q: 2 }); voice({ ...o, f: 900 * o.p, slide: 300, type: 'triangle', dur: .06, vol: .12 * o.v }); },
    laser: o => voice({ ...o, f: 1600 * o.p, slide: 180 * o.p, type: 'sawtooth', dur: .16, vol: .07 * o.v, filter: 3000 }),
    boom: o => { voice({ ...o, f: 90 * o.p, slide: 30, type: 'sine', dur: .5, vol: .55 * o.v }); voice({ ...o, type: 'noise', dur: .5, vol: .35 * o.v, filter: 1400, fslide: 120, verb: .3 }); },
    explosion: o => { voice({ ...o, f: 70 * o.p, slide: 25, type: 'sine', dur: .8, vol: .6 * o.v }); voice({ ...o, type: 'noise', dur: .9, vol: .45 * o.v, filter: 2400 * o.p, fslide: 90, verb: .45 }); voice({ ...o, type: 'noise', dur: .08, vol: .3 * o.v, filter: 5000, ftype: 'highpass' }); },
    whistle: o => voice({ ...o, f: 1800 * o.p, slide: 500 * o.p, type: 'sine', dur: o.d || .9, vol: .05 * o.v, vib: 15, attack: .1 }),
    horn: o => { for (const f of [220, 277, 330]) voice({ ...o, f: f * o.p, type: 'sawtooth', dur: .9, vol: .07 * o.v, filter: 1600, attack: .03, hold: true, release: .3, verb: .2 }); },
    crowd: o => voice({ ...o, type: 'noise', dur: 1.6, vol: .14 * o.v, filter: 900, ftype: 'bandpass', q: .6, attack: .25, verb: .3 }),
    cash: o => { voice({ ...o, type: 'noise', dur: .03, vol: .2 * o.v, filter: 6000, ftype: 'highpass' }); INST.bell(A.now() + .04, 1568 * o.p, .4, .1 * o.v, { ...o, verb: .2 }); INST.bell(A.now() + .1, 2093 * o.p, .4, .08 * o.v, { ...o, verb: .2 }); },
    error: o => { voice({ ...o, f: 196 * o.p, type: 'square', dur: .1, vol: .07 * o.v, filter: 1500 }); voice({ ...o, t: A.now() + .11, f: 147 * o.p, type: 'square', dur: .16, vol: .07 * o.v, filter: 1500 }); },
    tick: o => voice({ ...o, f: 2200 * o.p, type: 'square', dur: .015, vol: .03 * o.v }),
    beep: o => voice({ ...o, f: 880 * o.p, type: 'square', dur: .12, vol: .07 * o.v, filter: 3000 }),
    go: o => voice({ ...o, f: 1760 * o.p, type: 'square', dur: .35, vol: .08 * o.v, filter: 4000, verb: .2 }),
    star: o => { INST.bell(A.now(), 1568 * o.p, .6, .12 * o.v, { ...o, verb: .4 }); SFX.sparkle(o); },
    win: o => { const n = [0, 4, 7, 12, 16]; n.forEach((s, i) => INST.bell(A.now() + i * .09, 523 * Math.pow(2, s / 12), .8, .11 * o.v, { verb: .4 })); for (const s of [0, 4, 7]) voice({ t: A.now() + .45, f: 262 * Math.pow(2, s / 12), type: 'triangle', dur: 1, vol: .08 * o.v, attack: .05, hold: true, release: .8, verb: .4 }); },
    lose: o => { [7, 3, 0, -5].forEach((s, i) => voice({ t: A.now() + i * .16, f: 330 * Math.pow(2, s / 12), slide: 320 * Math.pow(2, (s - 1) / 12), type: 'sawtooth', dur: .26, vol: .07 * o.v, filter: 1300, verb: .3 })); },
    level: o => [0, 7, 12].forEach((s, i) => INST.pluck(A.now() + i * .07, 659 * Math.pow(2, s / 12), .3, .14 * o.v, { verb: .3 }))
  };
  A.play = function (name, opts) {
    if (!this.ctx || !SFX[name]) return;
    const o = Object.assign({ p: 1, v: 1 }, opts || {});
    if (o.pitch) o.p = o.pitch;
    if (o.vol) o.v = o.vol;
    delete o.pitch; delete o.vol;
    SFX[name](o);
  };
  A.voice = voice;
  A.INST = INST;

  /* sonido continuo controlable (motor, rodar, cuerda…) */
  A.loop = function (o) {
    if (!this.ctx) return { set() { }, stop() { } };
    const c = this.ctx, g = c.createGain(); g.gain.value = 0;
    let src;
    if (o.type === 'noise') { src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; }
    else { src = c.createOscillator(); src.type = o.type || 'sawtooth'; src.frequency.value = o.f || 100; }
    let n = src, filt = null;
    if (o.filter) { filt = c.createBiquadFilter(); filt.type = o.ftype || 'lowpass'; filt.frequency.value = o.filter; filt.Q.value = o.q || 1; n.connect(filt); n = filt; }
    n.connect(g); g.connect(this.sfxBus); src.start();
    return {
      set(p) {
        const t = c.currentTime;
        if (p.vol != null) g.gain.setTargetAtTime(p.vol, t, .04);
        if (p.f != null && src.frequency) src.frequency.setTargetAtTime(p.f, t, .03);
        if (p.filter != null && filt) filt.frequency.setTargetAtTime(p.filter, t, .03);
      },
      stop() { g.gain.setTargetAtTime(0, c.currentTime, .05); try { src.stop(c.currentTime + .3); } catch (e) { } }
    };
  };

  /* ---------------- música adaptativa ---------------- */
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], lyd: [0, 2, 4, 6, 7, 9, 11] };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function compile(s) {
    const sc = SCALES[s.scale] || SCALES.minor;
    const note = (deg, oct) => { const n = sc.length, o = Math.floor(deg / n); return s.root + 12 * (oct + o) + sc[((deg % n) + n) % n]; };
    const bars = s.prog.length;
    const r = rng(s.seed || 7);
    // melodía: motivo de 2 compases repetido con variaciones (A A' B A)
    const motif = [];
    const dens = s.leadDensity || .45;
    let deg = 4;
    for (let st = 0; st < 32; st++) {
      const strong = st % 4 === 0;
      if (r() < (strong ? dens + .3 : dens * .6)) {
        deg += strong ? [0, 2, -2, 4, -3][(r() * 5) | 0] : [1, -1, 1, -1, 2][(r() * 5) | 0];
        deg = clamp(deg, 0, 9);
        const len = [1, 2, 2, 3, 4][(r() * 5) | 0];
        motif.push({ st, deg, len, strong });
      }
    }
    const melody = [];
    for (let rep = 0; rep < Math.ceil(bars / 2); rep++) {
      const vary = rep % 4 === 1 ? 1 : rep % 4 === 2 ? 2 : 0;
      for (const m of motif) {
        const st = rep * 32 + m.st;
        if (vary === 2 && m.st >= 16) continue;
        melody.push({ st, deg: m.deg + (vary === 1 && m.st >= 16 ? (m.strong ? 2 : 1) : 0), len: m.len });
      }
      if (vary === 2) for (let st = 16; st < 32; st += 4) melody.push({ st: rep * 32 + st, deg: [7, 6, 4, 2][(st - 16) / 4], len: 3 });
    }
    return { ...s, sc, note, bars, melody, total: bars * 16 };
  }

  const Music = {
    song: null, step: 0, next: 0, timer: null, intensity: 1, loops: 0,
    play(spec, intensity) {
      A.init(); if (!A.ctx) return;
      this.stop();
      this.song = compile(spec);
      this.intensity = intensity != null ? intensity : 1;
      this.step = 0; this.next = A.ctx.currentTime + .08;
      A.duckGain.gain.cancelScheduledValues(A.ctx.currentTime);
      A.duckGain.gain.setValueAtTime(.0001, A.ctx.currentTime);
      A.duckGain.gain.exponentialRampToValueAtTime(1, A.ctx.currentTime + .6);
      this.timer = setInterval(() => this._tick(), 25);
    },
    stop(fade) {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      if (A.ctx && fade) { A.duckGain.gain.setTargetAtTime(.0001, A.ctx.currentTime, .15); }
      this.song = null;
    },
    setIntensity(i) { this.intensity = clamp(i, 0, 3); },
    duck(on) { if (A.ctx && this.song) A.duckGain.gain.setTargetAtTime(on ? .35 : 1, A.ctx.currentTime, .12); },
    _tick() {
      const c = A.ctx, s = this.song; if (!c || !s || c.state !== 'running') return;
      const sixteenth = 60 / s.bpm / 4;
      if (this.next < c.currentTime - .3) this.next = c.currentTime + .05;
      while (this.next < c.currentTime + .14) {
        const swing = (this.step % 2) ? sixteenth * (s.swing || 0) : 0;
        this._play(this.step, this.next + swing, sixteenth);
        this.step++; this.next += sixteenth;
      }
    },
    _play(i, t, sx) {
      const s = this.song, I = this.intensity, D = A.duckGain;
      const st = i % 16, bar = Math.floor(i / 16) % s.bars, loop = Math.floor(i / s.total);
      const breakdown = I >= 2 && loop % 4 === 3 && bar >= s.bars - 2;
      const deg = s.prog[bar];
      const chord = [deg, deg + 2, deg + 4];
      const X = { dest: D };
      const at = (p, k) => p && p[k % p.length] !== '.' && p[k % p.length];
      // batería
      if (I >= 1 && !breakdown) {
        if (at(s.kick, st)) INST.kick(t, .9, X);
        if (at(s.snare, st)) INST[s.clap ? 'clap' : 'snare'](t, .7, X);
        const h = at(s.hat, st);
        if (h) INST[h === 'o' ? 'ohat' : s.shaker ? 'shaker' : 'hat'](t, .8, X);
        if (I >= 2 && s.fill && bar === s.bars - 1 && st >= 12) INST.tom(t, .6, { dest: D, pan: (st - 13.5) / 3 });
      }
      // bajo
      const b = at(s.bass, st);
      if (b && (I >= 1 || st % 8 === 0)) {
        const n = s.note(b === '5' ? deg + 4 : deg, 2) + (b === 'o' ? 12 : 0);
        INST[s.bassInst || 'bassSub'](t, mtof(n), sx * (s.bassLen || 2), .32, X);
      }
      // colchón armónico
      if (st === 0 && s.pad !== false) for (const d of chord) INST[s.padInst || 'padSoft'](t, mtof(s.note(d, 4)), sx * 15, .1, { dest: D, verb: .3 });
      // arpegio
      if (I >= 1 && at(s.arp, st)) {
        const k = Math.floor(i / 1) % 4, d = chord[[0, 1, 2, 1][k]] + (k === 3 ? 0 : 0);
        INST[s.arpInst || 'pluck'](t, mtof(s.note(d, s.arpOct || 5)), sx * 2, .09, { dest: D, verb: .2, pan: ((i % 4) - 1.5) * .25 });
      }
      // melodía
      if ((I >= 2 || s.leadAlways) && !breakdown) {
        const pos = i % s.total;
        for (const m of s.melody) if (m.st === pos) INST[s.leadInst || 'lead'](t, mtof(s.note(m.deg + (s.leadShift || 0), s.leadOct || 5)), sx * m.len, .13, { dest: D, verb: .25 });
      }
    }
  };
  A.Music = Music;
  A.mtof = mtof;
  window.Audio2 = A;
})();
