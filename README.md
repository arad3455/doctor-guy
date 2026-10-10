# Doctor Guy

A browser 3D open-world rescue game (Three.js, no build step). Play it at https://arad3455.github.io/doctor-guy/

## The city
| Zone | Where | What's there |
|---|---|---|
| 🌳 Wolfson Park | the middle | playground, pond, swings, the lollipop stand / Doctor Shop |
| 🏥 Wolfson Medical Center | north of the park | enterable hospital, exam rooms, X-ray room |
| 🏖️ Sunny Beach | south, down the boardwalk | lifeguard tower, sandcastles, floats, jellyfish |
| 🦁 Wolfson City Zoo | east along Zoo Road | lions, elephants, giraffes, penguins, Monkey Island |
| 🏙️ Downtown Wolfson | west along Main Street | 3×3 city blocks, City Plaza (fountain, skate corner, ice cream), Wolfson Hoops, Market Row, rooftop billboard |
| 🏡 Maple Heights | south of Zoo Road, down Maple Lane | houses with gardens (trampolines, pools, a treehouse), Maple Heights Elementary |
| 🎡 Sunset Pier | the bottom of Maple Lane, east of the beach | Ferris wheel, carousel, drop tower, bumper cars, stalls, a pier with a lighthouse |
| 🌲 Pinewood Camp | north, up Pine Road | pine forest, lake with canoes and a dock, waterfall, campsite, ranger station, deer |
| ⚓ Wolfson Harbor | south of Downtown, down Harbor Road | warehouses, container yard with a gantry crane, fish market, cargo ship, jetty and fishing boats |

Stunt ramps, the Check-up Frenzy token, a day/night cycle and 26 achievements are scattered around it all.

## Run
```
npm start            # serves on http://localhost:8765
```
Open http://localhost:8765 in Chrome.

## Controls
WASD move · Shift run · Space jump · E help / pick up / hand over · mouse drag look · wheel zoom

## Structure
- `src/world.js` — park layout, hospital, props, colliders, walkable areas, zone names
- `src/downtown.js`, `src/suburbs.js`, `src/pier.js`, `src/camp.js`, `src/harbor.js` — the newer zones; `src/streets.js` (road grid tiles) and
  `src/cityprops.js` (buildings, lamps, cars, trees, hedges) are shared by them
- `src/characters.js` — procedural Doctor Guy + kids, animation, bubbles
- `src/player.js` — input, third-person controller, camera
- `src/missions.js` — emergencies, ambient kids, lollipops, interactions
- `src/minigame.js` — timing-bar treatment mini-game
- `src/hud.js` — HUD + minimap
- `tools/playtest.mjs` — automated play-through (`npm run playtest`, screenshots in `.shots/`)

## Generated 3D model (Meshy)
The game uses `assets/doctor-guy/doctor-guy.glb` (rigged) when `manifest.json` points to it, and falls back to the
procedural model otherwise. Clip files (`walk.glb`, `run.glb`, `idle.glb`, `jump.glb`, `wave.glb`) are optional.

```
export MESHY_API_KEY=msy_...
node tools/meshy.mjs concept   # reference art → clean A-pose concept (review assets/doctor-guy/source/concept.png)
node tools/meshy.mjs all       # 3D model → auto-rig → animations, writes manifest.json
```
Preview: http://localhost:8765/tools/viewer.html?char=generated&view=full&pose=walk

Current model: Meshy web generation → re-rigged via API (`node tools/meshy.mjs rig --model-file assets/doctor-guy/source/rig-input.glb`)
→ clips via `node tools/meshy.mjs animate` (idle, jump, kneel, pickup, cheer, wave + walk/run from the rig).
Action ids live in `ACTIONS` in tools/meshy.mjs; `node tools/meshy-probe.mjs <search terms>` searches the library for free.

## Third-party assets
Scenery models (trees, plants, rocks, fences, roads, street lights, traffic lights, cars, market stalls, lanterns,
banners, fountains, city buildings, houses) are from [Kenney](https://kenney.nl) — Nature Kit, City Kit (Roads),
City Kit (Commercial), City Kit (Suburban), City Kit (Industrial), Car Kit and Fantasy Town Kit —
released under **CC0 1.0**. Download the packs into `vendor-src/` and run `node tools/pack-kenney.mjs` to rebuild
`assets/kenney/*.glb`. See `assets/kenney/LICENSE.txt`.
