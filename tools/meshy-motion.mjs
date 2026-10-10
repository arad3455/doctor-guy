// Text → motion clip for Doctor Guy (Meshy Text to Motion + Animation API), saved as a game clip.
//   node tools/meshy-motion.mjs <clipName> "<prompt>" <seconds>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'assets/doctor-guy');
const KEY = readFileSync(join(ROOT, '.env'), 'utf8').match(/^MESHY_API_KEY=(.+)$/m)[1].trim();
const API = 'https://api.meshy.ai/openapi/v1';
const [, , name, prompt, seconds = '5'] = process.argv;
const state = JSON.parse(readFileSync(join(OUT, 'pipeline.json'), 'utf8'));

const api = async (method, path, body) => {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${t}`);
  return JSON.parse(t);
};
const poll = async (kind, id, label) => {
  for (;;) {
    const t = await api('GET', `/${kind}/${id}`);
    if (t.status === 'SUCCEEDED') { console.log(`✓ ${label} (${t.consumed_credits} credits)`); return t; }
    if (['FAILED', 'CANCELED'].includes(t.status)) throw new Error(`${label} ${t.status}: ${JSON.stringify(t.task_error)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
};
const key = `motion_${name}`;
let motionId = state[key];
if (!motionId || process.argv.includes('--fresh')) {
  motionId = (await api('POST', '/text-to-motion', { prompt, duration: Number(seconds), mode: 'prime' })).result;
  state[key] = motionId;
  writeFileSync(join(OUT, 'pipeline.json'), JSON.stringify(state, null, 2));
}
await poll('text-to-motion', motionId, 'text-to-motion');
const animKey = `anim_${name}`;
let animId = state[animKey];
if (!animId || process.argv.includes('--fresh')) {
  animId = (await api('POST', '/animations', { rig_task_id: state.rig, motion_task_id: motionId })).result;
  state[animKey] = animId;
  writeFileSync(join(OUT, 'pipeline.json'), JSON.stringify(state, null, 2));
}
const anim = await poll('animations', animId, 'retarget to Doctor Guy');
const src = join(OUT, `source/${name}.glb`);
writeFileSync(src, Buffer.from(await (await fetch(anim.result.animation_glb_url)).arrayBuffer()));
const tool = (...a) => execFileSync('node', [join(ROOT, 'tools/glb-tools.mjs'), ...a], { stdio: 'inherit' });
tool('anim', src, join(OUT, `anims/${name}.glb`));
tool('compress', join(OUT, `anims/${name}.glb`), join(OUT, `anims/${name}.glb`));
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
manifest.clips[name] = `anims/${name}.glb`;
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`clip "${name}" ready`);
