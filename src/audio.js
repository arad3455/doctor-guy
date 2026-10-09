// Tiny WebAudio synth for game feedback — no asset files needed.
let ctx = null;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'sine', vol = 0.15, delay = 0, slide = 0 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  pickup: () => { tone(880, 0.08, { type: 'square', vol: 0.06 }); tone(1320, 0.12, { type: 'square', vol: 0.06, delay: 0.06 }); },
  hit: () => tone(660, 0.12, { type: 'triangle', vol: 0.2, slide: 1.5 }),
  miss: () => tone(160, 0.25, { type: 'sawtooth', vol: 0.08, slide: 0.6 }),
  alert: () => { for (let i = 0; i < 3; i++) { tone(780, 0.14, { type: 'square', vol: 0.05, delay: i * 0.3 }); tone(620, 0.14, { type: 'square', vol: 0.05, delay: i * 0.3 + 0.15 }); } },
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.15, delay: i * 0.09 })),
  jump: () => tone(300, 0.15, { type: 'sine', vol: 0.08, slide: 2 }),
  carry: () => tone(440, 0.15, { type: 'triangle', vol: 0.12, slide: 1.3 }),
  fanfare: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.06, delay: i * 0.14 })),
};
