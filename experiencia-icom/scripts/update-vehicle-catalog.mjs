import {writeFile} from 'node:fs/promises';
const base='https://fipe.parallelum.com.br/api/v2/';
async function get(path){const r=await fetch(base+path,{headers:{Accept:'application/json',...(process.env.FIPE_API_TOKEN?{'X-Subscription-Token':process.env.FIPE_API_TOKEN}:{})},signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw new Error(`Catalog request failed (${r.status})`);const rows=await r.json();if(!Array.isArray(rows)||rows.some(x=>typeof x.code!=='string'||typeof x.name!=='string'))throw new Error('Invalid catalogue');return rows;}
const brands=await get('cars/brands'),models={};
// Only replace the catalogue after every request succeeds. No prices are downloaded.
for(let n=0;n<brands.length;n+=4)await Promise.all(brands.slice(n,n+4).map(async b=>{models[b.code]=await get(`cars/brands/${b.code}/models`);}));
await writeFile(new URL('../lib/icom-bank/vehicle-brands.json',import.meta.url),JSON.stringify(brands));
await writeFile(new URL('../lib/icom-bank/vehicle-models.json',import.meta.url),JSON.stringify(models));
console.log(`Catalog: ${brands.length} brands, ${Object.values(models).reduce((n,rows)=>n+rows.length,0)} versions. Review and publish.`);
