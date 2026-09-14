import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
const root = resolve(import.meta.dirname, '..'), publicRoot = resolve(root, 'dist');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.png':'image/png', '.woff2':'font/woff2', '.ttf':'font/ttf', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };
const assets = {};
async function collect(dir) {
  for (const item of await readdir(dir, { withFileTypes:true })) {
    if (['server', '.openai'].includes(item.name)) continue;
    const path = resolve(dir, item.name);
    if (item.isDirectory()) await collect(path);
    else assets['/' + relative(publicRoot, path)] = [mime[extname(path)] || 'application/octet-stream', (await readFile(path)).toString('base64')];
  }
}
await collect(publicRoot);
assets['/'] = assets['/index.html'];
const independent = (await readFile(resolve(root, 'worker/independent.mjs'), 'utf8')).replaceAll('export ', '');
const api = independent + '\n' + (await readFile(resolve(root, 'worker/api.mjs'), 'utf8')).replace("import { independentResults } from './independent.mjs';", '').replace('export async function handleAPI', 'async function handleAPI');
const worker = `${api}\nconst assets=${JSON.stringify(assets)};\nexport default { async fetch(request, env, ctx) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) return handleAPI(request,ctx);
  if(!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname];
  if(!asset) return new Response('Not found',{status:404});
  const bytes=request.method==='HEAD'?null:Uint8Array.from(atob(asset[1]), c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'content-type':asset[0],'cache-control':'no-cache','x-content-type-options':'nosniff',...(url.pathname==='/sw.js'?{'service-worker-allowed':'/'}:{})}});
}};\n`;
await mkdir(resolve(publicRoot, 'server'), { recursive:true });
await writeFile(resolve(publicRoot, 'server/index.js'), worker);
await mkdir(resolve(publicRoot, '.openai'), { recursive:true });
await writeFile(resolve(publicRoot, '.openai/hosting.json'), await readFile(resolve(root, '.openai/hosting.json')));
console.log(`Built Worker with ${Object.keys(assets).length} assets and read-only results API.`);
