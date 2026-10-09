# Doctor Guy — Zone 1: The Park

A browser 3D open-world rescue game (Three.js, no build step).

## Run
```
npm start            # serves on http://localhost:8765
```
Open http://localhost:8765 in Chrome.

## Controls
WASD move · Shift run · Space jump · E help / pick up / hand over · mouse drag look · wheel zoom

## Structure
- `src/world.js` — park layout, hospital, props, colliders
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
