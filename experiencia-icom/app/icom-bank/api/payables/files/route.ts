import {createHash} from 'node:crypto';
import {config} from '@/lib/server';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {proofFile,proofLimit} from '@/lib/icom-bank/proofs';
import {validId} from '@/lib/icom-bank/contracts';
import type {PayableFile} from '@/lib/icom-bank/payables';
export const runtime='nodejs';
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');
 const reader=req.body?.getReader();if(!reader)throw new BankError('Selecione o comprovante.',400);
 const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>proofLimit+65536){await reader.cancel();throw new BankError('O comprovante deve ter até 10 MB.',413);}chunks.push(value);}
 const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const file=form.get('file'),id=form.get('id'),bill=form.get('bill');
 if(!(file instanceof File)||typeof id!=='string'||!validId(id)||typeof bill!=='string'||!validId(bill))throw new BankError('Confira a conta e o comprovante.',400);
 const bytes=new Uint8Array(await file.arrayBuffer());let mime;try{mime=proofFile(file.name,file.type,bytes);}catch(e){throw new BankError(e instanceof Error?e.message:'Comprovante inválido.',400);}
 const hash=createHash('sha256').update(bytes).digest('hex');
 const saved=await bankQuery<PayableFile>(token,'rpc/icom_bank_reserve_payable_file','POST',{p_id:id,p_bill:bill,p_mime:mime,p_size:bytes.length,p_hash:hash});
 if(saved.status==='RESERVADO'){
  const {url,key}=config(),path=saved.object_path.split('/').map(encodeURIComponent).join('/');
  const upload=await fetch(`${url}/storage/v1/object/icom-bank-documents/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':mime,'x-upsert':'false'},body:Buffer.from(bytes),cache:'no-store'});
  if(!upload.ok){const f=await upload.json().catch(()=>({})) as {statusCode?:string|number;error?:string};if(![409,'409'].includes(f.statusCode||'')&&f.error!=='Duplicate')throw new BankError('Falha no envio. Tente novamente com o mesmo arquivo.',400);}
  await bankQuery(token,'rpc/icom_bank_submit_payable_file','POST',{p_id:id});
 }
 return Response.json({id},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
