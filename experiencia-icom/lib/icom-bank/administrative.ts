import {expenseAudiences,expenseNatures,type ExpenseAudience,type ExpenseNature} from './expense-context.ts';
import {personalCategory,tripName} from './personal-expenses.ts';
import {brazilDay} from './model.ts';
import {realDate,validId,moneyInput} from './contracts.ts';
import {vehicleSpec,type VehicleSpec} from './vehicle-catalog.ts';
import {validVehicleBank} from './vehicle-banks.ts';

export const defaultSaleCommission=165000;
export type AdminSeller={id:string;name:string};
export function adminMoneyInput(value:string){
 const clean=value.trim().replace(/^R\$\s*/, '');
 if(!/^(?:\d{1,9}|\d{1,3}(?:\.\d{3}){1,2})(?:,\d{1,2})?$/.test(clean))throw new Error('Confira o valor. Exemplo: 85.000,00.');
 const cents=moneyInput(clean.replaceAll('.',''));
 if(cents>1000000000)throw new Error('O valor máximo por campo é R$ 10.000.000,00.');
 return cents;
}
export const adminMoneyText=(cents:number)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export function adminSaleCalculation(values:Record<string,string>){
 const purchase=adminMoneyInput(values.purchase_cents||'0'),cost=adminMoneyInput(values.vehicle_cost_cents||'0'),commission=adminMoneyInput(values.commission_cents||'0'),sale=adminMoneyInput(values.sale_cents||'0');
 return {purchase,cost,commission,sale,total:purchase+cost+commission,profit:sale-purchase-cost-commission};
}
export type SaleReceipt='INTEGRAL'|'PARCIAL'|'PENDENTE';
export function adminSaleSettlement(sale:number,details:AdminDetails){
 const trade=details.trade_in?Number(details.trade_value_cents||0):0;
 const debt=details.trade_in&&details.trade_has_debts?Number(details.trade_ipva_cents||0)+Number(details.trade_fines_cents||0)+(details.trade_has_payoff?Number(details.trade_payoff_cents||0):0):0;
 if(debt>trade)throw new Error('Os débitos não podem superar o valor da troca. Confira os valores.');
 const credit=trade-debt,remaining=sale-credit;
 if(remaining<0)throw new Error('O valor líquido da troca não pode superar a venda.');
 return {trade,debt,credit,remaining};
}
export function adminSaleReceived(sale:number,receipt:SaleReceipt,partial:string){
 if(receipt==='PENDENTE')return 0;
 const received=receipt==='INTEGRAL'?sale:adminMoneyInput(partial);
 if(received>sale)throw new Error('O recebimento não pode superar o restante a pagar após a troca.');
 return received;
}

export const adminKinds=['VENDA','ENTRADA','CUSTO','RETORNO','TROCA','MENSAL','PESSOAL'] as const;
export type AdminKind=(typeof adminKinds)[number];
export type AdminScope='LOJA'|'PESSOAL';
export type AdminStatus='PREVISTO'|'REALIZADO';
export type AdminDetails={investor_id?:string;trade_investor_id?:string;sale_owner?:'LOJA'|'INVESTIDOR';investor_name?:string;trade_destination?:'LOJA'|'REPASSE'|'INVESTIDOR';trade_investor_name?:string;sale_mode?:'NORMAL'|'REPASSE';sale_cost_id?:string;settlement_part?:'CUSTOS'|'INVESTIDOR'|'CAPITAL';stock_id?:string;vehicle_spec?:VehicleSpec;trade_spec?:VehicleSpec;trade_in?:boolean;trade_has_debts?:boolean;trade_has_payoff?:boolean;trade_plate?:string;trade_year?:number;trade_value_cents?:number;trade_ipva_cents?:number;trade_fines_cents?:number;trade_payoff_cents?:number;trade_payoff_bank?:string;trade_payoff_bank_other?:string;payment_bank?:string;payment_bank_other?:string;vehicle?:string;trade_vehicle?:string;plate?:string;seller?:string;bank?:string;return_level?:number;notes?:string;payment_method?:string;trip_name?:string;expense_audience?:ExpenseAudience;expense_nature?:ExpenseNature;purchase_cents?:number;vehicle_cost_cents?:number;commission_cents?:number;sale_cents?:number;financed_cents?:number;tax_cents?:number;manager_cents?:number;seller_cents?:number;paid_cents?:number;debt_cents?:number;document_cents?:number;cc_cents?:number;discount_cents?:number;division_cents?:number;profit_share_cents?:number;due_day?:number};
export type AdminEntry={id:string;kind:AdminKind;scope:AdminScope;entry_date:string;description:string;category:string;status:AdminStatus;amount_cents:number|null;details:AdminDetails;active:boolean;created_at:string;updated_at:string};
export type AdminReference={closing:{source:string;period:string|null;income_cents:number;expense_cents:number;subtotal_cents:number;returns_cents:number;personal_cents:number};monthly:{label:string;due_day:number}[];sources:{file:string;purpose:string}[]};

