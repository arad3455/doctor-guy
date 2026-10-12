# Doctor Guy UI design system

## Two layers

| Layer | Used for | Look |
|---|---|---|
| **HUD** (over the game) | stats, rank, mission list, prompt, radar extras, feed, timers, achievement, touch buttons | dark glass (`--glass`), 1.5px light border, white text, line icons, one accent colour per tone |
| **Cards** (menus that pause play) | shop, bus, trophies, help, mini-game | paper (`--paper`) with an ink border, ink header with a yellow underline |

The full-screen moments (PATIENT SAVED, PROMOTED, STUNT JUMP, shift report) keep the GTA gradient-title treatment.

## Messages: three tiers, one voice

| Tier | API | When | Look |
|---|---|---|---|
| Headline | `headline({ kicker, title, sub, tone, icon })` (src/notify.js) | big moments: new emergency, flu outbreak, time trial start/finish, Gorge missing/home, monkey chase | no box: coloured kicker line with an icon, big white Anton title, one sub line. Queued so two never overlap, and held while a big banner is up |
| Feed | `notify(text, { icon, tone, sub, reward })` | everything small: check-ups, golden bandages, radio station, hints, "Stop first!" | glass card in the side feed with a tone bar and an icon dot. At most 4 at once |
| Timer | `timerHTML({ icon, title, time, sub, badge })` (src/icons.js) | frenzy, race and outbreak countdowns | one chip style with a tone stripe on top. Chips sit side by side at the top centre; the headline moves down while one is up |

`hud.toast()` still works and goes to the feed. The old yellow bordered toast is gone.

## Tones

`alert` red (emergencies, warnings) · `outbreak` lime · `race` yellow · `frenzy` pink · `success` green · `info` sky · `caspi` lavender · `reward` yellow.
Each is a `.tone-*` class that sets `--tone`.

## Icons

- **Set:** `src/icons.js` holds the one icon set: 24px line icons in `currentColor`.
- **Static HTML:** uses `data-icon="name"`, filled by `hydrateIcons()`.
- **Emoji in text:** text may keep an emoji as shorthand (`'🩺 Check-up: Noa'`). `iconize()` turns it into the matching icon on the HUD and drops any emoji the set doesn't cover. Medal emoji become coloured medals.
- **Ranks:** rank badges are shields with chevrons (`rankBadge(i)`).
- **Touch action button:** shows what E would do (ambulance, check-up, bag, bus…), with a medical cross as the default. While driving, it shows a door and the jump button shows a siren.

**Where emoji stay on purpose:** the cartoon world itself. That means speech bubbles, treatment-step pictograms, shop item art and trophy art.

## Touch driving

The joystick hides while you drive. Instead you get:

- **Steering wheel slider (bottom left).** Drag sideways from wherever you touch it; it springs back to centre. Tapping the track off to one side steers that way at once.
- **Gas lever (bottom right).** Push up to accelerate (analog), pull down to brake and then reverse ("R"). It springs back to neutral.
- **Siren and door buttons.** They sit just left of the lever.
- **Camera and radio.** They move up beside the radar.

All of these use the same glass style: green for gas, red for reverse, and yellow while the wheel is held.

## Known gaps / next steps

- Radar and big-map blips (Caspi, outbreak kids, race flags, POIs) are still emoji drawn on the canvas. Next step: draw them from the same icon paths.
- Shop items and trophies use emoji as their art. Rendered thumbnails of the real 3D hats/paints would look far better.
- Treatment-step pictograms in the mini-game are emoji (they read as illustrations; could become drawn icons).
- The ✕ close buttons are text glyphs; fine, but could use `icon('close')`.
