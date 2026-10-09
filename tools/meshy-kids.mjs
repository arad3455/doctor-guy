// The kids (and Noa's mom) → rigged GLBs via the Meshy API. All kids share one animation set:
// Meshy rigs use the same bone names, so clips made on the "template" kid play on every kid.
//
//   node tools/meshy-kids.mjs concept <id>   reference art → clean A-pose image (review it!)
//   node tools/meshy-kids.mjs model <id>     concept → small textured 3D model
//   node tools/meshy-kids.mjs rig <id>       auto-rig → assets/kids/<id>.glb (+ walk/run clips for the template)
//   node tools/meshy-kids.mjs animate        shared clips on the template kid → assets/kids/anims/
//   node tools/meshy-kids.mjs all <id>       concept → model → rig (stops after concept if --review)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/kids');
const SRC = join(OUT, 'source');
const REFS = join(ROOT, 'assets/doctor-guy/source/refs');
const STATE = join(SRC, 'pipeline.json');
const API = 'https://api.meshy.ai/openapi/v1';
const dotenv = existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '';
const KEY = process.env.MESHY_API_KEY ?? dotenv.match(/^MESHY_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) { console.error('Set MESHY_API_KEY in .env'); process.exit(1); }

const STYLE =
  'Same cartoon art style as the reference images: bright yellow skin, big round white eyes with small black pupils, ' +
  'simple rounded features, black outlines. An original character, not from any TV show.';
export const KIDS = {
  bandageBoy: { height: 1.2, desc: 'A cheerful boy about 8 years old with short curly dark-brown hair and a white bandage wrapped around his head, white t-shirt, blue shorts, blue sneakers.' },
  pinkHat: { height: 1.15, desc: 'A cartoon girl with long brown hair, wearing a wide pink sun hat with a white flower, a long-sleeved purple-pink dress down to the knees, blue sneakers.' },
  teddyToddler: { height: 0.95, desc: 'A short, chubby cartoon character with curly blonde hair, a long-sleeved light-blue dress down to the knees, and blue shoes.' },
  capKid: { height: 1.2, desc: 'A boy about 8 years old with short dark hair under a blue baseball cap, light-blue polo shirt, dark-blue shorts, blue sneakers.' },
  glassesKid: { height: 1.2, desc: 'A boy about 9 years old with curly dark hair and round black glasses, green t-shirt, blue shorts, blue sneakers.' },
  ponytail: { height: 1.15, desc: 'A girl about 7 years old with a brown ponytail tied with a pink scrunchie, a pink dress with white flowers, blue sneakers.' },
  redShirt: { height: 1.2, desc: 'A cartoon boy with curly dark-brown hair, a red t-shirt, knee-length blue shorts, blue sneakers.' },
  gownKid: { height: 1.2, desc: 'A boy about 8 years old with short dark hair wearing a light-blue hospital gown with small dark-blue dots, blue slippers.' },
  mom: { height: 1.7, desc: 'A friendly mother in her thirties with long brown hair, a teal dress, white sneakers.' },
};
const TEMPLATE = 'bandageBoy';
// Shared kid clips (Meshy animation library ids; search with tools/meshy-probe.mjs)
const ACTIONS = { idle: 0, help: 291, swim: 568, sit: 33, cheer: 298, limp: 111 };

