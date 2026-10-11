// Ambulance radio (GTA-style stations, all original chiptunes synthesised on the fly). R or the 📻 button changes
// station while you drive: Wolfson Pop FM → Chill Waves → Siren Funk → off. It plays only inside the ambulance.
import { audioCtx } from './audio.js';

// note helpers: semitones from A4 → Hz
const hz = (n) => 440 * 2 ** (n / 12);
// a station = tempo + 4 bars of melody / bass / drums (16 steps a bar), all in one key
export const STATIONS = [
  {
    name: 'Wolfson Pop FM', icon: '🎵', bpm: 124, lead: 'square', vol: 0.035,
    // C major pop hook (semitones from A4; null = rest)
    melody: [3, null, 7, 10, 12, null, 10, 7, 8, null, 7, 5, 7, null, null, null, 3, null, 7, 10, 15, null, 14, 12, 10, null, 12, 14, 15, null, null, null],
    bass: [-21, -21, -14, -14, -16, -16, -9, -9],
    drums: 'k.h.s.h.k.k.s.h.',
  },
  {
    name: 'Chill Waves', icon: '🌊', bpm: 86, lead: 'triangle', vol: 0.05,
    melody: [0, null, null, 4, 7, null, 12, null, 11, null, 7, null, 4, null, null, null, 2, null, null, 5, 9, null, 14, null, 12, null, 9, null, 5, null, null, null],
    bass: [-24, -24, -19, -19, -22, -22, -17, -17],
    drums: 'k...h...s...h...',
  },
  {
    name: 'Siren Funk', icon: '🚨', bpm: 108, lead: 'sawtooth', vol: 0.022,
    melody: [-2, null, 1, -2, 3, null, 1, null, -2, null, -2, 5, 3, 1, -2, null, -2, null, 1, -2, 6, null, 5, 3, 1, null, -2, null, 1, null, -2, null],
    bass: [-26, -26, -26, -14, -21, -21, -23, -14],
    drums: 'k.hsk.hsk.hsk.ss',
  },
];

export class Radio {
  constructor({ onChange } = {}) {
    this.station = -1; // off
    this.onChange = onChange;
    this.step = 0;
    this.nextTime = 0;
  }

  get name() { return this.station < 0 ? 'Radio off' : `${STATIONS[this.station].icon} ${STATIONS[this.station].name}`; }

  /** Next station (wraps round to off). */
  cycle() {
    this.station = this.station + 1 >= STATIONS.length ? -1 : this.station + 1;
    this.step = 0;
    this.nextTime = 0;
    this.onChange?.(this.name, this.station);
  }

  /** Call every frame; `playing` = in the ambulance and not paused. Schedules notes ~0.4 s ahead. */
  update(playing) {
    const ctx = audioCtx();
    if (!ctx || ctx.state !== 'running' || this.station < 0 || !playing) { this.nextTime = 0; return; }
    if (!this.out) { this.out = ctx.createGain(); this.out.gain.value = 0.9; this.out.connect(ctx.destination); }
    const st = STATIONS[this.station], stepDur = 60 / st.bpm / 4;
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.4) { // (a generous look-ahead: no gaps even at low frame rates)
      const i = this.step, t = this.nextTime;
      const m = st.melody[i % st.melody.length];
      if (m != null) this.note(ctx, hz(m), t, stepDur * 1.8, st.lead, st.vol);
      if (i % 4 === 0) this.note(ctx, hz(st.bass[Math.floor(i / 4) % st.bass.length]), t, stepDur * 3.5, 'triangle', 0.07);
      const d = st.drums[i % st.drums.length];
      if (d === 'k') this.kick(ctx, t);
      else if (d === 's') this.snare(ctx, t);
      else if (d === 'h') this.hat(ctx, t);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  note(ctx, f, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + dur + 0.02);
  }

  kick(ctx, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.16);
  }

  noise(ctx, t, dur, vol, freq) {
    if (!this.buf) { const n = ctx.sampleRate * 0.3; this.buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = this.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.buf; f.type = 'highpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + dur + 0.02);
  }

  snare(ctx, t) { this.noise(ctx, t, 0.14, 0.09, 1200); }
  hat(ctx, t) { this.noise(ctx, t, 0.04, 0.035, 6000); }
}
