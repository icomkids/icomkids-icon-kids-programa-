import {brazilDay} from './model.ts';
import {realDate,validId,moneyInput} from './contracts.ts';

export const defaultSaleCommission=165000;
export type AdminSeller={id:string;name:string};
export function adminMoneyInput(value:string){
 const clean=value.trim().replace(/^R\$\s*/, '');
 if(!/^(?:\d{1,9}|\d{1,3}(?:\.\d{3}){1,2})(?:,\d{1,2})?$/.test(clean))throw new Error('Confira o valor. Exemplo: 85.000,00.');
 const cents=moneyInput(clean.replaceAll('.',''));
 if(cents>1000000000)throw new Error('O valor m�ximo por campo � R$ 10.000.000,00.');
 return cents;
}
export const adminMoneyText=(cents:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export function adminSaleCalculation(values:Record<string,string>){
 const purchase=adminMoneyInput(values.purchase_cents||'0'),cost=adminMoneyInput(values.vehicle_cost_cents||'0'),commission=adminMoneyInput(values.commission_cents||'0'),sale=adminMoneyInput(values.sale_cents||'0');
 return {purchase,cost,commission,sale,total:purchase+cost+commission,profit:sale-purchase-cost-commission};
}
export type SaleReceipt='INTEGRAL'|'PARCIAL'|'PENDENTE';
export function adminSaleReceived(sale:number,receipt:SaleReceipt,partial:string){
 if(receipt==='PENDENTE')return 0;
 const received=receipt==='INTEGRAL'?sale:adminMoneyInput(partial);
 if(received>sale)throw new Error('O recebimento desta venda n�o pode superar o valor da venda.');
 return received;
}

export const adminKinds=['VENDA','ENTRADA','CUSTO','RETORNO','TROCA','MENSAL','PESSOAL'] as const;
export type AdminKind=(typeof adminKinds)[number];
export type AdminScope='LOJA'|'PESSOAL';
export type AdminStatus='PREVISTO'|'REALIZADO';
export type AdminDetails={vehicle?:string;trade_vehicle?:string;plate?:string;seller?:string;bank?:string;return_level?:number;notes?:string;payment_method?:string;purchase_cents?:number;vehicle_cost_cents?:number;commission_cents?:number;sale_cents?:number;financed_cents?:number;tax_cents?:number;manager_cents?:number;seller_cents?:number;paid_cents?:number;debt_cents?:number;document_cents?:number;cc_cents?:number;discount_cents?:number;division_cents?:number;profit_share_cents?:number;due_day?:number};
export type AdminEntry={id:string;kind:AdminKind;scope:AdminScope;entry_date:string;description:string;category:string;status:AdminStatus;amount_cents:number|null;details:AdminDetails;active:boolean;created_at:string;updated_at:string};
export type AdminReference={closing:{source:string;period:string|null;income_cents:number;expense_cents:number;subtotal_cents:number;returns_cents:number;personal_cents:number};monthly:{label:string;due_day:number}[];sources:{file:string;purpose:string}[]};

const moneyKeys=['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','financed_cents','tax_cents','manager_cents','seller_cents','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents'] as const;
const textKeys=['vehicle','trade_vehicle','plate','seller','bank','notes','payment_method'] as const;
const allowed:Record<AdminKind,readonly (keyof AdminDetails)[]>={
 VENDA:['vehicle','trade_vehicle','plate','seller','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','notes','payment_method'],
 ENTRADA:['notes','payment_method'],CUSTO:['vehicle','plate','notes','payment_method'],
 RETORNO:['vehicle','plate','seller','bank','return_level','financed_cents','tax_cents','manager_cents','seller_cents','notes'],
 TROCA:['vehicle','plate','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents','notes'],
 MENSAL:['due_day','notes','payment_method'],PESSOAL:['notes','payment_method'],
};
function amount(value:unknown,nullable=false){if(nullable&&(value===null||value===undefined||value===''))return null;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>1000000000)throw new Error('Confira os valores em reais.');return value;}
function text(value:unknown,max:number){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max)throw new Error('Confira os textos do lan�amento.');return value.trim();}
export function adminInput(body:Record<string,unknown>){
 const id=text(body.id,36),kind=text(body.kind,20) as AdminKind,scope=text(body.scope,20) as AdminScope,entry_date=text(body.entry_date,10),description=text(body.description,160),category=text(body.category,80),status=text(body.status,20) as AdminStatus;
 if(!validId(id)||!adminKinds.includes(kind)||!['LOJA','PESSOAL'].includes(scope)||kind==='PESSOAL'&&scope!=='PESSOAL'||!['MENSAL','PESSOAL'].includes(kind)&&scope!=='LOJA'||!realDate(entry_date)||Number(entry_date.slice(0,4))<2000||Number(entry_date.slice(0,4))>2100||description.length<2||!['PREVISTO','REALIZADO'].includes(status))throw new Error('Confira data, descri��o, �rea e situa��o.');
 const amount_cents=amount(body.amount_cents,true);
 if(!['MENSAL','TROCA'].includes(kind)&&amount_cents===null)throw new Error('Informe o valor do lan�amento.');
 const raw=body.details;
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw new Error('Confira os detalhes.');
 const details:AdminDetails={};
 for(const key of allowed[kind]){
  const value=(raw as Record<string,unknown>)[key];if(value===undefined)continue;
  if((moneyKeys as readonly string[]).includes(key))Object.assign(details,{[key]:amount(value)});
  else if((textKeys as readonly string[]).includes(key))Object.assign(details,{[key]:text(value,key==='notes'?2000:key==='plate'?7:160)});
  else {const max=key==='due_day'?31:3;if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>max)throw new Error('Confira dia do vencimento ou tipo de retorno.');Object.assign(details,{[key]:value});}
 }
 if(details.plate){details.plate=details.plate.toUpperCase();if(!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(details.plate))throw new Error('Confira a placa.');}
 if(['VENDA','RETORNO','TROCA'].includes(kind)&&!details.vehicle)throw new Error('Informe o carro.');
 if(kind==='VENDA'&&['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents'].some(k=>details[k as keyof AdminDetails]===undefined))throw new Error('Informe compra, custos, comiss�o e venda.');
 if(kind==='RETORNO'&&(Number(details.tax_cents||0)+Number(details.manager_cents||0)+Number(details.seller_cents||0)>Number(amount_cents)))throw new Error('Imposto e repasses n�o podem superar o retorno recebido.');
 const expected=body.expected_updated_at===null?null:text(body.expected_updated_at,50);
 if(expected!==null&&(!expected||!Number.isFinite(Date.parse(expected))))throw new Error('Reabra o lan�amento antes de salvar.');
 return {id,kind,scope,entry_date,description,category,status,amount_cents,details,expected_updated_at:expected};
}
export function adminArchiveInput(body:Record<string,unknown>){const id=text(body.id,36),expected=text(body.expected_updated_at,50);if(!validId(id)||typeof body.active!=='boolean'||!expected||!Number.isFinite(Date.parse(expected)))throw new Error('Reabra o lan�amento antes de arquivar ou restaurar.');return {id,active:body.active,expected_updated_at:expected};}
export function adminYear(value:string|null,today=brazilDay()){const year=value===null?Number(today.slice(0,4)):Number(value);if(!/^\d{4}$/.test(String(year))||year<2000||year>2100)throw new Error('Confira o ano.');return year;}
export const saleCost=(e:AdminEntry)=>Number(e.details.purchase_cents||0)+Number(e.details.vehicle_cost_cents||0)+Number(e.details.commission_cents||0);
export const saleProfit=(e:AdminEntry)=>Number(e.details.sale_cents||0)-saleCost(e);
export const returnNet=(e:AdminEntry)=>Number(e.amount_cents||0)-Number(e.details.tax_cents||0);
export const returnStore=(e:AdminEntry)=>returnNet(e)-Number(e.details.manager_cents||0)-Number(e.details.seller_cents||0);
export function adminStats(rows:AdminEntry[],month:string){
 const selected=rows.filter(e=>e.active&&e.entry_date.startsWith(month)),done=selected.filter(e=>e.status==='REALIZADO'),sum=(items:AdminEntry[])=>items.reduce((n,e)=>n+Number(e.amount_cents||0),0);
 const returns=done.filter(e=>e.kind==='RETORNO');
 const income=sum(done.filter(e=>e.kind==='ENTRADA'||e.kind==='VENDA'))+sum(returns);
 const expenses=sum(done.filter(e=>e.scope==='LOJA'&&['CUSTO','MENSAL'].includes(e.kind)))+returns.reduce((n,e)=>n+Number(e.details.tax_cents||0)+Number(e.details.manager_cents||0)+Number(e.details.seller_cents||0),0);
 const personal=sum(done.filter(e=>e.scope==='PESSOAL'));
 return {income,expenses,personal,balance:income-expenses,combined:income-expenses-personal,sales:done.filter(e=>e.kind==='VENDA').length,profit:done.filter(e=>e.kind==='VENDA').reduce((n,e)=>n+saleProfit(e),0),returns:returns.reduce((n,e)=>n+returnStore(e),0),planned:sum(selected.filter(e=>e.status==='PREVISTO')),missing:done.filter(e=>e.amount_cents===null&&e.kind==='MENSAL').length};
}
