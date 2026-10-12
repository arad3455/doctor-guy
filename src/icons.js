// The HUD's one icon set: simple 24px line icons drawn in currentColor, so every chip, button and banner speaks the
// same visual language. Game text may still carry an emoji as a shorthand ('🩺 Check-up'), and iconize() turns
// it into the matching line icon. Emoji with no icon are dropped from HUD chrome. Speech bubbles and the
// treatment steps are the cartoon world itself, so they keep their emoji.
const P = {
  lollipop: '<circle cx="12" cy="8.8" r="6.3" fill="currentColor" fill-opacity=".2"/><path d="M12 15.1v7"/><path d="M12 8.8a1.6 1.6 0 1 1 1.6 1.6 3.6 3.6 0 0 1-3.6-3.6 5 5 0 0 1 5-5"/>',
  patient: '<circle cx="12" cy="7.5" r="3.8"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/><path d="M12 13.5v3.5M10.2 15.2h3.6"/>',
  cross: '<path d="M9 3.5h6v5.5h5.5v6H15v5.5H9V15H3.5V9H9z"/>',
  hospital: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z"/>',
  camera: '<path d="M3.5 8h3.2l2-3h6.6l2 3h3.2v11.5h-17z"/><circle cx="12" cy="13.3" r="3.6"/>',
  radio: '<rect x="3" y="8" width="18" height="12.5" rx="2.5"/><path d="m7 8 9.5-4.5"/><circle cx="15.5" cy="14.2" r="3"/><path d="M6.5 12.5h3.5M6.5 16h3.5"/>',
  jump: '<path d="m6 13 6-6 6 6"/><path d="m6 19 6-6 6 6"/>',
  steth: '<path d="M5 3.5v5a5 5 0 0 0 10 0v-5"/><path d="M10 13.5v2.5a4 4 0 0 0 8 0v-3"/><circle cx="18" cy="11" r="2.2"/>',
  bolt: '<path d="M13.5 2.5 4.5 14h7l-1 7.5 9-11.5h-7z"/>',
  pill: '<path d="M10.6 20.1a4.5 4.5 0 0 1-6.4-6.4l9.4-9.4a4.5 4.5 0 0 1 6.4 6.4z"/><path d="m8.9 9 6.1 6.1"/>',
  flag: '<path d="M5 21V3.5"/><path d="M5 4h13l-2.5 4.2L18 12.5H5"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 10.5h16M7.5 21v-3M16.5 21v-3"/><circle cx="8" cy="14.3" r=".9"/><circle cx="16" cy="14.3" r=".9"/>',
  bag: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  ambulance: '<path d="M2.5 17V6.5h11V17"/><path d="M13.5 9.5h4l4 4.5V17h-1.5"/><path d="M2.5 17h1.5M9 17h6"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8 9v4.5M5.8 11.2h4.4"/>',
  siren: '<path d="M6 18v-5a6 6 0 0 1 12 0v5"/><path d="M4 21h16v-3H4z"/><path d="M12 2.5v2M4 6l1.5 1.5M20 6l-1.5 1.5"/>',
  door: '<path d="M5 21V3.5h10V21"/><path d="M15 5.5h4V21"/><path d="M3 21h18"/><circle cx="12" cy="12.5" r=".9"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  trophy: '<path d="M8 3.5h8v6a4 4 0 0 1-8 0z"/><path d="M8 5.5H4.8a3.2 3.2 0 0 0 3.4 4.4M16 5.5h3.2a3.2 3.2 0 0 1-3.4 4.4M12 13.5v3.5M8 20.5h8M9.5 17h5"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.6 10.6 6 3h4l2 4.8L14 3h4l-2.6 7.6"/>',
  virus: '<circle cx="12" cy="12" r="5"/><path d="M12 2.5V7M12 17v4.5M2.5 12H7M17 12h4.5M5.3 5.3l3.2 3.2M15.5 15.5l3.2 3.2M18.7 5.3l-3.2 3.2M8.5 15.5l-3.2 3.2"/><circle cx="10.5" cy="11" r=".8"/><circle cx="13.5" cy="13.2" r=".8"/>',
  paw: '<circle cx="6.5" cy="10.5" r="1.9"/><circle cx="10" cy="6" r="1.9"/><circle cx="14.5" cy="6" r="1.9"/><circle cx="18" cy="10.5" r="1.9"/><path d="M7.5 17.5c0-3.2 2.2-5.5 4.7-5.5s4.8 2.3 4.8 5.5c0 2-2 3.2-4.7 2.2-2.6 1-4.8-.2-4.8-2.2z"/>',
  chat: '<path d="M4 4.5h16v11H10l-6 4.5z"/><path d="M8.5 10h.01M12 10h.01M15.5 10h.01"/>',
  sparkle: '<path d="M12 2.5c.7 5 2.5 6.8 7.5 7.5-5 .7-6.8 2.5-7.5 7.5-.7-5-2.5-6.8-7.5-7.5 5-.7 6.8-2.5 7.5-7.5z"/><path d="M19 16.5v4M17 18.5h4"/>',
  flame: '<path d="M12 21.5a7 7 0 0 0 7-7c0-5.2-5-6.5-5-12-3 2-4.2 5-3.6 8.2C9 9.6 8.2 8.3 8 6.8 6 8.8 5 11.3 5 14.5a7 7 0 0 0 7 7z"/>',
  map: '<path d="m3 6.5 6-2.5 6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  pin: '<path d="M12 21.5s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 1.8M9.5 2.5h5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0c0 1.2-1 1.6-1.5 2.5"/>',
  hand: '<path d="M8 12.5V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 9.5a1.5 1.5 0 0 1 3 0V14a7.5 7.5 0 0 1-13 5l-3.2-4.2a1.6 1.6 0 0 1 2.5-2L8 14.5"/>',
  heart: '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 6.8a4.5 4.5 0 0 1 8 2.7C20 15.2 12 20 12 20z"/>',
  bandage: '<rect x="2.6" y="8.2" width="18.8" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/><path d="M10.4 10.4h.01M13.6 13.6h.01M10.4 13.6h.01M13.6 10.4h.01"/>',
  stop: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M12 8v5M12 16h.01"/>',
  go: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="m9.5 21 2.5-6.5 3 3V21M8 12l2.5-4.5h3.5l2.5 4 2.5 1M12 14.5l1-7"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  tree: '<path d="M12 21.5V15"/><path d="M12 2.5 5.5 11h3L5 15.5h14L15.5 11h3z"/>',
  umbrella: '<path d="M3 11.5a9 9 0 0 1 18 0z"/><path d="M12 11.5V19a2 2 0 0 1-4 0"/><path d="M12 2.5v.5"/>',
  building: '<path d="M4.5 21V4.5h9V21M13.5 9h6V21M2.5 21h19"/><path d="M7.5 8h3M7.5 12h3M7.5 16h3M16 13h1M16 17h1"/>',
  house: '<path d="m3 11 9-7.5 9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M10 21v-6h4v6"/>',
  wheel: '<circle cx="12" cy="10" r="7"/><circle cx="12" cy="10" r="1.5"/><path d="M12 3v14M5 10h14M7 5l10 10M17 5 7 15"/><path d="m8 21.5 4-5 4 5"/>',
  tent: '<path d="M12 3.5 2.5 20.5h19z"/><path d="m12 11-3.5 9.5M12 11l3.5 9.5"/>',
  anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M8 11h8"/><path d="M4.5 13.5a7.5 7.5 0 0 0 15 0"/>',
  plane: '<path d="M21 15.5v-2l-7.5-4.5V4a1.5 1.5 0 0 0-3 0v5L3 13.5v2l7.5-2.5v4.5l-2 1.5V21l3.5-1 3.5 1v-2l-2-1.5V13z"/>',
  steer: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.4"/><path d="M3.3 10.5c3 .9 5.3 1.2 6.4 1.3M20.7 10.5c-3 .9-5.3 1.2-6.4 1.3M12 14.4V21"/>',
  monkey: '<circle cx="12" cy="12" r="6.5"/><circle cx="4.5" cy="11" r="2"/><circle cx="19.5" cy="11" r="2"/><path d="M9 15c1.8 1.4 4.2 1.4 6 0M9.8 10.5h.01M14.2 10.5h.01"/>',
};

