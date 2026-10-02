export function phoneBR(raw:unknown):string {
 const digits=String(raw??'').replace(/\D/g,'');
 const phone=digits.length===10||digits.length===11?`55${digits}`:digits;
 if(!/^55(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])(?:[2-5]\d{7}|9\d{8})$/.test(phone))throw new Error('Informe um telefone brasileiro válido com DDD.');
 return phone;
}
export type WhatsappStatus='not_sent'|'sending'|'accepted'|'failed'|'unknown';
export type Connection={configured:boolean;connected:boolean;canProvision?:boolean;connecting?:boolean;wrongNumber?:boolean;phone?:string;qr?:string;paircode?:string;message:string};
export type SellerInstance={url:string;token:string;phone:string};
export function sellerInstance(seller:string,raw:string|undefined):SellerInstance|null {
 if(!raw)return null;
 const map=JSON.parse(raw) as Record<string,SellerInstance>;
 const config=map[seller];if(!config)return null;
 if(Object.entries(map).some(([id,item])=>id!==seller&&item.token===config.token))throw new Error('A conexão do WhatsApp está vinculada a mais de um vendedor. Contate a gestão.');
 const url=new URL(config.url);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!config.token)throw new Error('Configuração do WhatsApp inválida. Contate a gestão.');
 return {url:url.origin,token:config.token,phone:phoneBR(config.phone)};
}
function record(value:unknown):Record<string,unknown>{return value&&typeof value==='object'?value as Record<string,unknown>:{}}
export function connection(raw:unknown,expectedPhone:string):Connection {
 const root=record(raw),instance=record(root.instance??root.data??root),status=record(root.status);
 const state=String(instance.status??instance.state??'').toLowerCase();
 const connected=status.connected===true||['connected','open','online','ready'].includes(state);
 let phone='';for(const candidate of [instance.owner,instance.phone,record(status.jid??root.jid).user]){try{phone=phoneBR(String(candidate??'').split('@')[0].split(':')[0]);break}catch{}}
 const owns=phone===expectedPhone;
 const qr=String(instance.qrcode??instance.qr??root.qr??'');
 const safeQr=/^(?:data:image\/(?:png|jpeg);base64,)?[A-Za-z0-9+/=\s]+$/.test(qr)&&qr.length<1000000?qr:undefined;
 return {configured:true,connected:connected&&owns,connecting:state==='connecting',wrongNumber:connected&&!owns,phone:expectedPhone,...(!connected&&safeQr?{qr:safeQr.startsWith('data:')?safeQr:`data:image/png;base64,${safeQr}`}:{ }),...(!connected&&typeof instance.paircode==='string'&&/^[A-Za-z0-9-]{4,20}$/.test(instance.paircode)?{paircode:instance.paircode}:{}),message:connected?(owns?'WhatsApp conectado. As pesquisas saem do seu número.':'O número conectado não corresponde ao vendedor. Contate a gestão.'):'Seu WhatsApp está desconectado. Conecte antes do envio automático.'};
}
export function surveyMessage(name:string,url:string){return `Olá, ${name.trim().split(' ')[0]}! Como foi sua experiência com a Icom? Sua opinião é muito importante para nós. Responda pelo link: ${url}`;}
export async function sendText(config:SellerInstance,phone:string,text:string,transport:typeof fetch=fetch):Promise<{status:'accepted'|'failed'|'unknown';providerId?:string}> {
 try {
  const res=await transport(`${config.url}/send/text`,{method:'POST',headers:{'Content-Type':'application/json',token:config.token},body:JSON.stringify({number:phoneBR(phone),text}),signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!res.ok)return {status:[400,401,403,404,422,429].includes(res.status)?'failed':'unknown'};
  const data=record(await res.json());
  const id=data.id??data.messageid??record(data.key).id;
  if(data.error||data.success===false||typeof id!=='string'||!id)return {status:'unknown'};
  return {status:'accepted',providerId:id};
 }catch{return {status:'unknown'}}
}
