import {catalogSelection,fipePrice,modelFamily,type CatalogOption,type FipeSelection,type VehicleSpec} from './vehicle-catalog.ts';
import bundledBrands from './vehicle-brands.json' with {type:'json'};
import bundledModels from './vehicle-models.json' with {type:'json'};
const base='https://fipe.parallelum.com.br/api/v2';
const cache=new Map<string,{until:number;promise:Promise<unknown>}>();
export async function fipeGet(path:string):Promise<unknown>{
 if(!/^(?:references|cars\/brands(?:\/\d{1,6}\/models(?:\/\d{1,6}\/years(?:\/(?:19\d{2}|20\d{2}|32000)-[1-9])?)?)?)(?:\?reference=\d{1,6})?$/.test(path))throw new Error('Consulta de veículo inválida.');
 const hit=cache.get(path);if(hit&&hit.until>Date.now())return hit.promise;
 if(cache.size>2000)cache.delete(cache.keys().next().value!);
 const promise=(async()=>{const response=await fetch(base+'/'+path,{headers:{Accept:'application/json',...(process.env.FIPE_API_TOKEN?{'X-Subscription-Token':process.env.FIPE_API_TOKEN}:{})},signal:AbortSignal.timeout(10000),redirect:'error',cache:'no-store'});if(!response.ok)throw new Error(response.status===429?'A consulta FIPE atingiu o limite do provedor. Tente mais tarde ou cadastre manualmente.':'Consulta FIPE temporariamente indisponível. Tente novamente ou cadastre manualmente.');const text=await response.text();if(text.length>2000000)throw new Error('Resposta FIPE acima do limite.');return JSON.parse(text);})();
 cache.set(path,{until:Date.now()+86400000,promise});promise.catch(()=>cache.delete(path));return promise;
}
export function catalogOptions(value:unknown):CatalogOption[]{if(!Array.isArray(value)||value.length>15000)throw new Error('Catálogo indisponível.');return value.map(v=>{if(!v||typeof v.code!=='string'||typeof v.name!=='string'||v.code.length>20||v.name.length>160)throw new Error('Catálogo inválido.');return {code:v.code,name:v.name};});}
export async function latestReference(){const rows=await fipeGet('references') as {code:string;month:string}[];if(!Array.isArray(rows)||!rows.length||!/^\d{1,6}$/.test(rows[0].code))throw new Error('Referência FIPE indisponível.');return rows[0].code;}
// Catalogues are bundled independently of prices, so a provider outage never empties
// the brand/model selectors. Quotes still come from the provider and are never guessed.
export function bundledCatalog(brand?:string):CatalogOption[]{return brand?((bundledModels as Record<string,CatalogOption[]>)[brand]||[]):bundledBrands;}
export async function fipeQuote(selection:FipeSelection):Promise<VehicleSpec>{
 const s=catalogSelection(selection),reference=await latestReference();
 const data=await fipeGet(`cars/brands/${s.brand_id}/models/${s.model_id}/years/${s.year_id}?reference=${reference}`) as Record<string,unknown>;
 if(typeof data.brand!=='string'||typeof data.model!=='string'||typeof data.codeFipe!=='string'||!/^\d{6}-\d$/.test(data.codeFipe)||typeof data.referenceMonth!=='string'||typeof data.fuel!=='string'||Number(data.modelYear)!==Number(s.year_id.split('-')[0]))throw new Error('A referência FIPE não corresponde ao veículo selecionado.');
 return {brand:data.brand,model:modelFamily(data.model),version:data.model,year:Number(data.modelYear)===32000?null:Number(data.modelYear),selection:s,fipe:{...s,price_cents:fipePrice(data.price),code:data.codeFipe,reference:data.referenceMonth,consulted_at:new Date().toISOString(),provider:'Parallelum',fuel:data.fuel}};
}
export async function resolveVehicleSpec(value:VehicleSpec,previous?:VehicleSpec){
 if(!value.selection)return value;
 if(previous?.fipe&&previous.selection&&JSON.stringify(value.selection)===JSON.stringify(previous.selection))return previous;
 return fipeQuote(value.selection);
}