/** An inline SVG icon. */
export function icon(name, cls = '') {
  const p = P[name];
  if (!p) return '';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

// emoji shorthand → icon (medals get a coloured medal)
const EMOJI = {
  '🍭': 'lollipop', '🩺': 'steth', '⚡': 'bolt', '💊': 'pill', '🏁': 'flag', '🚌': 'bus', '🛍️': 'bag', '🛍': 'bag', '🏥': 'hospital',
  '🚑': 'ambulance', '🚨': 'siren', '🚪': 'door', '⭐': 'star', '🏆': 'trophy', '🤒': 'virus', '🤧': 'virus', '🐱': 'paw', '😎': 'chat',
  '📻': 'radio', '📷': 'camera', '✨': 'sparkle', '🔥': 'flame', '🗺️': 'map', '🗺': 'map', '☀️': 'sun', '🌙': 'moon', '⛑️': 'cross',
  '👂': 'ear', '🐒': 'monkey', '🛑': 'stop', '🚦': 'go', '⏱️': 'clock', '🩹': 'bandage', '✋': 'hand', '❤️': 'heart', '🧒': 'patient', '🎯': 'target', '🚶': 'walk',
};
const MEDALS = { '🥇': 'gold', '🥈': 'silver', '🥉': 'bronze' };
const EMOJI_RE = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;

/** Turn emoji shorthand in HUD text into line icons; drop any emoji the set doesn't cover. */
export function iconize(html) {
  return String(html).replace(EMOJI_RE, (e) => {
    if (MEDALS[e]) return icon('medal', `medal-${MEDALS[e]}`);
    const name = EMOJI[e] ?? EMOJI[e.replace(/️/g, '')];
    return name ? icon(name) : '';
  }).replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
}

/** The icon a label leads with (for the touch action button), if any. */
export function leadIcon(label) {
  const m = String(label ?? '').trim().match(EMOJI_RE);
  if (!m || String(label).trim().indexOf(m[0]) !== 0) return null;
  return EMOJI[m[0]] ?? EMOJI[m[0].replace(/️/g, '')] ?? null;
}

// radar / big-map blips: emoji shorthand → icon + disc colour
const BLIPS = {
  '🏥': ['hospital', '#e0323a'], '🏖️': ['umbrella', '#ef9a2a'], '🦁': ['paw', '#a8692c'], '🌳': ['tree', '#3f9a3a'], '🏙️': ['building', '#5560c8'],
  '🏡': ['house', '#d9774a'], '🎡': ['wheel', '#e04f8f'], '🏕️': ['tent', '#2e7d4f'], '⚓': ['anchor', '#2f7fc1'], '✈️': ['plane', '#3a9ad9'],
  '😎': ['chat', '#8a63d2'], '🐱': ['paw', '#8a63d2'], '🤒': ['virus', '#6aa82e'], '🏁': ['flag', '#1b1b2e'], '🚪': ['door', '#4a4a5a'], '🚑': ['ambulance', '#2f7fc1'],
  '🚌': ['bus', '#2f7fc1'], '⚡': ['bolt', '#ff3c8e'],
};
const pathCache = {};
/** The parts of an icon as canvas Path2Ds (24-unit space). */
function iconPaths(name) {
  if (pathCache[name]) return pathCache[name];
  const out = [];
  for (const m of (P[name] ?? '').matchAll(/<(path|circle|rect)([^>]*)\/>/g)) {
    const a = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    const p = new Path2D();
    if (m[1] === 'path') p.addPath(new Path2D(a.d));
    else if (m[1] === 'circle') p.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
    else p.roundRect(+a.x, +a.y, +a.width, +a.height, +(a.rx ?? 0));
    const rot = a.transform?.match(/rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/);
    out.push({ p, fill: a.fill === 'currentColor', rot: rot ? rot.slice(1).map(Number) : null });
  }
  return (pathCache[name] = out);
}

/** Draw a line icon on a canvas, centred at x, y, size px tall. */
export function drawIcon(ctx, name, x, y, size, color = '#fff') {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const { p, fill, rot } of iconPaths(name)) {
    ctx.save();
    if (rot) { ctx.translate(rot[1], rot[2]); ctx.rotate((rot[0] * Math.PI) / 180); ctx.translate(-rot[1], -rot[2]); }
    if (fill) { ctx.globalAlpha *= 0.3; ctx.fill(p); ctx.globalAlpha /= 0.3; }
    ctx.stroke(p);
    ctx.restore();
  }
  ctx.restore();
}