const moneyKeys=['trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','financed_cents','tax_cents','manager_cents','seller_cents','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents'] as const;
const textKeys=['investor_id','trade_investor_id','sale_owner','investor_name','trade_destination','trade_investor_name','sale_mode','sale_cost_id','settlement_part','stock_id','trade_plate','trade_payoff_bank','trade_payoff_bank_other','payment_bank','payment_bank_other','vehicle','trade_vehicle','plate','seller','bank','notes','payment_method','trip_name','expense_audience','expense_nature'] as const;
const allowed:Record<AdminKind,readonly (keyof AdminDetails)[]>={
 VENDA:['investor_id','trade_investor_id','sale_owner','investor_name','trade_destination','trade_investor_name','sale_mode','stock_id','vehicle_spec','trade_spec','trade_in','trade_has_debts','trade_has_payoff','trade_plate','trade_year','trade_value_cents','trade_ipva_cents','trade_fines_cents','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other','payment_bank','payment_bank_other','vehicle','trade_vehicle','plate','seller','purchase_cents','vehicle_cost_cents','commission_cents','sale_cents','notes','payment_method'],
 ENTRADA:['notes','payment_method'],CUSTO:['sale_cost_id','settlement_part','stock_id','vehicle_spec','vehicle','plate','notes','payment_method'],
 RETORNO:['vehicle_spec','vehicle','plate','seller','bank','return_level','financed_cents','tax_cents','manager_cents','seller_cents','notes'],
 TROCA:['vehicle_spec','vehicle','plate','paid_cents','debt_cents','document_cents','cc_cents','discount_cents','division_cents','profit_share_cents','notes'],
 MENSAL:['due_day','notes','payment_method','trip_name','expense_audience','expense_nature'],PESSOAL:['notes','payment_method','trip_name','expense_audience','expense_nature'],
};
function amount(value:unknown,nullable=false){if(nullable&&(value===null||value===undefined||value===''))return null;if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>1000000000)throw new Error('Confira os valores em reais.');return value;}
function text(value:unknown,max:number){if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>max)throw new Error('Confira os textos do lançamento.');return value.trim();}
export function adminInput(body:Record<string,unknown>){
 const id=text(body.id,36),kind=text(body.kind,20) as AdminKind,scope=text(body.scope,20) as AdminScope,entry_date=text(body.entry_date,10),description=text(body.description,160),category=text(body.category,80),status=text(body.status,20) as AdminStatus;
 if(!validId(id)||!adminKinds.includes(kind)||!['LOJA','PESSOAL'].includes(scope)||kind==='PESSOAL'&&scope!=='PESSOAL'||!['MENSAL','PESSOAL'].includes(kind)&&scope!=='LOJA'||!realDate(entry_date)||Number(entry_date.slice(0,4))<2000||Number(entry_date.slice(0,4))>2100||description.length<2||!['PREVISTO','REALIZADO'].includes(status))throw new Error('Confira data, descrição, área e situação.');
 const amount_cents=amount(body.amount_cents,true);
 if(!['MENSAL','TROCA'].includes(kind)&&amount_cents===null)throw new Error('Informe o valor do lançamento.');
 const raw=body.details;
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))throw new Error('Confira os detalhes.');
 const details:AdminDetails={};
 for(const key of allowed[kind]){
  const value=(raw as Record<string,unknown>)[key];if(value===undefined)continue;
  if(key==='vehicle_spec'||key==='trade_spec')Object.assign(details,{[key]:vehicleSpec(value)});
  else if((moneyKeys as readonly string[]).includes(key))Object.assign(details,{[key]:amount(value)});
  else if((textKeys as readonly string[]).includes(key))Object.assign(details,{[key]:text(value,key==='notes'?2000:key==='plate'?7:160)});
  else if(['trade_in','trade_has_debts','trade_has_payoff'].includes(key)){if(typeof value!=='boolean')throw new Error('Selecione Sim ou Não para a troca e os débitos.');Object.assign(details,{[key]:value});}
  else if(key==='trade_year'){if(typeof value!=='number'||!Number.isInteger(value)||value<1900||value>2100)throw new Error('Confira o ano do carro da troca.');details.trade_year=value;}
  else {const max=key==='due_day'?31:3;if(typeof value!=='number'||!Number.isInteger(value)||value<1||value>max)throw new Error('Confira dia do vencimento ou tipo de retorno.');Object.assign(details,{[key]:value});}
 }
 if(kind==='VENDA'&&details.sale_owner!==undefined){
  if(!['LOJA','INVESTIDOR'].includes(details.sale_owner)||!['NORMAL','REPASSE'].includes(details.sale_mode||'NORMAL'))throw new Error('Selecione o dono do carro e o tipo da venda.');
  if(details.sale_owner==='INVESTIDOR'&&!details.investor_name)throw new Error('Informe quem é o investidor do carro vendido.');
  if(details.sale_owner==='LOJA'){delete details.investor_name;delete details.investor_id;}
  if(details.trade_in&&!['LOJA','REPASSE','INVESTIDOR'].includes(details.trade_destination||''))throw new Error('Selecione quem fica com o carro da troca.');
  if(details.trade_in&&details.trade_destination==='INVESTIDOR'&&!details.trade_investor_name)throw new Error('Informe o investidor que fica com a troca.');
  if(details.trade_destination!=='INVESTIDOR'){delete details.trade_investor_name;delete details.trade_investor_id;}
  if(details.sale_mode==='REPASSE'&&(!details.stock_id||details.sale_owner!=='LOJA'||details.trade_in||details.commission_cents!==0))throw new Error('Abra o repasse a partir do carro no estoque. Repasse não tem custo fixo de vendedor nem nova troca.');
 }
 if(details.sale_cost_id&&(!validId(details.sale_cost_id)||!['CUSTOS','INVESTIDOR','CAPITAL'].includes(details.settlement_part||'')||details.stock_id))throw new Error('Confira a venda vinculada e a finalidade da saída.');
 if(details.settlement_part&&!details.sale_cost_id)throw new Error('Selecione a venda desta saída.');
 for(const key of ['investor_id','trade_investor_id'] as const)if(details[key]&&!validId(details[key]))throw new Error('Selecione um investidor cadastrado.');
 if(details.stock_id&&!validId(details.stock_id))throw new Error('Veículo de estoque inválido.');
 if(details.vehicle_spec)details.vehicle=(details.vehicle_spec.brand+' '+(details.vehicle_spec.version||details.vehicle_spec.model)).slice(0,160);
 if(details.trade_spec){details.trade_vehicle=(details.trade_spec.brand+' '+(details.trade_spec.version||details.trade_spec.model)).slice(0,160);if(details.trade_spec.year!==null)details.trade_year=details.trade_spec.year;}
 if(details.plate){details.plate=details.plate.toUpperCase();if(!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(details.plate))throw new Error('Confira a placa.');}
 if(['VENDA','RETORNO','TROCA'].includes(kind)&&!details.vehicle)throw new Error('Informe o carro.');
 if(kind==='VENDA'&&['purchase_cents','vehicle_cost_cents','commission_cents','sale_cents'].some(k=>details[k as keyof AdminDetails]===undefined))throw new Error('Informe compra, custos, comissão e venda.');
 if(kind==='VENDA'&&details.trade_in!==undefined){
  if(!details.trade_in){for(const key of Object.keys(details))if(key.startsWith('trade_')&&key!=='trade_in')delete details[key as keyof AdminDetails];}
  else {
   if(!details.trade_vehicle||!details.trade_plate||!details.trade_year||!details.trade_value_cents||typeof details.trade_has_debts!=='boolean')throw new Error('Informe modelo, placa, ano, valor da troca e se há débitos.');
   details.trade_plate=details.trade_plate.toUpperCase();if(!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(details.trade_plate))throw new Error('Confira a placa do carro da troca.');
   if(!details.trade_has_debts){for(const key of ['trade_ipva_cents','trade_fines_cents','trade_has_payoff','trade_payoff_cents','trade_payoff_bank','trade_payoff_bank_other'] as const)delete details[key];}
   else {
    if(details.trade_ipva_cents===undefined||details.trade_fines_cents===undefined||typeof details.trade_has_payoff!=='boolean')throw new Error('Informe IPVA, multas e se há quitação. Use 0,00 quando não houver.');
    if(!details.trade_has_payoff){delete details.trade_payoff_cents;delete details.trade_payoff_bank;delete details.trade_payoff_bank_other;}
    else if(!details.trade_payoff_cents||!details.trade_payoff_bank||!validVehicleBank(details.trade_payoff_bank)||details.trade_payoff_bank==='OUTRO'&&!details.trade_payoff_bank_other)throw new Error('Informe banco e valor da quitação.');
    if(details.trade_payoff_bank!=='OUTRO')delete details.trade_payoff_bank_other;
    if(adminSaleSettlement(Number(details.sale_cents),details).debt===0)throw new Error('Informe pelo menos um débito ou selecione Não.');
   }
  }
  const settlement=adminSaleSettlement(Number(details.sale_cents),details);
  if(Number(amount_cents)>settlement.remaining)throw new Error('O valor recebido supera o restante após a troca.');
  if(!['PIX','DINHEIRO','CARTAO','FINANCIAMENTO','SEM_DIFERENCA'].includes(details.payment_method||''))throw new Error('Selecione a forma de pagamento.');
  if(details.payment_method==='SEM_DIFERENCA'&&settlement.remaining!==0)throw new Error('Existe uma diferença a pagar. Selecione a forma de pagamento.');
  if(details.payment_method==='FINANCIAMENTO'){
   if(!details.payment_bank||!validVehicleBank(details.payment_bank)||details.payment_bank==='OUTRO'&&!details.payment_bank_other)throw new Error('Selecione o banco do financiamento.');
   if(details.payment_bank!=='OUTRO')delete details.payment_bank_other;
  }else{delete details.payment_bank;delete details.payment_bank_other;}
 }
 if(kind==='RETORNO'&&(Number(details.tax_cents||0)+Number(details.manager_cents||0)+Number(details.seller_cents||0)>Number(amount_cents)))throw new Error('Imposto e repasses não podem superar o retorno recebido.');
 if(details.expense_audience!==undefined&&(scope!=='PESSOAL'||!expenseAudiences.includes(details.expense_audience)))throw new Error('Confira o contexto pessoal.');
 if(details.expense_nature!==undefined&&(scope!=='PESSOAL'||!expenseNatures.includes(details.expense_nature)))throw new Error('Confira a classificação do gasto.');
 if(details.trip_name){if(scope!=='PESSOAL')throw new Error('Viagens pessoais pertencem ao escopo Pessoal.');details.trip_name=tripName(details.trip_name);}
 const resolvedCategory=scope==='PESSOAL'?personalCategory(category,description):category;
 const expected=body.expected_updated_at===null?null:text(body.expected_updated_at,50);
 if(expected!==null&&(!expected||!Number.isFinite(Date.parse(expected))))throw new Error('Reabra o lançamento antes de salvar.');
 return {id,kind,scope,entry_date,description,category:resolvedCategory,status,amount_cents,details,expected_updated_at:expected};
}
export function adminArchiveInput(body:Record<string,unknown>){const id=text(body.id,36),expected=text(body.expected_updated_at,50);if(!validId(id)||typeof body.active!=='boolean'||!expected||!Number.isFinite(Date.parse(expected)))throw new Error('Reabra o lançamento antes de arquivar ou restaurar.');return {id,active:body.active,expected_updated_at:expected};}
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
