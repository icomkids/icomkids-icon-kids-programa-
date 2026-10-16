export type Branding={company_name:string;logo_url:string|null};
export const DEFAULT_BRANDING:Branding={company_name:'Experiência',logo_url:null};
export const LOGO_MAX_BYTES=300*1024;
export function companyName(value:unknown){
 const name=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
 if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw new Error('Informe o nome da empresa com até 80 caracteres.');
 return name;
}
export function brandText(text:string,name:string){
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return text.replace(new RegExp(`${escaped}|\\[Empresa\\]|\\bIcom(?:\\s+Veículos)?\\b`,'gi'),match=>match.toLocaleLowerCase()===name.toLocaleLowerCase()?match:name);
}
export function assertBrandManager(role:string){if(!['owner','admin'].includes(role))throw new Error('Acesso não autorizado.');}
export function validateLogo(bytes:Uint8Array){
 const signature=[137,80,78,71,13,10,26,10];
 if(bytes.length<45||bytes.length>LOGO_MAX_BYTES||!signature.every((b,i)=>bytes[i]===b))throw new Error('Escolha uma logo PNG válida de até 300 KB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR'||view.getUint32(16)<1||view.getUint32(20)<1||view.getUint32(16)>1200||view.getUint32(20)>600||String.fromCharCode(...bytes.slice(-8,-4))!=='IEND')throw new Error('A imagem da logo não é válida. Escolha outra imagem.');
 return bytes;
}
