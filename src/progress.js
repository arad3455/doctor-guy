// Saved progress (this browser), the Doctor Shop catalogue and achievements.
const KEY = 'doctorguy.save.v1';

/** Shop catalogue (prices in lollipops). Categories are mutually exclusive slots. */
export const SHOP = [
  // hats
  { id: 'hat-party', cat: 'hat', name: 'Party Hat', icon: '🥳', price: 15 },
  { id: 'hat-cap', cat: 'hat', name: 'Wolfson Cap', icon: '🧢', price: 20 },
  { id: 'hat-crown', cat: 'hat', name: 'Royal Crown', icon: '👑', price: 60 },
  { id: 'hat-mirror', cat: 'hat', name: 'Head Mirror', icon: '🪞', price: 35, note: 'The classic doctor look' },
  // back
  { id: 'cape-hero', cat: 'cape', name: 'Hero Cape', icon: '🦸', price: 45 },
  // stethoscope colours
  { id: 'steth-red', cat: 'steth', name: 'Cherry Stethoscope', icon: '❤️', price: 10, color: 0xe0323a },
  { id: 'steth-gold', cat: 'steth', name: 'Golden Stethoscope', icon: '🌟', price: 40, color: 0xffc83d },
  { id: 'steth-rainbow', cat: 'steth', name: 'Rainbow Stethoscope', icon: '🌈', price: 55, rainbow: true },
  // ambulance paint
  { id: 'paint-gold', cat: 'paint', name: 'Gold Ambulance', icon: '🟡', price: 70, tint: 0xffd98a },
  { id: 'paint-bubblegum', cat: 'paint', name: 'Bubblegum Ambulance', icon: '🩷', price: 50, tint: 0xffb8dc },
  { id: 'paint-mint', cat: 'paint', name: 'Mint Ambulance', icon: '🩵', price: 50, tint: 0xb8f5dc },
  { id: 'paint-midnight', cat: 'paint', name: 'Midnight Ambulance', icon: '🌙', price: 60, tint: 0x9aa8ff },
  // siren tones
  { id: 'siren-weewoo', cat: 'siren', name: 'Wee-Woo Siren', icon: '🚨', price: 15, tone: 'weewoo' },
  { id: 'siren-duck', cat: 'siren', name: 'Duck Siren', icon: '🦆', price: 25, tone: 'duck' },
  { id: 'siren-kazoo', cat: 'siren', name: 'Kazoo Siren', icon: '🎺', price: 25, tone: 'kazoo' },
];
export const SHOP_CATS = [
  ['hat', '🎩 Hats'], ['cape', '🦸 Back'], ['steth', '🩺 Stethoscope'], ['paint', '🎨 Ambulance'], ['siren', '🔊 Siren'],
];