const args = process.argv.slice(2);
const [stage, id] = args;
const fresh = args.includes('--fresh');
mkdirSync(SRC, { recursive: true });
mkdirSync(join(OUT, 'anims'), { recursive: true });
// Several kids may run in parallel: always merge into the file on disk instead of overwriting it.
const readState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {});
const state = new Proxy({}, {
  get: (_, key) => readState()[key],
  set: (_, key, value) => { writeFileSync(STATE, JSON.stringify({ ...readState(), [key]: value }, null, 2)); return true; },
});
const save = () => {};

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
  const { result } = await api('POST', `/${kind}`, body);
  state[key] = result;
  save();
  return poll(kind, result, key);
}
async function poll(kind, taskId, label) {
  for (;;) {
    const t = await api('GET', `/${kind}/${taskId}`);
    if (t.status === 'SUCCEEDED') { console.log(`✓ ${label} (${t.consumed_credits ?? '?'} credits)`); return t; }
    if (['FAILED', 'CANCELED'].includes(t.status)) throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${file}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
function dataUri(path) {
  const tmp = join(SRC, `_upload_${process.pid}_${Math.random().toString(36).slice(2)}.jpg`);
  execFileSync('sips', ['-Z', '1024', '-s', 'format', 'jpeg', path, '--out', tmp], { stdio: 'ignore' });
  const uri = `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`;
  execFileSync('rm', [tmp]);
  return uri;
}
const glbTool = (...a) => execFileSync('node', [join(ROOT, 'tools/glb-tools.mjs'), ...a], { stdio: 'inherit' });

function manifest(update) {
  const file = join(OUT, 'manifest.json');
  const m = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { kids: {}, clips: {} };
  update(m);
  writeFileSync(file, JSON.stringify(m, null, 2));
}

async function concept(kid) {
  const k = KIDS[kid];
  const t = await run('image-to-image', {
    ai_model: args.includes('--alt-model') ? 'gpt-image-2' : 'nano-banana-pro',
    // --style-ref: use our own clean kid concept instead of the original scene art (avoids provider refusals)
    reference_image_urls: args.includes('--style-ref')
      ? [dataUri(join(SRC, `${TEMPLATE}-concept.png`))]
      : ['hospital.png', 'zoo.png', 'park.png'].map((f) => dataUri(join(REFS, f))),
    prompt:
      `Character model sheet of a different character drawn in exactly the same style as the reference. ${k.desc} ${STYLE} ` +
      'Full body from head to shoes, standing in an A-pose (arms straight, held slightly away from the body, legs slightly apart), ' +
      'facing the camera, front view, centred, plain white background, flat even lighting. ' +
      'Only this one character: no other people, no doctor, no text, no scenery, no shadows.',
    aspect_ratio: '3:4',
  }, `${kid}.concept`);
  await download(t.image_urls[0], join(SRC, `${kid}-concept.png`));
  console.log(`  review assets/kids/source/${kid}-concept.png`);
}

async function model(kid) {
  const k = KIDS[kid];
  const t = await run('image-to-3d', {
    image_url: dataUri(join(SRC, `${kid}-concept.png`)),
    ai_model: 'latest',
    pose_mode: 'a-pose',
    should_texture: true,
    // --no-texture-prompt: texture from the image alone (some descriptions trip the provider's safety check)
    ...(args.includes('--no-texture-prompt') ? {} : { texture_prompt: `${k.desc.replace(/,? ?(about )?\d+ years old/g, '')} ${STYLE}` }),
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 8000,
    target_formats: ['glb'],
  }, `${kid}.model`);
  await download(t.model_urls.glb, join(SRC, `${kid}-textured.glb`));
}

async function rig(kid) {
  if (!state[`${kid}.model`]) throw new Error(`run "model ${kid}" first`);
  const t = await run('rigging', { input_task_id: state[`${kid}.model`], height_meters: KIDS[kid].height }, `${kid}.rig`);
  const r = t.result;
  await download(r.rigged_character_glb_url, join(SRC, `${kid}-rigged.glb`));
  glbTool('model', join(SRC, `${kid}-rigged.glb`), join(OUT, `${kid}.glb`), '1024');
  manifest((m) => { m.kids[kid] = `${kid}.glb`; });
  if (kid === TEMPLATE) {
    const clips = {};
    for (const [name, url] of [['walk', r.basic_animations?.walking_glb_url], ['run', r.basic_animations?.running_glb_url]]) {
      if (!url) continue;
      await download(url, join(SRC, `anim-${name}.glb`));
      glbTool('anim', join(SRC, `anim-${name}.glb`), join(OUT, `anims/${name}.glb`));
      clips[name] = `anims/${name}.glb`;
    }
    manifest((m) => Object.assign(m.clips, clips));
  }
}

async function animate() {
  const rigTask = state[`${TEMPLATE}.rig`];
  if (!rigTask) throw new Error(`rig the template kid (${TEMPLATE}) first`);
  const clips = {};
  for (const [name, action_id] of Object.entries(ACTIONS)) {
    const t = await run('animations', { rig_task_id: rigTask, action_id }, `anim.${name}`);
    await download(t.result.animation_glb_url, join(SRC, `anim-${name}.glb`));
    glbTool('anim', join(SRC, `anim-${name}.glb`), join(OUT, `anims/${name}.glb`));
    clips[name] = `anims/${name}.glb`;
  }
  manifest((m) => Object.assign(m.clips, clips));
}

const needsKid = ['concept', 'model', 'rig', 'all'];
if (needsKid.includes(stage) && !KIDS[id]) { console.error(`kid id: ${Object.keys(KIDS).join(', ')}`); process.exit(1); }
const stages = {
  concept: () => concept(id),
  model: () => model(id),
  rig: () => rig(id),
  animate,
  all: async () => { await concept(id); if (args.includes('--review')) return; await model(id); await rig(id); },
};
if (!stages[stage]) { console.error(`usage: node tools/meshy-kids.mjs <${Object.keys(stages).join('|')}> [id]`); process.exit(1); }
await stages[stage]();
