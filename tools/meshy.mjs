// Doctor Guy → rigged, animated GLB via the Meshy API.
//
//   MESHY_API_KEY=msy_... node tools/meshy.mjs concept    # reference art → clean full-body A-pose image (review it!)
//   MESHY_API_KEY=msy_... node tools/meshy.mjs model      # concept image → textured 3D model
//   MESHY_API_KEY=msy_... node tools/meshy.mjs rig        # auto-rig + walking/running clips
//   MESHY_API_KEY=msy_... node tools/meshy.mjs animate    # idle / jump / wave clips from the animation library
//   MESHY_API_KEY=msy_... node tools/meshy.mjs all        # model → rig → animate
//
// Task ids are kept in assets/doctor-guy/pipeline.json so each stage resumes instead of paying twice.
// Use --fresh to force a stage to run again, --image <path> to use your own concept image.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const API = 'https://api.meshy.ai/openapi/v1';
const ROOT_DIR = new URL('..', import.meta.url).pathname;
const dotenv = existsSync(join(ROOT_DIR, '.env')) ? readFileSync(join(ROOT_DIR, '.env'), 'utf8') : '';
const KEY = process.env.MESHY_API_KEY ?? dotenv.match(/^MESHY_API_KEY=(.+)$/m)?.[1].trim();
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/doctor-guy');
const STATE = join(OUT, 'pipeline.json');
const REF_DIR = join(process.env.HOME, 'Downloads/Doctor Guy');
const REFS = ['17809053-4942-419E-8A6E-DB22D7AB7EA1.PNG', '4AC941E3-DB40-4BCD-AA95-525C372A80A5.PNG', '73CD1E17-382C-460D-8C1F-101A90691EF4.PNG'];

const DESCRIPTION =
  'Doctor Guy: a cartoon man with bright yellow skin, short brown spiky hair swept up and to the side, thick black ' +
  'rectangular glasses over big round eyes, short brown stubble beard, big friendly toothy smile, blue short-sleeve ' +
  'V-neck medical scrubs, black stethoscope draped around the neck, light-blue lanyard with a white ID badge, blue scrub ' +
  'pants, navy sneakers with white soles. Four fingers on each hand.';

const args = process.argv.slice(2);
const stage = args[0];
const fresh = args.includes('--fresh');
const imageArg = args.includes('--image') ? args[args.indexOf('--image') + 1] : null;

if (!KEY) { console.error('Set MESHY_API_KEY in the environment or in .env (Meshy → Settings → API keys).'); process.exit(1); }
mkdirSync(join(OUT, 'source'), { recursive: true });
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function run(kind, body, key) {
  if (!fresh && state[key]) {
    const t = await api('GET', `/${kind}/${state[key]}`);
    if (t.status === 'SUCCEEDED') { console.log(`✓ ${key}: reusing task ${t.id}`); return t; }
    if (['PENDING', 'IN_PROGRESS'].includes(t.status)) return poll(kind, t.id, key);
  }
  const { result: id } = await api('POST', `/${kind}`, body);
  state[key] = id;
  save();
  return poll(kind, id, key);
}