/** Achievements: test(p, ctx) gets the saved progress and the live game context. */
export const ACHIEVEMENTS = [
  { id: 'first-aid', icon: '🩹', name: 'First Aid', desc: 'Save your first kid', test: (p) => p.life.saved >= 1 },
  { id: 'park-ranger', icon: '🌳', name: 'Park Ranger', desc: 'Save every kid in the park', test: (p) => p.zoneDone('park', 6) },
  { id: 'beach-patrol', icon: '🏖️', name: 'Beach Patrol', desc: 'Save every kid on the beach', test: (p) => p.zoneDone('beach', 6) },
  { id: 'house-calls', icon: '🏥', name: 'House Calls', desc: 'Finish every check-up in the hospital', test: (p) => p.zoneDone('hospital', 7) },
  { id: 'zoo-keeper', icon: '🦁', name: 'Zoo Keeper', desc: 'Save every kid at the zoo', test: (p) => p.zoneDone('zoo', 6) },
  { id: 'city-slicker', icon: '🏙️', name: 'City Slicker', desc: 'Save every kid Downtown', test: (p) => p.zoneDone('downtown', 6) },
  { id: 'good-neighbor', icon: '🏡', name: 'Good Neighbour', desc: 'Save every kid in Maple Heights', test: (p) => p.zoneDone('suburbs', 6) },
  { id: 'funfair-medic', icon: '🎡', name: 'Funfair Medic', desc: 'Save every kid at Sunset Pier', test: (p) => p.zoneDone('pier', 6) },
  { id: 'happy-camper', icon: '🏕️', name: 'Happy Camper', desc: 'Save every kid at Pinewood Camp', test: (p) => p.zoneDone('camp', 6) },
  { id: 'monkey', icon: '🐒', name: 'Monkey Business', desc: 'Get your stethoscope back from the monkey', test: (p) => !!p.life.missions.monkey },
  { id: 'lion-tamer', icon: '🦁', name: 'Lion Tamer', desc: 'Calm the kid at the lion pen', test: (p) => !!p.life.missions.lion },
  { id: 'perfectionist', icon: '🎯', name: 'Perfectionist', desc: '5 perfect treatments in a row', test: (p, c) => (c?.career.stats.bestStreak ?? 0) >= 5 },
  { id: 'stethoscope-star', icon: '🩺', name: 'Stethoscope Star', desc: '10 stethoscope check-ups', test: (p) => p.life.checkups >= 10 },
  { id: 'speed-demon', icon: '💨', name: 'Speed Demon', desc: 'Hit top speed on Zoo Road', test: (p, c) => (c?.ambulance.speed ?? 0) >= 20.5 },
  { id: 'siren-song', icon: '🚨', name: 'Siren Song', desc: 'Drive 500 m with the siren on', test: (p) => p.life.sirenDriven >= 500 },
  { id: 'ambulance-pro', icon: '🚑', name: 'Ambulance Pro', desc: 'Deliver 3 patients by ambulance', test: (p) => p.life.byAmbulance >= 3 },
  { id: 'marathon', icon: '🏃', name: 'Marathon Doctor', desc: 'Walk 2 km in total', test: (p) => p.life.walked >= 2000 },
  { id: 'road-trip', icon: '🛣️', name: 'Road Trip', desc: 'Drive 3 km in total', test: (p) => p.life.driven >= 3000 },
  { id: 'sweet-tooth', icon: '🍭', name: 'Sweet Tooth', desc: 'Earn 200 lollipops in total', test: (p) => p.life.earned >= 200 },
  { id: 'shopper', icon: '🛍️', name: 'Retail Therapy', desc: 'Buy 3 things at the Doctor Shop', test: (p) => p.owned.length >= 3 },
  { id: 'daredevil', icon: '🚑', name: 'Daredevil', desc: 'Land a stunt jump in the ambulance', test: (p) => Object.keys(p.data.stunts ?? {}).length >= 1 },
  { id: 'stunt-master', icon: '⭐', name: 'Stunt Master', desc: 'Land all 6 unique stunt jumps', test: (p) => Object.keys(p.data.stunts ?? {}).length >= 6 },
  { id: 'frenzy-fiend', icon: '⚡', name: 'Frenzy Fiend', desc: 'Score 10+ points in a Check-up Frenzy', test: (p) => (p.data.frenzyBest ?? 0) >= 10 },
  { id: 'chief', icon: '🏥', name: 'Chief of Medicine', desc: 'Reach the Chief of Medicine rank', test: (p) => p.xp >= 700 },
  { id: 'real-doctor', icon: '🎓', name: 'Actually a Real Doctor?!', desc: 'Reach the highest rank', test: (p) => p.xp >= 1000 },
];

const fresh = () => ({
  v: 1, xp: 0, wallet: 0, owned: [], equipped: {}, achievements: {},
  life: { saved: 0, checkups: 0, walked: 0, driven: 0, sirenDriven: 0, earned: 0, byAmbulance: 0, shifts: 0, missions: {} },
});

export class Progress {
  constructor() {
    this.data = fresh();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...fresh(), ...JSON.parse(raw), life: { ...fresh().life, ...JSON.parse(raw).life } };
    } catch { /* private mode etc.: play without saving */ }
    this.dirty = false;
  }
  get xp() { return this.data.xp; }
  set xp(v) { this.data.xp = v; this.dirty = true; }
  get wallet() { return this.data.wallet; }
  set wallet(v) { if (v !== this.data.wallet) { this.data.wallet = v; this.dirty = true; } }
  get owned() { return this.data.owned; }
  get equipped() { return this.data.equipped; }
  get life() { return this.data.life; }
  /** All `count` missions of a zone saved at least once (ever). */
  zoneDone(zone, count) { return Object.values(this.life.missions).filter((z) => z === zone).length >= count; }
  missionDone(id, zone) { this.life.missions[id] = zone; this.dirty = true; }
  add(stat, n) { this.life[stat] = (this.life[stat] ?? 0) + n; this.dirty = true; }

  buy(item) {
    if (this.owned.includes(item.id) || this.wallet < item.price) return false;
    this.data.wallet -= item.price;
    this.owned.push(item.id);
    this.dirty = true;
    return true;
  }
  equip(item) { this.equipped[item.cat] = this.equipped[item.cat] === item.id ? null : item.id; this.dirty = true; }
  item(cat) { return SHOP.find((s) => s.id === this.equipped[cat]); }

  /** Returns the achievements that just got unlocked. */
  checkAchievements(ctx) {
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.test(this, ctx); } catch { ok = false; }
      if (ok) { this.data.achievements[a.id] = Date.now(); unlocked.push(a); this.dirty = true; }
    }
    return unlocked;
  }
  has(id) { return !!this.data.achievements[id]; }

  save(force = false) {
    if (!this.dirty && !force) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.dirty = false; } catch { /* storage full / blocked */ }
  }
  wipe() { this.data = fresh(); this.dirty = true; this.save(); }
}
