import {wealthInput,type WealthRecord} from './personal-wealth.ts';
import {accountId} from './accounts.ts';
import {monthlyDueDates} from './payables.ts';
import {realDate,validId} from './contracts.ts';
export type PropertyPlan={wealth_id:string;owner_id:string;config:PropertyConfig;created_at:string};
export type PropertyConfig={rent_cents:number;rent_first:string|null;rent_months:number;rent_account_id:string|null;loan_cents:number;loan_first:string|null;loan_months:number};
export type RentDue={id:string;owner_id:string;wealth_id:string;title:string;due_date:string;amount_cents:number;account_id:string;status:'PENDENTE'|'RECEBIDO';received_at:string|null;wealth_income_id:string|null;ledger_entry_id:string|null;active:boolean;updated_at:string};
export type PropertyData={plans:PropertyPlan[];rents:RentDue[]};
export function propertyInput(body:Record<string,unknown>){
 const wealth=wealthInput(body),raw=body.property;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Confira os dados do imóvel.');
 const b=raw as Record<string,unknown>,cents=(k:string)=>{const v=b[k];if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>1_000_000_000)throw new Error('Confira o valor do aluguel e da parcela.');return v;};
 const rent_cents=cents('rent_cents'),loan_cents=cents('loan_cents');
 const schedule=(prefix:string,amount:number)=>{if(!amount)return {first:null,months:0};const first=b[prefix+'_first'],months=b[prefix+'_months'];if(typeof first!=='string'||!realDate(first)||typeof months!=='number')throw new Error('Informe o primeiro vencimento e quantas parcelas faltam.');monthlyDueDates(first,months);return {first,months};};
 const rent=schedule('rent',rent_cents),loan=schedule('loan',loan_cents),rent_account_id=accountId(b.rent_account_id,rent_cents>0);
 if(wealth.kind!=='ATIVO'||wealth.category!=='Imóvel / aluguel'||loan_cents>0&&wealth.debt_cents<=0)throw new Error('O financiamento precisa ter uma dívida vinculada ao imóvel.');
 return {wealth,property:{rent_cents,rent_first:rent.first,rent_months:rent.months,rent_account_id,loan_cents,loan_first:loan.first,loan_months:loan.months} satisfies PropertyConfig};
}
export const propertyAppreciation=(asset:Pick<WealthRecord,'amount_cents'|'invested_cents'>)=>asset.amount_cents-asset.invested_cents;
export function rentReceiveInput(b:Record<string,unknown>,today:string){const id=accountId(b.id,true)!,request=accountId(b.request_id,true)!,account=accountId(b.account_id,true)!,date=b.received_at,expected=b.expected_updated_at;if(typeof date!=='string'||!realDate(date)||date<'2000-01-01'||date>today||typeof expected!=='string'||!Number.isFinite(Date.parse(expected))||b.confirmed!==true||!['PIX','DINHEIRO','CARTAO','TRANSFERENCIA','BOLETO'].includes(String(b.method)))throw new Error('Confira a data, a conta e confirme que o aluguel já entrou.');return {p_id:id,p_request:request,p_account:account,p_date:date,p_method:b.method,p_expected:expected};}
export function validPropertyId(id:unknown){return typeof id==='string'&&validId(id);}
