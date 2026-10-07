import {createHmac,timingSafeEqual} from 'node:crypto';
import {adminInput} from './administrative.ts';
import type {BankRole} from './model.ts';

export function assistantExpenseTool(role:BankRole){return role==='OWNER'?{type:'function' as const,name:'preparar_despesa_icom',description:'Prepara uma única despesa já paga, pessoal ou da loja, solicitada explicitamente pelo usuário. Nunca salva sozinha. Retorna resumo para confirmação no botão do painel. Envie a frase completa do usuário, sem inventar valor/data/placa. Não use para consultas, investimentos, receitas, pagamentos reais ou contas futuras.',parameters:{type:'object',additionalProperties:false,properties:{transcript:{type:'string',description:'Pedido literal de lançamento, incluindo valor e finalidade.'}},required:['transcript']}}:null;}
export function expenseVoiceText(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>k!=='transcript'))throw new Error('Pedido de lançamento inválido.');
 const text=(raw as {transcript?:unknown}).transcript;
 if(typeof text!=='string'||text.trim().length<5||text.length>4000)throw new Error('Diga a despesa e o valor que deseja lançar.');
 return text.trim();
}
type Payload=Omit<ReturnType<typeof adminInput>,'expected_updated_at'>;
const signature=(text:string,key:string)=>createHmac('sha256',key).update('icom-bank.voice-expense.v1\0'+text).digest();
export function signVoiceExpense(payload:Payload,user:string,key:string,now=Date.now()){
 if(!key)throw new Error('Lançamento por voz indisponível.');
 const body=Buffer.from(JSON.stringify({payload,user,expires:now+600000})).toString('base64url');
 return body+'.'+signature(body,key).toString('base64url');
}
export function readVoiceExpense(token:unknown,user:string,key:string,now=Date.now()):Payload{
 if(!key||typeof token!=='string'||token.length>14000)throw new Error('Prepare novamente a despesa.');
 const parts=token.split('.');if(parts.length!==2)throw new Error('Prepare novamente a despesa.');
 const received=Buffer.from(parts[1],'base64url'),expected=signature(parts[0],key);
 if(received.length!==expected.length||!timingSafeEqual(received,expected))throw new Error('Resumo inválido. Prepare novamente a despesa.');
 const value=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
 if(value.user!==user||!Number.isSafeInteger(value.expires)||value.expires<=now)throw new Error('O resumo expirou. Prepare novamente a despesa.');
 const {expected_updated_at:_,...payload}=adminInput({...value.payload,expected_updated_at:null});void _;
 if(!['PESSOAL','CUSTO'].includes(payload.kind)||payload.status!=='REALIZADO'||!payload.amount_cents)throw new Error('Despesa inválida.');
 return payload;
}
export function sameVoiceExpense(row:Record<string,unknown>,payload:Payload){return row.id===payload.id&&['kind','scope','entry_date','description','category','status','amount_cents'].every(k=>row[k]===payload[k as keyof Payload])&&JSON.stringify(Object.entries(row.details as object).sort())===JSON.stringify(Object.entries(payload.details).sort());}
