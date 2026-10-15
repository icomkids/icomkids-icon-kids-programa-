import {validId,realDate} from './contracts.ts';
import {brazilDay} from './model.ts';
export const cashFundKinds={SALDO_INICIAL:'Saldo inicial',APORTE:'Aporte no caixa'} as const;
export function cashFundsInput(b:Record<string,unknown>,today=brazilDay()){
 const id=typeof b.id==='string'?b.id:'',account=typeof b.account_id==='string'?b.account_id:'',date=typeof b.date==='string'?b.date:'',type=typeof b.type==='string'?b.type:'',notes=typeof b.notes==='string'?b.notes.trim():'';
 if(!validId(id)||!validId(account)||!Object.hasOwn(cashFundKinds,type)||!realDate(date)||date<'2000-01-01'||date>today||typeof b.amount_cents!=='number'||!Number.isSafeInteger(b.amount_cents)||b.amount_cents<=0||b.amount_cents>1000000000||notes.length>1000||b.confirmed!==true)throw Error('Escolha a conta da empresa, informe um valor positivo e a data, e confirme o dinheiro já disponível.');
 return {id,account_id:account,date,type:type as keyof typeof cashFundKinds,amount_cents:b.amount_cents,notes};
}
