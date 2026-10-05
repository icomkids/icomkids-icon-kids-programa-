export type CatalogOption={code:string;name:string};
export type FipeSelection={brand_id:string;model_id:string;year_id:string};
export type FipeSnapshot=FipeSelection&{price_cents:number;code:string;reference:string;consulted_at:string;provider:'Parallelum';fuel:string};
export type VehicleSpec={brand:string;model:string;version:string;year:number|null;selection?:FipeSelection;fipe?:FipeSnapshot};
export const brandLabel=(name:string)=>name==='GM - Chevrolet'?'GM / Chevrolet':name==='VW - VolksWagen'?'Volkswagen':name;
export function modelFamily(name:string){const multi=/^(Grand Vitara|Grand Siena|Grand Cherokee|New Fiesta|New Civic|New Beetle|Land Cruiser|Range Rover|Sportage|Santa Fe|Palio Weekend|Uno Mille|Hilux SW4|Golf Variant|Discovery Sport)\b/i.exec(name);return multi?.[1]||name.trim().split(/[\s/]+/)[0];}
export function catalogSelection(value:unknown):FipeSelection{
 const v=value as Record<string,unknown>;
 if(!v||typeof v!=='object'||!/^\d{1,6}$/.test(String(v.brand_id))||!/^\d{1,6}$/.test(String(v.model_id))||!/^(?:19\d{2}|20\d{2}|32000)-[1-9]$/.test(String(v.year_id)))throw new Error('Selecione marca, versão, ano e combustível válidos.');
 return {brand_id:String(v.brand_id),model_id:String(v.model_id),year_id:String(v.year_id)};
}
export function vehicleSpec(value:unknown):VehicleSpec{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Confira os dados do veículo.');
 const v=value as Record<string,unknown>,string=(key:string)=>{if(typeof v[key]!=='string'||String(v[key]).trim().length>160)throw new Error('Confira marca, modelo e versão.');return String(v[key]).trim();};
 const spec:VehicleSpec={brand:string('brand'),model:string('model'),version:string('version'),year:v.year===null?null:Number(v.year)};
 if(spec.brand.length<2||spec.model.length<1||spec.year!==null&&(!Number.isInteger(spec.year)||spec.year<1900||spec.year>2100))throw new Error('Informe marca, modelo e ano válidos.');
 if(v.selection)spec.selection=catalogSelection(v.selection);
 // Prices received from the client are deliberately not copied. The API resolves the quote.
 return spec;
}
export function fipePrice(value:unknown){if(typeof value!=='string'||!/^R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}$/.test(value))throw new Error('Preço FIPE indisponível.');const parts=value.replace(/^R\$\s*/,'').replaceAll('.','').split(',');const cents=Number(parts[0])*100+Number(parts[1]);if(!Number.isSafeInteger(cents)||cents<=0||cents>1000000000)throw new Error('Preço FIPE inválido.');return cents;}
