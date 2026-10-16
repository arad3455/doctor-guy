// Static props (vehicles, objects) → web-ready GLBs via the Meshy API.
//
//   node tools/meshy-props.mjs concept <id>   text → reference image (review it!)  assets/props/source/<id>-concept.png
//   node tools/meshy-props.mjs model <id>     image → textured, remeshed 3D model → assets/props/<id>.glb (compressed)
//   node tools/meshy-props.mjs text <id>      text → 3D (preview + textured refine), no concept image needed (showroom cars)
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
const API2 = 'https://api.meshy.ai/openapi/v2'; // (text-to-3d lives on v2)
const dotenv = existsSync(join(ROOT, '.env')) ? readFileSync(join(ROOT, '.env'), 'utf8') : '';
const KEY = process.env.MESHY_API_KEY ?? dotenv.match(/^MESHY_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) { console.error('Set MESHY_API_KEY in .env'); process.exit(1); }

// Ilan's showroom: invented luxury cars (no real brands or logos), realistic and glossy
const CAR = 'Highly detailed realistic 3D model, glossy car paint, chrome details, detailed alloy wheels, tinted glass, headlights and tail lights, no logos, no text, no people.';
export const PROPS = {
  carSuper: { polycount: 30000, text: `A low, wide Italian-style mid-engine supercar with sharp angular wedge styling, scissor-door look, big side air intakes, in bright metallic red. ${CAR}`, texture: 'Bright metallic red supercar, black carbon details, silver alloy wheels, dark tinted windows, red brake calipers.' },
  carGT: { polycount: 30000, text: `A long, elegant British-style luxury grand tourer coupe with a long bonnet and a sweeping fastback roof, in dark emerald green. ${CAR}`, texture: 'Dark emerald green luxury coupe, chrome grille and trim, cream leather interior, silver multi-spoke wheels.' },
  carSuv: { polycount: 30000, text: `A big, boxy, very luxurious off-road SUV with a tall upright front, chrome grille, in gloss black. ${CAR}`, texture: 'Gloss black luxury SUV, chrome grille and trim, black multi-spoke wheels, dark tinted windows.' },
  carEv: { polycount: 30000, text: `A futuristic electric sports coupe with smooth rounded aerodynamic lines, a thin light bar across the front and back, in pearl white. ${CAR}`, texture: 'Pearl white electric coupe, black glass roof, thin glowing light bars, black aero wheels.' },
  gorge: {
    polycount: 8000,
    prompt: 'Gorge, a cute brown tabby cat with dark stripes, amber-green eyes and a red-and-black check collar with a small bell, standing on all four legs.',
    texture: 'Brown-grey tabby cat with dark stripes, white chin, pink nose, amber-green eyes, red and black buffalo-check collar, small silver bell.',
  },
  lion: {
    polycount: 12000,
    prompt: 'An adult male lion with a big fluffy golden-brown mane, tawny fur, long tail with a dark tuft, standing on all four legs. High-quality stylised 3D animal in the look of a modern animated family film: appealing, friendly, expressive eyes, clean readable shapes, rich natural colours. Full body visible, standing on the ground in a calm neutral pose, side three-quarter view, centred, plain white background, soft even lighting, no shadows, no text, no other animals or objects.',
    texture: 'Tawny lion with a golden-brown mane, dark tail tuft.',
  },
  elephant: {
    polycount: 12000,
    prompt: 'An adult African elephant with big ears, long trunk hanging down, small white tusks, wrinkled grey skin, standing on all four legs. High-quality stylised 3D animal in the look of a modern animated family film: appealing, friendly, expressive eyes, clean readable shapes, rich natural colours. Full body visible, standing on the ground in a calm neutral pose, side three-quarter view, centred, plain white background, soft even lighting, no shadows, no text, no other animals or objects.',
    texture: 'Grey wrinkled elephant, white tusks, pink inner ears.',
  },
  giraffe: {
    polycount: 12000,
    prompt: 'An adult giraffe with a long neck held up high, orange-brown patches on cream fur, small ossicone horns, standing on all four legs. High-quality stylised 3D animal in the look of a modern animated family film: appealing, friendly, expressive eyes, clean readable shapes, rich natural colours. Full body visible, standing on the ground in a calm neutral pose, side three-quarter view, centred, plain white background, soft even lighting, no shadows, no text, no other animals or objects.',
    texture: 'Giraffe with orange-brown patches on cream fur, dark hooves.',
  },
  monkey: {
    polycount: 8000,
    prompt: 'A playful little brown monkey with a cream face and belly, long curly tail, standing on its two back legs, arms slightly out. High-quality stylised 3D animal in the look of a modern animated family film: appealing, friendly, expressive eyes, clean readable shapes, rich natural colours. Full body visible, standing on the ground in a calm neutral pose, side three-quarter view, centred, plain white background, soft even lighting, no shadows, no text, no other animals or objects.',
    texture: 'Brown monkey with a cream face and belly.',
  },
  penguin: {
    polycount: 6000,
    prompt: 'A cute emperor penguin chick-adult hybrid style penguin: black back, white belly, yellow-orange patches on the neck, standing upright with flippers slightly out. High-quality stylised 3D animal in the look of a modern animated family film: appealing, friendly, expressive eyes, clean readable shapes, rich natural colours. Full body visible, standing on the ground in a calm neutral pose, side three-quarter view, centred, plain white background, soft even lighting, no shadows, no text, no other animals or objects.',
    texture: 'Black and white penguin with yellow-orange neck patches, orange beak and feet.',
  },
  xray: {
    polycount: 8000,
    prompt: 'A hospital X-ray machine: a flat padded examination table on a white base, with a big X-ray tube head on an arm reaching over the table from a tall column at one end, a small control panel. White and light-grey with yellow radiation warning stickers. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.',
    texture: 'White and light-grey X-ray machine and table, light-blue padded tabletop, small yellow warning stickers.',
  },
  bed: {
    polycount: 8000,
    prompt: 'A modern hospital bed for children: white metal frame with side rails, a light-blue mattress and white pillow, a folded light-blue blanket at the foot, small wheels, a headboard. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.',
    texture: 'White hospital bed, light-blue mattress and blanket, white pillow, grey wheels.',
  },
  monitor: {
    polycount: 6000,
    prompt: 'A medical vital-signs monitor on a rolling stand: a screen showing a green heartbeat line and numbers, a blood-pressure cuff hanging from a hook, grey pole with a five-wheel base. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.',
    texture: 'Grey and white medical monitor on a pole, dark screen with green heartbeat line, blue blood-pressure cuff.',
  },
  desk: {
    polycount: 8000,
    prompt: 'A hospital reception desk: curved counter, white front panel with a red cross symbol, light wood top, a computer monitor and a small plant on top. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.',
    texture: 'White reception counter with a red cross, light wood top, black computer monitor, green plant.',
  },
  scale: {
    polycount: 6000,
    prompt: "A doctor's office medical scale with a tall height-measuring rod: white and silver weighing platform, an upright column with a sliding height arm, a balance beam with weights. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.",
    texture: 'White and silver medical scale with a tall measuring rod.',
  },
  chair: {
    polycount: 6000,
    prompt: 'A blood-draw chair for a hospital lab: padded light-blue seat and backrest, one wide padded armrest that sticks out to the side for resting the arm, chrome frame. Clean, slightly stylised game-art look with realistic proportions. Three-quarter view from slightly above, the whole object visible, centred, plain white background, soft even lighting, no people, no text, no shadows, no other objects.',
    texture: 'Light-blue padded phlebotomy chair, chrome frame.',
  },
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
  const res = await fetch(`${path.startsWith('/text-to-3d') ? API2 : API}${path}`, {
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
} else if (stage === 'text') {
  // preview (the shape) then refine (the textures); both resumable
  const pre = await run('text-to-3d', { mode: 'preview', prompt: prop.text, art_style: 'realistic', ai_model: process.env.MESHY_MODEL ?? 'latest', should_remesh: true, topology: 'triangle', target_polycount: prop.polycount }, `${id}.preview`);
  const ref = await run('text-to-3d', { mode: 'refine', preview_task_id: pre.id, texture_prompt: prop.texture, enable_pbr: false }, `${id}.refine`);
  await download(ref.model_urls.glb, join(SRC, `${id}-textured.glb`));
  glbTool('model', join(SRC, `${id}-textured.glb`), join(OUT, `${id}.glb`), '2048');
  glbTool('compress', join(OUT, `${id}.glb`), join(OUT, `${id}.glb`));
} else {
  console.error('usage: node tools/meshy-props.mjs <concept|model|text> <id> [--fresh]');
  process.exit(1);
}
