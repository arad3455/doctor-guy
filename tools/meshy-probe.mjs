// Read-only Meshy queries (free): list rigging tasks and search the animation library.
import { readFileSync } from 'node:fs';
const KEY = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/^MESHY_API_KEY=(.+)$/m)[1].trim();
const api = async (path) => {
  const r = await fetch(`https://api.meshy.ai/openapi/v1${path}`, { headers: { Authorization: `Bearer ${KEY}` } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const what = process.argv[2];
if (what === 'rigs') {
  const r = await api('/rigging?page_size=10');
  console.log(r.status, JSON.stringify(r.body, null, 1).slice(0, 1500));
} else if (what === 'balance') {
  const r = await api('/balance');
  console.log(r.status, JSON.stringify(r.body));
} else {
  for (const term of process.argv.slice(2)) {
    const r = await api(`/animations/library?search=${encodeURIComponent(term)}`);
    const list = Array.isArray(r.body) ? r.body : r.body?.result ?? r.body?.data ?? r.body?.items ?? [];
    console.log(`\n[${term}] status ${r.status}, ${list.length} hits`);
    for (const e of list.slice(0, 12)) console.log(`  ${e.action_id}\t${e.name}\t${e.category}/${e.sub_category ?? ''}`);
    if (!list.length) console.log('  raw:', JSON.stringify(r.body).slice(0, 300));
  }
}