async function poll(kind, id, label) {
  for (;;) {
    const t = await api('GET', `/${kind}/${id}`);
    process.stdout.write(`\r… ${label}: ${t.status} ${t.progress ?? 0}%   `);
    if (t.status === 'SUCCEEDED') { console.log(`\n✓ ${label} done (${t.consumed_credits ?? '?'} credits)`); return t; }
    if (['FAILED', 'CANCELED'].includes(t.status)) throw new Error(`\n${label} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${file}: ${res.status}`);
  writeFileSync(join(OUT, file), Buffer.from(await res.arrayBuffer()));
  console.log(`  saved assets/doctor-guy/${file}`);
}

/** Shrinks an image to ≤1024px JPEG (macOS sips) and returns a data URI. */
function dataUri(path) {
  const tmp = join(OUT, 'source', `_upload_${Date.now()}.jpg`);
  execFileSync('sips', ['-Z', '1024', '-s', 'format', 'jpeg', path, '--out', tmp], { stdio: 'ignore' });
  const uri = `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
  execFileSync('rm', [tmp]);
  return uri;
}

function writeManifest(extra = {}) {
  const file = join(OUT, 'manifest.json');
  const m = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { model: 'doctor-guy.glb', clips: {} };
  m.model = 'doctor-guy.glb';
  Object.assign(m.clips, extra);
  writeFileSync(file, JSON.stringify(m, null, 2));
}

async function concept() {
  const t = await run('image-to-image', {
    ai_model: 'nano-banana-pro',
    reference_image_urls: REFS.map((f) => dataUri(join(REF_DIR, f))),
    prompt:
      `Character model sheet of the man in blue scrubs from these images. ${DESCRIPTION} ` +
      'Full body from head to shoes, standing in an A-pose (arms straight, held slightly away from the body, legs slightly apart), ' +
      'facing the camera, front view, centred, plain white background, flat even lighting, same cartoon style. ' +
      'Only this one character: no children, no animals, no props in his hands, no text, no scenery.',
    aspect_ratio: '3:4',
  }, 'concept');
  await download(t.image_urls[0], 'source/concept.png');
  console.log('\nReview assets/doctor-guy/source/concept.png, then run the "model" stage.');
}

async function model() {
  const image = imageArg ?? join(OUT, 'source/concept.png');
  if (!existsSync(image)) throw new Error(`No concept image at ${image}. Run "concept" first or pass --image.`);
  const t = await run('image-to-3d', {
    image_url: dataUri(image),
    ai_model: 'latest',
    pose_mode: 'a-pose',
    should_texture: true,
    texture_prompt: DESCRIPTION,
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 30000,
    target_formats: ['glb'],
  }, 'model');
  await download(t.model_urls.glb, 'source/textured.glb');
}

const modelFileArg = args.includes('--model-file') ? args[args.indexOf('--model-file') + 1] : null;

/** Downloads a clip GLB and strips it to skeleton + animation (the mesh is already in doctor-guy.glb). */
async function downloadClip(url, name) {
  await download(url, `source/${name}.glb`);
  mkdirSync(join(OUT, 'anims'), { recursive: true });
  execFileSync('node', [join(ROOT, 'tools/glb-tools.mjs'), 'anim', join(OUT, `source/${name}.glb`), join(OUT, `anims/${name}.glb`)], { stdio: 'inherit' });
  return `anims/${name}.glb`;
}

async function rig() {
  let body;
  if (modelFileArg) {
    const buf = readFileSync(modelFileArg);
    body = { model_url: `data:model/gltf-binary;base64,${buf.toString('base64')}`, height_meters: 1.8 };
  } else if (state.model) {
    body = { input_task_id: state.model, height_meters: 1.8 };
  } else throw new Error('Run the "model" stage first, or pass --model-file <textured.glb>.');
  const t = await run('rigging', body, 'rig');
  const r = t.result;
  await download(r.rigged_character_glb_url, 'source/rigged.glb');
  execFileSync('node', [join(ROOT, 'tools/glb-tools.mjs'), 'model', join(OUT, 'source/rigged.glb'), join(OUT, 'doctor-guy.glb')], { stdio: 'inherit' });
  const clips = {};
  if (r.basic_animations?.walking_glb_url) clips.walk = await downloadClip(r.basic_animations.walking_glb_url, 'walk');
  if (r.basic_animations?.running_glb_url) clips.run = await downloadClip(r.basic_animations.running_glb_url, 'run');
  writeManifest(clips);
}

// Game clip name → Meshy animation-library action_id (searched with tools/meshy-probe.mjs)
const ACTIONS = {
  idle: 0, // Idle
  jump: 13, // Jump Run
  kneel: 365, // Kneel on One Knee and Stand
  pickup: 276, // Male Bend Over Pick Up
  cheer: 59, // Victory Cheer
  wave: 28, // Big Wave Hello
};

async function animate() {
  if (!state.rig) throw new Error('Run the "rig" stage first.');
  const clips = {};
  for (const [name, action_id] of Object.entries(ACTIONS)) {
    const t = await run('animations', { rig_task_id: state.rig, action_id }, `anim_${name}`);
    clips[name] = await downloadClip(t.result.animation_glb_url, name);
  }
  writeManifest(clips);
}

const stages = { concept, model, rig, animate, all: async () => { await model(); await rig(); await animate(); } };
if (!stages[stage]) { console.error(`Usage: node tools/meshy.mjs <${Object.keys(stages).join('|')}> [--fresh] [--image path]`); process.exit(1); }
await stages[stage]();