/** A radar blip: a coloured disc with a white ring and the icon. Returns false for an unknown emoji. */
export function drawBlip(ctx, emoji, x, y, r) {
  const b = BLIPS[emoji] ?? BLIPS[emoji + '\uFE0F'] ?? BLIPS[String(emoji).replace(/\uFE0F/g, '')];
  if (!b) return false;
  ctx.save();
  ctx.fillStyle = b[1]; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  drawIcon(ctx, b[0], x, y, r * 1.2, '#fff');
  return true;
}

/** Fill every <… data-icon="name"> in the page. */
export function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon) + (el.dataset.label ? `<span>${el.dataset.label}</span>` : '');
}

/** The shield badge of a rank (0 = Volunteer … 5): a shield with one chevron per rank above Volunteer. */
export function rankBadge(i, cls = '') {
  const chev = Array.from({ length: Math.min(3, i) }, (_, k) => `<path d="m8.5 ${14.5 - k * 3.2} 3.5-2.4 3.5 2.4"/>`).join('');
  const star = i >= 4 ? '<path d="m12 6.2.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z" fill="currentColor"/>' : '';
  const dot = i === 0 ? '<path d="M12 10v5M9.5 12.5h5"/>' : '';
  return `<svg class="ic rank-badge ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 4.5 5.3v6c0 4.8 3.2 8.5 7.5 10.2 4.3-1.7 7.5-5.4 7.5-10.2v-6z"/>${chev}${star}${dot}</svg>`;
}

/** The shared timer chip (frenzy, race, outbreak): icon + title on top, a big clock, one stats line, an optional badge. */
export function timerHTML({ icon: name, title, time, hurry = false, sub = '', badge = '', badgeOn = false }) {
  return `<span class="tm-head">${icon(name)}<span class="tm-title">${title}</span></span><span class="tm-time ${hurry ? 'hurry' : ''}">${time}</span>`
    + `<span class="tm-sub">${iconize(sub)}</span><span class="tm-badge ${badgeOn ? 'on' : ''}">${iconize(badge)}</span>`;
}
