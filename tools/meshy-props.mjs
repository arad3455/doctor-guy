// Static props (vehicles, objects) → web-ready GLBs via the Meshy API.
//
//   node tools/meshy-props.mjs concept <id>   text → reference image (review it!)  assets/props/source/<id>-concept.png
//   node tools/meshy-props.mjs model <id>     image → textured, remeshed 3D model → assets/props/<id>.glb (compressed)
//
// Task ids live in assets/props/source/pipeline.json so stages resume instead of paying twice (--fresh to redo).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/props');
const SRC = join(OUT, 'source');
const STATE = join(SRC, 'pipeline.json');
const API = 'https://api.meshy.ai/openapi/v1';
const dotenv = existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '';
const KEY = process.env.MESHY_API_KEY ?? dotenv.match(/^MESHY_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) { console.error('Set MESHY_API_KEY in .env'); process.exit(1); }

export const PROPS = {
  ambulance: {
    polycount: 16000,
    prompt:
      'A modern emergency ambulance van, realistic proportions with a clean, slightly stylised game-art look. ' +
      'White box-body ambulance on a van chassis, bright red and white reflective stripes along the sides, ' +
      'a red cross symbol on the side and on the back doors, the word AMBULANCE on the front, ' +
      'red and blue emergency light bar on the roof, black wheels with silver hubs, tinted windows, headlights. ' +
      'Three-quarter front view from slightly above, the whole vehicle visible, centred, ' +
      'plain white background, soft even lighting, no people, no road, no shadows, no other objects.',
    texture: 'White ambulance van with red stripes, red cross symbols, red and blue roof lights, black tyres, dark tinted windows.',
  },
};

const args = process.argv.slice(2);
const [stage, id] = args;
const fresh = args.includes('--fresh');
mkdirSync(SRC, { recursive: true });
const readState = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {});
const setState = (k, v) => writeFileSync(STATE, JSON.stringify({ ...readState(), [k]: v }, null, 2));

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
  const prev = readState()[key];
  if (!fresh && prev) {
    const t = await api('GET', `/${kind}/${prev}`);
    if (t.status === 'SUCCEEDED') { console.log(`✓ ${key}: reusing task ${t.id}`); return t; }
  }
  const { result } = await api('POST', `/${kind}`, body);
  setState(key, result);
  for (;;) {
    const t = await api('GET', `/${kind}/${result}`);
    if (t.status === 'SUCCEEDED') { console.log(`✓ ${key} (${t.consumed_credits ?? '?'} credits)`); return t; }
    if (['FAILED', 'CANCELED'].includes(t.status)) throw new Error(`${key} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${file}: ${res.status}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}
const glbTool = (...a) => execFileSync('node', [join(ROOT, 'tools/glb-tools.mjs'), ...a], { stdio: 'inherit' });

const prop = PROPS[id];
if (!prop) { console.error(`prop id: ${Object.keys(PROPS).join(', ')}`); process.exit(1); }

if (stage === 'concept') {
  const t = await run('text-to-image', { ai_model: 'nano-banana-pro', prompt: prop.prompt, aspect_ratio: '4:3' }, `${id}.concept`);
  await download(t.image_urls[0], join(SRC, `${id}-concept.png`));
  console.log(`  review assets/props/source/${id}-concept.png`);
} else if (stage === 'model') {
  const img = join(SRC, `${id}-concept.png`);
  const tmp = join(SRC, `_upload_${process.pid}.jpg`);
  execFileSync('sips', ['-Z', '1024', '-s', 'format', 'jpeg', img, '--out', tmp], { stdio: 'ignore' });
  const t = await run('image-to-3d', {
    image_url: `data:image/jpeg;base64,${readFileSync(tmp).toString('base64')}`,
    ai_model: 'latest',
    should_texture: true,
    texture_prompt: prop.texture,
    should_remesh: true,
    topology: 'triangle',
    target_polycount: prop.polycount,
    target_formats: ['glb'],
  }, `${id}.model`);
  execFileSync('rm', [tmp]);
  await download(t.model_urls.glb, join(SRC, `${id}-textured.glb`));
  glbTool('model', join(SRC, `${id}-textured.glb`), join(OUT, `${id}.glb`), '2048');
  glbTool('compress', join(OUT, `${id}.glb`), join(OUT, `${id}.glb`));
} else {
  console.error('usage: node tools/meshy-props.mjs <concept|model> <id> [--fresh]');
  process.exit(1);
}
