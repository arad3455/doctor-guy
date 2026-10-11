// Zone ambience, synthesised like the rest of the game's audio: rain hiss during showers, gulls by the sea and
// the harbour, a music box at the funfair, crackling fire + birdsong at Pinewood Camp, a soft hum Downtown.
// Everything fades with distance from the source and stays quiet under the game's own sounds.

export class Ambience {
  /** getCtx: () => AudioContext | null (the game's shared one, created on the first tap). */
  constructor(getCtx) {
    this.getCtx = getCtx;
    this.ready = false;
    this.timers = { gull: 2, bird: 1, crackle: 0, note: 0 };
    this.noteI = 0;
  }

  setup(ctx) {
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    // a looping noise buffer (rain + city hum are filtered noise)
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      return g;
    };
    this.rainGain = noise('highpass', 1400, 0.4);
    this.humGain = noise('lowpass', 180, 0.7);
    this.waveGain = noise('lowpass', 500, 0.3);
    this.ready = true;
  }

  /** levels: { rain 0..1, sea, city, fair, camp } (0..1 closeness to each), outside */
  update(dt, levels) {
    const ctx = this.getCtx();
    if (!ctx || ctx.state !== 'running') return;
    if (!this.ready) this.setup(ctx);
    const now = ctx.currentTime, glide = (g, v) => g.gain.setTargetAtTime(v, now, 0.6);
    const out = levels.outside ? 1 : 0.15;
    glide(this.rainGain, levels.rain * 0.09 * out);
    glide(this.humGain, levels.city * 0.06 * out);
    glide(this.waveGain, (levels.sea * 0.05 + Math.sin(now * 0.7) * levels.sea * 0.02) * out);
    if (!levels.outside) return;
    const t = this.timers;
    // seagulls: a falling "kee-aah" now and then
    if (levels.sea > 0.2 && (t.gull -= dt) <= 0) { t.gull = 4 + Math.random() * 7; this.gull(ctx, levels.sea); }
    // birdsong in the woods (and a little in the park)
    if (levels.camp > 0.2 && (t.bird -= dt) <= 0) { t.bird = 1.5 + Math.random() * 4; this.chirp(ctx, levels.camp); }
    // crackling campfire close to the fire pit
    if (levels.fire > 0.1 && (t.crackle -= dt) <= 0) { t.crackle = 0.05 + Math.random() * 0.25; this.crack(ctx, levels.fire); }
    // a music box tune at the funfair
    if (levels.fair > 0.1 && (t.note -= dt) <= 0) { t.note = 0.32; this.musicBox(ctx, levels.fair); }
  }

  blip(ctx, freq, dur, vol, { type = 'sine', slide = 1, delay = 0 } = {}) {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  gull(ctx, k) {
    const v = 0.035 * k;
    this.blip(ctx, 1500, 0.28, v, { type: 'triangle', slide: 0.6 });
    this.blip(ctx, 1350, 0.32, v * 0.8, { type: 'triangle', slide: 0.55, delay: 0.32 });
  }

  chirp(ctx, k) {
    const base = 2600 + Math.random() * 1400, v = 0.025 * k, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) this.blip(ctx, base * (1 + i * 0.06), 0.07, v, { slide: 1.3, delay: i * 0.1 });
  }

  crack(ctx, k) {
    this.blip(ctx, 180 + Math.random() * 600, 0.03, 0.04 * k, { type: 'square', slide: 0.5 });
  }

  musicBox(ctx, k) {
    // "Twinkle"-ish loop in C major on a bell tone
    const tune = [0, 0, 7, 7, 9, 9, 7, -1, 5, 5, 4, 4, 2, 2, 0, -1];
    const step = tune[this.noteI++ % tune.length];
    if (step < 0) return;
    const f = 523.25 * 2 ** (step / 12);
    this.blip(ctx, f, 0.6, 0.03 * k, { type: 'sine' });
    this.blip(ctx, f * 2, 0.3, 0.012 * k, { type: 'sine' });
  }
}
