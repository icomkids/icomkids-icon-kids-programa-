import {validId,moneyInput,realDate} from './contracts.ts';
import {brazilDay,type BankProof} from './model.ts';
export const proofLimit=10*1024*1024;
export type PaymentProof=BankProof & {mime_type:string;size_bytes:number;object_path:string;submitted_by:string;rejection_reason:string|null;reviewed_at:string|null;file_sha256:string|null};
export function proofFile(name:string,mime:string,bytes:Uint8Array){
 const ext=name.toLowerCase().split('.').pop();
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const jpg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const pdf=bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
 if(!bytes.length||bytes.length>proofLimit)throw new Error('O comprovante deve ter até 10 MB.');
 if(!(mime==='image/png'&&ext==='png'&&png||mime==='image/jpeg'&&['jpg','jpeg'].includes(ext||'')&&jpg||mime==='application/pdf'&&ext==='pdf'&&pdf))throw new Error('Envie uma imagem JPG, PNG ou um PDF válido.');
 return mime;
}
export function proofInput(id:unknown,installment:unknown,amount:unknown){if(typeof id!=='string'||!validId(id)||typeof installment!=='string'||!validId(installment)||typeof amount!=='string')throw new Error('Parcela inválida.');const cents=moneyInput(amount);if(cents<=0)throw new Error('Informe o valor que consta no comprovante.');return {id,installment,cents};}
export function reviewInput(body:Record<string,unknown>,today=brazilDay()){
 if(typeof body.id!=='string'||!validId(body.id)||!['APROVADO','RECUSADO'].includes(String(body.decision)))throw new Error('Comprovante ou decisão inválidos.');
 const reason=String(body.reason||'').trim(),date=String(body.paid_at||'');
 if(body.decision==='RECUSADO'&&(reason.length<3||reason.length>1000))throw new Error('Explique o motivo da recusa (3 a 1.000 caracteres).');
 if(body.decision==='APROVADO'&&(!realDate(date)||date>today))throw new Error('Informe a data do recebimento, sem data futura.');
 return {p_id:body.id,p_decision:body.decision,p_paid_at:body.decision==='APROVADO'?date:null,p_reason:body.decision==='RECUSADO'?reason:''};
}
