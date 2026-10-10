// GTA-style mission feedback: mission start cards, the "PATIENT SAVED" banner with a lollipop pay-out,
// medical ranks (XP), and the stats that feed the end-of-shift screen.
import { sfx } from './audio.js';
import { locationName } from './world.js';

const $ = (id) => document.getElementById(id);

export const RANKS = [
  { xp: 0, name: 'Volunteer', icon: '🩹' },
  { xp: 100, name: 'Intern', icon: '📋' },
  { xp: 250, name: 'Resident', icon: '🩺' },
  { xp: 450, name: 'Doctor', icon: '👨‍⚕️' },
  { xp: 700, name: 'Chief of Medicine', icon: '🏥' },
  { xp: 1000, name: 'Actually a Real Doctor?!', icon: '🎓' },
];
const UNITS_PER_M = 1.36;

export class Career {
  /** setSlowmo(scale) slows the world down; onLollipop(n) adds lollipops to the wallet as the counter ticks. */
  constructor({ setSlowmo, onLollipop, progress }) {
    this.setSlowmo = setSlowmo;
    this.onLollipop = onLollipop;
    this.progress = progress; // saved XP and lifetime stats (src/progress.js)
    this.queue = [];
    this.showing = false;
    this.reset();
  }

  // XP is saved between visits; per-shift stats are not
  get xp() { return this.progress.xp; }
  set xp(v) { this.progress.xp = v; }

  reset() {
    this.stats = { saved: 0, walked: 0, driven: 0, fastest: null, fastestName: '', bestStreak: 0, streak: 0, perfect: 0, byAmbulance: 0, lollipops: 0, startedAt: performance.now() };
    this.queue.length = 0;
    this.pendingCard = null;
    this.renderRank(false);
  }

  get rankIndex() { let i = 0; RANKS.forEach((r, k) => { if (this.xp >= r.xp) i = k; }); return i; }

  /** Distance travelled this frame (units), on foot or by ambulance. */
  travel(units, driving, siren = false) {
    const m = units / UNITS_PER_M;
    if (driving) { this.stats.driven += m; this.progress.add('driven', m); if (siren) this.progress.add('sirenDriven', m); }
    else { this.stats.walked += m; this.progress.add('walked', m); }
  }

