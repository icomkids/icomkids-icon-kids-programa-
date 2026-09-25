// Local-only development server. Mirrors the fixed anonymous production routes.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, resolve, sep } from 'node:path';
const root = fileURLToPath(new URL('../adhonep/', import.meta.url));
const config = await readFile(join(root, 'nginx.conf'), 'utf8');
const routes = new Map([...config.matchAll(/^\s+(\/api\/public\/\w+) "([^"]+)";/gm)].map(m => [m[1], m[2]]));
const key = config.match(/proxy_set_header apikey ([^;]+);/)[1];
const cached = new Map();
const fixture = process.argv.includes('--fixture');
if (fixture) {
  const chapter = { id: 'demo', name: 'Capítulo de demonstração', city: 'Taubaté', state: 'SP' };
  const rows = Array.from({ length: 8 }, (_, i) => ({ id: `demo-${i}`, slug: `demo-${i}`, name: `Demonstração ${i + 1}`, chapter_id: 'demo', segment: i % 2 ? 'Saúde' : 'Tecnologia', short_description: 'Empresa fictícia apenas para testar a interface.', description: 'Dados locais de teste, sem alterar os cadastros reais.', adh_chapters: chapter, offerings: [], differentials: [] }));
  for (const [name, data] of [['businesses', rows], ['chapters', [chapter]], ['events', []]]) cached.set('/api/public/' + name, { body: JSON.stringify(data), time: Date.now(), range: `0-${Math.max(data.length - 1, 0)}/${data.length}` });
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (routes.has(path)) {
      let item = cached.get(path);
      if (!item || (!fixture && Date.now() - item.time > 60_000)) {
        const upstream = await fetch('https://swsfwthjxtqtkloexyjs.supabase.co/rest/v1/' + routes.get(path), { headers: { apikey: key, Prefer: 'count=exact' }, signal: AbortSignal.timeout(10_000) });
        if (!upstream.ok) throw Error('Upstream unavailable: ' + upstream.status);
        item = { body: await upstream.text(), time: Date.now(), range: upstream.headers.get('content-range') || '' }; cached.set(path, item);
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': item.range, 'X-Public-Cache': 'HIT' }); res.end(item.body); return;
    }
    const filename = resolve(root, '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
    if (!filename.startsWith(resolve(root) + sep)) throw Error('Invalid path');
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch {
    const saved = cached.get(path);
    if (saved) { res.writeHead(200, { 'Content-Type': 'application/json', 'X-Public-Cache': 'STALE' }); res.end(saved.body); }
    else { res.writeHead(path.startsWith('/api/') ? 503 : 404); res.end('Temporariamente indisponível'); }
  }
}).listen(fixture ? 8768 : 8767, '127.0.0.1', () => console.log(`Public preview: http://127.0.0.1:${fixture ? 8768 : 8767}`));
