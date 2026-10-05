import {createHash} from 'node:crypto';
import {config} from '@/lib/server';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {proofFile,proofInput,proofLimit,type PaymentProof} from '@/lib/icom-bank/proofs';
export const runtime='nodejs';
export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('dashboard');
 const max=proofLimit+65536,reader=req.body?.getReader();if(!reader)throw new BankError('Selecione o comprovante.',400);
 const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new BankError('O comprovante deve ter até 10 MB.',413);}chunks.push(value);}
 const body=Buffer.concat(chunks);const form=await new Response(body,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
 const file=form.get('file');if(!(file instanceof File)||file.size>proofLimit)throw new BankError('Selecione um JPG, PNG ou PDF de até 10 MB.',400);
 let input,mime;const bytes=new Uint8Array(await file.arrayBuffer());try{input=proofInput(form.get('id'),form.get('installment'),form.get('amount'));mime=proofFile(file.name,file.type,bytes);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira o comprovante.',400);}
 const hash=createHash('sha256').update(bytes).digest('hex');
 const proof=await bankQuery<PaymentProof>(token,'rpc/icom_bank_reserve_proof','POST',{p_id:input.id,p_installment:input.installment,p_amount:input.cents,p_mime:mime,p_size:bytes.length,p_hash:hash});
 if(proof.status==='ARQUIVO_PENDENTE'){
  const {url,key}=config(),path=proof.object_path.split('/').map(encodeURIComponent).join('/');
  const upload=await fetch(`${url}/storage/v1/object/icom-bank-documents/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':mime,'x-upsert':'false'},body:Buffer.from(bytes),cache:'no-store'});
  if(!upload.ok){const failure=await upload.json().catch(()=>({})) as {statusCode?:string|number;error?:string};if(![409,'409'].includes(failure.statusCode||'')&&failure.error!=='Duplicate')throw new BankError('Falha no envio do arquivo. Tente novamente com o mesmo comprovante.',400);}
  await bankQuery(token,'rpc/icom_bank_submit_proof','POST',{p_id:input.id});
 }
 return Response.json({id:input.id},{headers:{'Cache-Control':'no-store'}});
}catch(error){return bankError(error);}}