  /* ---------------- 4. mission start card ---------------- */
  missionStart(def, kidPos, playerPos) {
    // never on top of a PATIENT SAVED / PROMOTED banner: show it once they're done
    if (this.showing || this.queue.length) { this.pendingCard = [def, kidPos, playerPos]; return; }
    const where = locationName(kidPos);
    const dist = Math.round(Math.hypot(kidPos.x - playerPos.x, kidPos.z - playerPos.z) / UNITS_PER_M);
    const el = $('mission-card');
    el.innerHTML = `<div class="mc-kicker">🚨 NEW EMERGENCY</div><div class="mc-title">${def.title}</div><div class="mc-sub">${def.hidden ? 'Somewhere in ' + where : where} · ${def.hidden ? '???' : dist + ' m'}</div>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => el.classList.remove('show'), 3600);
    sfx.stinger();
  }

  /* ---------------- 1 + 2 + 3. patient saved ---------------- */
  /** lines: [{ label, amount }]; returns the total lollipops */
  patientSaved({ id, zone, name, condition, hospital, lines, elapsed, perfect, ambulance }) {
    this.progress.add('saved', 1);
    if (ambulance) this.progress.add('byAmbulance', 1);
    if (id) this.progress.missionDone(id, zone);
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const s = this.stats;
    s.saved++;
    s.lollipops += total;
    if (perfect) { s.perfect++; s.streak++; } else s.streak = 0;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (ambulance) s.byAmbulance++;
    if (s.fastest === null || elapsed < s.fastest) { s.fastest = elapsed; s.fastestName = `${name} · ${condition}`; }
    const before = this.rankIndex;
    const gained = 20 + total * 6 + (perfect ? 10 : 0);
    this.xp += gained;
    this.queue.push({ kind: 'saved', name, condition, hospital, lines, total, xp: gained, streak: s.streak });
    const after = this.rankIndex;
    if (after > before) this.queue.push({ kind: 'rank', rank: RANKS[after] });
    this.pump();
    return total;
  }

  pump() {
    if (this.showing || !this.queue.length) return;
    this.showing = true;
    const item = this.queue.shift();
    (item.kind === 'saved' ? this.showSaved(item) : this.showRank(item)).then(() => {
      this.showing = false;
      this.renderRank(true);
      this.pump();
      if (!this.showing && this.pendingCard) { const c = this.pendingCard; this.pendingCard = null; this.missionStart(...c); }
    });
  }

  showSaved({ title, name, condition, hospital, lines, total, xp, streak }) {
    return new Promise((resolve) => {
      const el = $('saved-banner');
      el.querySelector('.sb-title').textContent = title ?? (hospital ? 'CHECK-UP COMPLETE' : 'PATIENT SAVED');
      el.querySelector('.sb-sub').textContent = `${name} · ${condition}`;
      const list = el.querySelector('.sb-lines');
      list.innerHTML = lines.map((l) => `<div class="sb-line"><span>${l.label}</span><b>+${l.amount} 🍭</b></div>`).join('')
        + `<div class="sb-total"><span>TOTAL</span><b><span class="sb-count">0</span> 🍭</b></div>`
        + `<div class="sb-xp">+${xp} XP${streak >= 2 ? ` · 🔥 ${streak} perfect in a row` : ''}</div>`;
      el.classList.remove('hidden', 'out');
      void el.offsetWidth;
      el.classList.add('in');
      $('wash').classList.add('on');
      this.setSlowmo(0.3); // GTA-style slow motion while the banner lands
      sfx.missionPassed();
      // reveal the reward lines one by one, then count the total up
      const rows = [...list.querySelectorAll('.sb-line')];
      rows.forEach((r, i) => setTimeout(() => { r.classList.add('on'); sfx.tick(); }, 900 + i * 380));
      const countStart = 900 + rows.length * 380 + 150;
      setTimeout(() => {
        list.querySelector('.sb-total').classList.add('on');
        const span = list.querySelector('.sb-count');
        let n = 0;
        const step = () => {
          n = Math.min(total, n + 1);
          span.textContent = n;
          this.onLollipop(1);
          bumpCounter();
          if (n < total) { sfx.tick(); setTimeout(step, Math.max(40, 420 / total)); }
          else { list.querySelector('.sb-xp').classList.add('on'); this.setSlowmo(1); }
        };
        step();
      }, countStart);
      setTimeout(() => {
        el.classList.add('out');
        $('wash').classList.remove('on');
        setTimeout(() => { el.classList.add('hidden'); el.classList.remove('in', 'out'); resolve(); }, 450);
      }, countStart + 700 + total * 60 + 1400);
    });
  }

  showRank({ rank }) {
    return new Promise((resolve) => {
      const el = $('rank-banner');
      el.querySelector('.rb-icon').textContent = rank.icon;
      el.querySelector('.rb-name').textContent = rank.name;
      el.classList.remove('hidden', 'out');
      void el.offsetWidth;
      el.classList.add('in');
      sfx.fanfare();
      this.renderRank(true);
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => { el.classList.add('hidden'); el.classList.remove('in', 'out'); resolve(); }, 450);
      }, 2600);
    });
  }

  /** The rank chip in the HUD: icon, name and an XP bar towards the next rank. */
  renderRank(animate) {
    const i = this.rankIndex, r = RANKS[i], next = RANKS[i + 1];
    const chip = $('rank');
    if (!chip) return;
    chip.querySelector('.rk-icon').textContent = r.icon;
    chip.querySelector('.rk-name').textContent = r.name;
    const pct = next ? ((this.xp - r.xp) / (next.xp - r.xp)) * 100 : 100;
    chip.querySelector('.rk-fill').style.width = `${Math.min(100, pct)}%`;
    chip.querySelector('.rk-xp').textContent = next ? `${this.xp - r.xp}/${next.xp - r.xp} XP` : `${this.xp} XP`;
    if (animate) { chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop'); }
  }

  /** Landed a stunt jump: a STUNT JUMP banner (with the one-time UNIQUE STUNT BONUS). */
  stunt({ name, distance, airtime, unique, found, total }) {
    const lines = [{ label: `${name} · ${distance.toFixed(0)} m · ${airtime.toFixed(1)} s air`, amount: 2 + Math.round(distance / 4) }];
    if (unique) lines.push({ label: `⭐ Unique stunt bonus (${found}/${total})`, amount: 10 });
    const total_ = lines.reduce((s, l) => s + l.amount, 0);
    this.stats.stunts = (this.stats.stunts ?? 0) + 1;
    this.xp += 10 + (unique ? 25 : 0);
    this.queue.push({ kind: 'saved', title: unique ? 'UNIQUE STUNT BONUS' : 'STUNT JUMP', name: '🚑💨', condition: name, lines, total: total_, xp: 10 + (unique ? 25 : 0), streak: 0 });
    if (unique) sfx.stuntBonus();
    this.pump();
  }

  /** Check-up Frenzy over: a FRENZY COMPLETE banner paying out the score. */
  frenzyOver({ score, count, record, best, lines }) {
    lines = lines.filter((l) => l.amount > 0);
    if (!lines.length) lines = [{ label: 'No check-ups this time — try again!', amount: 0 }];
    const total = lines.reduce((s, l) => s + l.amount, 0);
    this.stats.checkups = (this.stats.checkups ?? 0) + count;
    this.stats.lollipops += total;
    this.progress.add('checkups', count);
    const before = this.rankIndex, xp = 15 + score * 3;
    this.xp += xp;
    this.queue.push({ kind: 'saved', title: 'FRENZY COMPLETE', name: `⚡ ${score} pts`, condition: record && score > 0 ? '🏆 New record!' : `Best: ${best} pts`, lines, total, xp, streak: 0 });
    if (this.rankIndex > before) this.queue.push({ kind: 'rank', rank: RANKS[this.rankIndex] });
    this.pump();
  }

  /** A stethoscope check-up on a kid out playing: a small reward and a side notification. */
  checkup(name, result) {
    this.stats.checkups = (this.stats.checkups ?? 0) + 1;
    this.progress.add('checkups', 1);
    this.stats.lollipops += 1;
    const before = this.rankIndex;
    this.xp += 8;
    this.onLollipop(1);
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `<b>🩺 Check-up · ${name}</b><span>${result}</span><em>+1 🍭 · +8 XP</em>`;
    $('feed').prepend(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
    sfx.pickup();
    this.renderRank(true);
    if (this.rankIndex > before) { this.queue.push({ kind: 'rank', rank: RANKS[this.rankIndex] }); this.pump(); }
  }

  /* ---------------- 11. stats screen ---------------- */
  renderStats(totalMissions, shiftSeconds) {
    const s = this.stats;
    const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const r = RANKS[this.rankIndex];
    const cells = [
      ['🧒', 'Kids saved', `${s.saved}/${totalMissions}`],
      ['🍭', 'Lollipops earned', s.lollipops],
      ['⏱️', 'Shift time', mmss(shiftSeconds)],
      ['⚡', 'Fastest rescue', s.fastest === null ? '—' : `${s.fastest.toFixed(1)} s`],
      ['🎯', 'Perfect treatments', s.perfect],
      ['🔥', 'Best perfect streak', s.bestStreak],
      ['🚶', 'Distance on foot', `${Math.round(s.walked)} m`],
      ['🚑', 'Distance driven', `${Math.round(s.driven)} m`],
      ['🏥', 'Ambulance deliveries', s.byAmbulance],
      ['🩺', 'Stethoscope check-ups', s.checkups ?? 0],
      ['🚑💨', 'Stunt jumps', s.stunts ?? 0],
    ];
    $('end-rank').innerHTML = `<span class="er-icon">${r.icon}</span><span><small>Final rank</small><b>${r.name}</b><em>${this.xp} XP</em></span>`;
    $('end-stats').innerHTML = cells.map(([i, l, v]) => `<div class="st"><span class="st-i">${i}</span><span class="st-l">${l}</span><b class="st-v">${v}</b></div>`).join('')
      + (s.fastestName ? `<div class="st-note">Fastest: ${s.fastestName}</div>` : '');
  }
}

function bumpCounter() {
  const el = $('lollipops');
  el.parentElement.classList.remove('bump');
  void el.offsetWidth;
  el.parentElement.classList.add('bump');
}

/** GTA-style "achievement unlocked" pop-up at the top of the screen (queued). */
const achQueue = [];
let achBusy = false;
export function achievementToast(a) {
  achQueue.push(a);
  if (achBusy) return;
  const next = () => {
    const item = achQueue.shift();
    if (!item) { achBusy = false; return; }
    achBusy = true;
    const el = $('achievement');
    el.innerHTML = `<span class="ach-icon">${item.icon}</span><span><small>🏆 ACHIEVEMENT UNLOCKED</small><b>${item.name}</b><em>${item.desc}</em></span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    sfx.achievement();
    setTimeout(() => { el.classList.remove('show'); setTimeout(next, 500); }, 3200);
  };
  next();
}
