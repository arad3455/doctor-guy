// How the game talks to you, in three tiers that share one look (white Anton title over the scene, no boxes):
//   headline(): the big moments (new emergency, outbreak, race start/finish, Gorge). A kicker line, a big title
//               and a sub line high up in the middle, queued so two never overlap.
//   notify():   everything small (+lollipops, hints, radio station). A slim glass card in the side feed that slides
//               in and out without covering the action.
//   timers:     see icons.js timerHTML(): one chip style for every countdown, stacked under the top bar.
import { icon, iconize } from './icons.js';

const $ = (id) => document.getElementById(id);
export const notices = []; // recent texts (tests and debugging read these)
const remember = (s) => { notices.push(String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); if (notices.length > 30) notices.shift(); };

const queue = [];
/** Set by the career: headlines wait while a PATIENT SAVED / PROMOTED banner is on screen. */
export const gate = { busy: () => false };
let showing = null, timer = null;

/**
 * kicker: small spaced caps line ("NEW EMERGENCY"), title: the big line, sub: one line of detail.
 * tone: alert | outbreak | race | success | info | caspi. icon: icon name for the kicker.
 * replace: show now, cutting the current one short (countdowns).
 */
export function headline({ kicker = '', title = '', sub = '', tone = 'info', icon: ic = null, ms = 3200, replace = false }) {
  const item = { kicker, title, sub, tone, ic, ms };
  remember(`${kicker} ${title} ${sub}`);
  if (replace) { queue.length = 0; clearTimeout(timer); show(item); return; }
  if (showing) { if (queue.length < 3) queue.push(item); return; }
  show(item);
}

/** True while a headline is up (the emergency card waits for the PATIENT SAVED banner the same way). */
export const headlineBusy = () => !!showing;

function show(item) {
  const el = $('mission-card');
  showing = item;
  if (gate.busy()) { timer = setTimeout(() => show(item), 400); return; }
  el.className = `tone-${item.tone}`;
  el.innerHTML = `<div class="mc-kicker">${item.ic ? icon(item.ic) : ''}<span>${item.kicker}</span></div><div class="mc-title">${iconize(item.title)}</div>`
    + (item.sub ? `<div class="mc-sub">${iconize(item.sub)}</div>` : '');
  void el.offsetWidth;
  el.classList.add('show');
  timer = setTimeout(() => {
    el.classList.remove('show');
    timer = setTimeout(() => { showing = null; const next = queue.shift(); if (next) show(next); }, 380);
  }, item.ms);
}

/**
 * A side-feed card. text may carry emoji shorthand (turned into line icons) and a <small> second line.
 * tone: the accent bar colour (info | success | alert | outbreak | race | caspi | reward).
 */
export function notify(text, { icon: ic = null, tone = 'info', ms = 2600, sub = '', reward = '' } = {}) {
  remember(`${text} ${sub} ${reward}`);
  const feed = $('feed');
  if (!feed) return;
  const el = document.createElement('div');
  el.className = `feed-item tone-${tone}`;
  el.innerHTML = `${ic ? `<span class="fi-icon">${icon(ic)}</span>` : ''}<span class="fi-body"><b>${iconize(text)}</b>`
    + (sub ? `<span>${iconize(sub)}</span>` : '') + (reward ? `<em>${iconize(reward)}</em>` : '') + '</span>';
  feed.prepend(el);
  while (feed.children.length > 4) feed.lastElementChild.remove();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 500);
}
