import {personalCategories,personalCategory,personalSummary,tripName} from './personal-expenses.ts';
import {canBank,brazilDay,currency,installmentStatus,type BankRole,type BankData} from './model.ts';
import {realDate} from './contracts.ts';
import {adminStats,saleProfit} from './administrative.ts';
import {cashPosition,type CashEntry} from './cash.ts';
import {payableState,type Payable} from './payables.ts';
import {receivableState,receivableRemaining,type Receivable} from './receivables.ts';
import type {StockRow} from './stock.ts';

const sections={despesas_pessoais:'administrativo',administrativo:'administrativo',investidores:'administrativo',caixa:'administrativo',contas_pagar:'administrativo',contas_receber:'administrativo',carteira:'dashboard',clientes:'clientes',contratos:'contratos',parcelas:'parcelas',pagamentos:'pagamentos',comprovantes:'comprovantes',inadimplencia:'inadimplencia',veiculos:'veiculos',relatorios:'relatorios',funcionarios:'funcionarios',vendedores:'funcionarios',configuracoes:'configuracoes'} as const;
export type AssistantTopic=keyof typeof sections;
export class AssistantDataError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type AssistantReadInput={topic:AssistantTopic;period:'total'|'mes_atual'|'mes_anterior'|'personalizado';from:string;to:string;scope:'TODOS'|'LOJA'|'PESSOAL';search:string;limit:number;category?:string;trip?:string};
export function assistantReadTool(role:BankRole){return {type:'function' as const,name:'consultar_dados_icom',description:'Consulta somente leitura dos dados atuais do ICOM Bank, com as permissões da conta. Use antes de responder valores, saldos, quantidades, nomes ou situações reais. Administrativo inclui lucro líquido das vendas, despesas pessoais/loja e saldo livre. Contas_pagar e contas_receber consultam as agendas. Carteira e relatórios são os contratos parcelados, diferentes das vendas administrativas. Investidores consulta nomes e quantidade. Vendedores consulta apenas os vendedores ativos. Para saldo disponível use caixa, que é mais rápido e não busca contas ou estoque. Para gasto pessoal por categoria ou viagem use despesas_pessoais: soma todos os pagamentos realizados do filtro, sem contar previstos/arquivados. category e trip são filtros independentes; sem período informado usa todo histórico. Não altera dados.',parameters:{type:'object',additionalProperties:false,properties:{category:{type:'string',enum:[...personalCategories],description:'Somente em despesas_pessoais. Categoria exata solicitada, por exemplo Restaurante.'},trip:{type:'string',description:'Somente em despesas_pessoais. Nome exato da viagem, por exemplo Disney 2026. Se disser nesta viagem sem nome, pergunte qual.'},topic:{type:'string',enum:Object.keys(sections).filter(t=>canBank(role,sections[t as AssistantTopic]))},period:{type:'string',enum:['total','mes_atual','mes_anterior','personalizado'],description:'Sem período informado use total. Para mês atual/anterior use essas opções. Datas só em personalizado.'},from:{type:'string',description:'Data inicial YYYY-MM-DD apenas para período personalizado.'},to:{type:'string',description:'Data final YYYY-MM-DD apenas para período personalizado.'},scope:{type:'string',enum:['TODOS','LOJA','PESSOAL'],description:'PESSOAL para despesas da casa/Bruno/Gisela; LOJA para despesas da loja.'},search:{type:'string',description:'Parte do nome, veículo ou número de contrato. Não informe CPF, e-mail, telefone ou credenciais.'},limit:{type:'integer',minimum:1,maximum:25}},required:['topic']}};}
export function assistantReadInput(raw:unknown,role:BankRole,today=brazilDay()):AssistantReadInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AssistantDataError('Consulta inválida.');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['topic','period','from','to','scope','search','limit','category','trip'].includes(k))||typeof b.topic!=='string'||!Object.hasOwn(sections,b.topic))throw new AssistantDataError('Escolha uma consulta disponível no sistema.');
 const topic=b.topic as AssistantTopic;if(!canBank(role,sections[topic]))throw new AssistantDataError('Sua conta não tem acesso a estes dados.',403);
 const period=b.period??'total',scope=b.scope??'TODOS',limit=b.limit??20,search=b.search??'';
 if(!['total','mes_atual','mes_anterior','personalizado'].includes(String(period))||!['TODOS','LOJA','PESSOAL'].includes(String(scope))||typeof limit!=='number'||!Number.isInteger(limit)||limit<1||limit>25||typeof search!=='string'||search.length>80||search&&!/^[\p{L}\p{N} .-]+$/u.test(search))throw new AssistantDataError('Confira período, área e busca da consulta.');
 if((b.category!==undefined||b.trip!==undefined)&&topic!=='despesas_pessoais')throw new AssistantDataError('Use a consulta de despesas pessoais para categoria ou viagem.');
 if(b.category!==undefined&&(typeof b.category!=='string'||!personalCategories.includes(b.category as typeof personalCategories[number])))throw new AssistantDataError('Selecione uma categoria pessoal.');
 let trip='';try{trip=tripName(b.trip);}catch{throw new AssistantDataError('Confira o nome da viagem.');}
 let from='2000-01-01',to='2100-12-31';
 if(period==='personalizado'){if(typeof b.from!=='string'||typeof b.to!=='string'||!realDate(b.from)||!realDate(b.to)||b.from>b.to||b.from<from||b.to>to)throw new AssistantDataError('Confira as datas inicial e final.');from=b.from;to=b.to;}
 else {if(b.from!==undefined||b.to!==undefined)throw new AssistantDataError('Datas exigem período personalizado.');if(period!=='total'){const [y,m]=today.split('-').map(Number),offset=period==='mes_anterior'?-1:0;from=new Date(Date.UTC(y,m-1+offset,1,12)).toISOString().slice(0,10);to=new Date(Date.UTC(y,m+offset,0,12)).toISOString().slice(0,10);}}
 return {topic,period:period as AssistantReadInput['period'],from,to,scope:scope as AssistantReadInput['scope'],search:search.trim(),limit,...(b.category?{category:b.category as string}:{}),...(trip?{trip}:{})};
}
type Row=Record<string,unknown>;
export type AssistantReader={rows:(path:string)=>Promise<unknown[]>;ledger:()=>Promise<CashEntry[]>;staff:()=>Promise<unknown[]>};
const money=(n:number)=>{if(!Number.isSafeInteger(n))throw new AssistantDataError('Um valor cadastrado precisa de conferência.',409);return {centavos:n,valor:currency(n)};};
const total=(rows:Row[],key:string)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
const text=(v:unknown,max=160)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,max);
const fold=(v:unknown)=>text(v,500).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
const match=(input:AssistantReadInput,...values:unknown[])=>!input.search||values.some(v=>fold(v).includes(fold(input.search)));
const inPeriod=(input:AssistantReadInput,date:unknown)=>typeof date==='string'&&date.slice(0,10)>=input.from&&date.slice(0,10)<=input.to;
const scopeMatch=(input:AssistantReadInput,scope:unknown)=>input.scope==='TODOS'||input.scope===(scope||'LOJA');
const list=(rows:unknown[],input:AssistantReadInput)=>({quantidade:rows.length,exibidos:Math.min(rows.length,input.limit),lista_limitada:rows.length>input.limit,registros:rows.slice(0,input.limit)});
const counts=(rows:Row[],key='status')=>rows.reduce<Record<string,number>>((out,r)=>{const s=text(r[key],50)||'SEM_SITUACAO';out[s]=(out[s]||0)+1;return out;},{});
async function readRows(reader:AssistantReader,table:string,select:string,order='id.asc'){return await reader.rows(`${table}?select=${select}&order=${order}`) as Row[];}

// Queries use the caller's JWT. No SQL, table, field, role or write action comes from the model.
export async function readAssistantData(reader:AssistantReader,raw:unknown,role:BankRole,today=brazilDay()){
 const input=assistantReadInput(raw,role,today),meta={consulta:input.topic,consultado_em:new Date().toISOString(),hoje:today,periodo:input.period==='total'?'Todo o histórico cadastrado; contas futuras também podem estar incluídas':`${input.from} a ${input.to}`,escopo:input.scope,fonte:'Registros do ICOM Bank, não extrato bancário',somente_leitura:true};
 const result=(data:unknown)=>({ok:true,...meta,dados:data});
 if(input.topic==='despesas_pessoais'){
  if(input.scope==='LOJA')throw new AssistantDataError('Esta consulta é de despesas pessoais.');
  const entries=(await reader.ledger()).filter(e=>match(input,e.description,e.category,e.details.trip_name));
  const summary=personalSummary(entries,input.category,input.trip,input.from,input.to);
  return result({categoria:input.category||'Todas',viagem:input.trip||'Todas / sem viagem',total_pago:money(summary.amount_cents),total_parcial:summary.missing>0,sem_valor:summary.missing,regra:'Somente despesas pessoais realizadas e ativas. Soma todos os registros do filtro, inclusive os que não cabem na lista. Categoria e viagem agrupam os mesmos gastos; não some os dois resumos.',por_categoria:summary.categories.map(g=>({categoria:g.name,total:money(g.amount_cents),quantidade:g.count})),por_viagem:summary.trips.map(g=>({viagem:g.name,total:money(g.amount_cents),quantidade:g.count})),...list(summary.rows.map(e=>({data:e.entry_date,descricao:text(e.description),categoria:personalCategory(e.category,e.description),viagem:e.details.trip_name||null,valor:money(Number(e.amount_cents||0))})),input)});
 }
 if(input.topic==='caixa'){
  const entries=await reader.ledger(),cutoff=input.period==='total'?today:input.to,cash=cashPosition(entries,cutoff);
  return result({data_corte:cutoff,saldo_livre:money(cash.available),saldo_registrado:money(cash.gross),reservado_investidores:money(cash.investor),reservado_capital:money(cash.capital),reservado_custos:money(cash.costs),aguardando_revisao:money(cash.review),observacao:'Saldo livre acumulado até a data de corte, descontadas as reservas. Não é consulta ao saldo bancário.'});
 }
 if(input.topic==='administrativo'||input.topic==='contas_pagar'){
  const [entries,payables,stocks]=await Promise.all([reader.ledger(),readRows(reader,'icom_bank_payables','id,stock_id,kind,scope,person,title,amount_cents,due_date,active,status,paid_at,created_at','due_date.asc,id.asc'),readRows(reader,'icom_bank_stock_vehicles','id,active,status')]);
  const stockMap=new Map(stocks.map(s=>[s.id,s]));
  const valid=payables.filter(p=>p.active&&(!p.stock_id||stockMap.get(p.stock_id)?.active&&stockMap.get(p.stock_id)?.status!=='PREVISTO'));
  const pending=valid.filter(p=>p.status==='PENDENTE'&&(input.period==='total'||inPeriod(input,p.due_date))&&scopeMatch(input,p.scope));
  const selected=entries.filter(e=>inPeriod(input,e.entry_date)),stats=adminStats(selected,''),cash=cashPosition(entries,input.period==='total'?today:input.to);
  if(input.topic==='administrativo'){
   const storePending=pending.filter(p=>p.scope!=='PESSOAL'),personalPending=pending.filter(p=>p.scope==='PESSOAL');
   const sales=selected.filter(e=>e.active&&e.status==='REALIZADO'&&e.kind==='VENDA'&&match(input,e.details.vehicle,e.details.plate,e.details.seller,e.details.investor_name));
   return result({vendas:{lucro_liquido_loja:money(sales.reduce((n,e)=>n+saleProfit(e),0)),faturamento:money(sales.reduce((n,e)=>n+Number(e.details.sale_cents||0),0)),regra:'Lucro = venda menos compra, custos do veículo e comissão. Não é total recebido nem saldo disponível.',...list(sales.map(e=>({carro:text(e.details.vehicle),placa:text(e.details.plate,7),vendedor:text(e.details.seller),data:e.entry_date,lucro:money(saleProfit(e)),situacao:e.status})),input)},despesas_loja:input.scope==='PESSOAL'?undefined:{pagas:money(stats.expenses),pendentes_agenda:money(total(storePending,'amount_cents')),pagas_mais_pendentes:money(stats.expenses+total(storePending,'amount_cents'))},despesas_pessoais:input.scope==='LOJA'?undefined:{pagas:money(stats.personal),pendentes_agenda:money(total(personalPending,'amount_cents')),pagas_mais_pendentes:money(stats.personal+total(personalPending,'amount_cents'))},caixa:{data_corte:input.period==='total'?today:input.to,saldo_registrado:money(cash.gross),saldo_livre:money(cash.available),reservado_investidores:money(cash.investor),reservado_capital:money(cash.capital),reservado_custos:money(cash.costs),aguardando_revisao:money(cash.review),observacao:'Saldo acumulado até a data de corte, descontando reservas. Lucro de vendas não significa dinheiro integralmente recebido.'}});
  }
  const rows=valid.filter(p=>scopeMatch(input,p.scope)&&(input.period==='total'||inPeriod(input,p.status==='PAGO'?p.paid_at:p.due_date))&&match(input,p.title,p.kind,p.person));
  return result({...list(rows.map(p=>({titulo:text(p.title||p.kind),area:p.scope||'LOJA',pessoa:p.person,valor:money(Number(p.amount_cents)),vencimento:p.due_date,pago_em:p.paid_at,situacao:payableState(p as unknown as Payable,p.stock_id?stockMap.get(p.stock_id) as unknown as StockRow:undefined,today)})),input),pendente:money(total(rows.filter(p=>p.status==='PENDENTE'),'amount_cents')),vencido:money(total(rows.filter(p=>p.status==='PENDENTE'&&typeof p.due_date==='string'&&p.due_date<today),'amount_cents')),pago:money(total(rows.filter(p=>p.status==='PAGO'),'amount_cents'))});
 }
 if(input.topic==='investidores'){
  const rows=(await readRows(reader,'icom_bank_investors','id,name,active','name.asc,id.asc')).filter(r=>match(input,r.name));
  const active=rows.filter(r=>r.active);return result({cadastrados:rows.length,ativos:active.length,inativos:rows.length-active.length,...list(active.map(r=>({nome:text(r.name)})),input)});
 }
 if(input.topic==='contas_receber'){
  const [rows,entries]=await Promise.all([readRows(reader,'icom_bank_receivables','id,source_entry_id,title,payer,kind,bank,amount_cents,received_cents,due_date,active','due_date.asc,id.asc'),reader.ledger()]);
  const sources=new Map(entries.map(e=>[e.id,e]));
  const selected=rows.filter(r=>r.active&&(!r.source_entry_id||sources.get(String(r.source_entry_id))?.active&&sources.get(String(r.source_entry_id))?.status==='REALIZADO')&&(input.period==='total'||inPeriod(input,r.due_date))&&match(input,r.title,r.payer,r.bank));
  return result({...list(selected.map(r=>({titulo:text(r.title),pagador:text(r.payer),banco:text(r.bank),valor:money(Number(r.amount_cents)),recebido:money(Number(r.received_cents)),saldo:money(receivableRemaining(r as unknown as Receivable)),vencimento:r.due_date,situacao:receivableState(r as unknown as Receivable,sources.get(String(r.source_entry_id)),today)})),input),saldo_pendente:money(selected.reduce((n,r)=>n+receivableRemaining(r as unknown as Receivable),0))});
 }
 if(input.topic==='clientes'){
  const rows=(await readRows(reader,'icom_bank_customers','id,name,status,created_at','name.asc,id.asc')).filter(r=>inPeriod(input,r.created_at)&&match(input,r.name));
  return result({...list(rows.map(r=>({nome:text(r.name),situacao:r.status,cadastro:String(r.created_at).slice(0,10)})),input),por_situacao:counts(rows)});
 }
 if(input.topic==='funcionarios'||input.topic==='vendedores'){
  const rows=(await reader.staff() as Row[]).filter(r=>match(input,r.name)&&(input.topic!=='vendedores'||r.active&&r.role==='VENDEDOR'));
  return result({...list(rows.map(r=>({nome:text(r.name),perfil:r.role,ativo:r.active})),input),ativos:rows.filter(r=>r.active).length});
 }
 if(input.topic==='configuracoes'){
  const rows=await readRows(reader,'icom_bank_system_settings','id,company_name,pix_type');
  return result({empresa:text(rows[0]?.company_name),tipo_pix:text(rows[0]?.pix_type),observacao:'Chaves Pix, contas, credenciais e tokens não são enviados ao assistente. Confira os dados de pagamento na tela Configurações.'});
 }
 if(input.topic==='veiculos'){
  const rows=(await readRows(reader,'icom_bank_vehicles','id,brand,model,plate','brand.asc,id.asc')).filter(r=>match(input,r.brand,r.model,r.plate));
  const data:Record<string,unknown>={veiculos_dos_contratos:list(rows.map(r=>({marca:text(r.brand),modelo:text(r.model),placa:text(r.plate,7)})),input)};
  if(role==='OWNER'){
   const stocks=(await readRows(reader,'icom_bank_stock_vehicles','id,plate,vehicle,status,active,entry_date','entry_date.desc,id.asc')).filter(r=>r.active&&inPeriod(input,r.entry_date)&&match(input,r.plate,JSON.stringify(r.vehicle)));
   data.estoque_trocas=list(stocks.map(r=>{const v=(r.vehicle||{}) as Row;return {marca:text(v.brand),modelo:text(v.model),versao:text(v.version),ano:v.year,placa:text(r.plate,7),situacao:r.status};}),input);
  }return result(data);
 }
 // The remaining topics reuse the contract/portfolio model. Select only fields needed for totals.
 const contracts=await readRows(reader,'icom_bank_contracts','id,customer_id,number,status,principal_cents,total_cents,sale_date','sale_date.desc,id.asc');
 const names=canBank(role,'clientes')?await readRows(reader,'icom_bank_customers','id,name','name.asc,id.asc'):[];
 const customerNames=new Map(names.map(r=>[r.id,text(r.name)])),contractMap=new Map(contracts.map(r=>[r.id,r]));
 const allowedSearch=(c:Row)=>match(input,c.number,customerNames.get(c.customer_id));
 if(input.topic==='contratos'){
  const rows=contracts.filter(c=>inPeriod(input,c.sale_date)&&allowedSearch(c));
  return result({...list(rows.map(c=>({numero:c.number,cliente:customerNames.get(c.customer_id),situacao:c.status,data_venda:c.sale_date,financiado:money(Number(c.principal_cents)),total_contratado:money(Number(c.total_cents))})),input),por_situacao:counts(rows)});
 }
 const installments=await readRows(reader,'icom_bank_installments','id,contract_id,number,due_date,original_cents,updated_cents,paid_cents,paid_at,status','due_date.asc,id.asc');
 const active=new Set(contracts.filter(c=>c.status==='ATIVO').map(c=>c.id));
 const open=installments.filter(i=>active.has(i.contract_id)&&!['PAGO','CANCELADO','RENEGOCIADO'].includes(String(i.status))&&Number(i.updated_cents)>Number(i.paid_cents));
 const selectedInstallments=installments.filter(i=>inPeriod(input,i.due_date)&&allowedSearch(contractMap.get(i.contract_id)||{}));
 const balance=(rows:Row[])=>rows.reduce((n,i)=>n+Math.max(0,Number(i.updated_cents)-Number(i.paid_cents)),0);
 if(input.topic==='parcelas'||input.topic==='inadimplencia'){
  const rows=input.topic==='inadimplencia'?open.filter(i=>String(i.due_date)<today&&inPeriod(input,i.due_date)&&allowedSearch(contractMap.get(i.contract_id)||{})):selectedInstallments;
  return result({...list(rows.map(i=>({contrato:contractMap.get(i.contract_id)?.number,cliente:customerNames.get(contractMap.get(i.contract_id)?.customer_id),parcela:i.number,vencimento:i.due_date,situacao:installmentStatus(i as unknown as BankData['installments'][number],today),saldo:money(Math.max(0,Number(i.updated_cents)-Number(i.paid_cents)))})),input),saldo:money(balance(rows))});
 }
 const payments=await readRows(reader,'icom_bank_payments','id,installment_id,amount_cents,paid_at,status','paid_at.desc,id.asc');
 const proofs=await readRows(reader,'icom_bank_payment_proofs','id,installment_id,informed_cents,status,created_at','created_at.desc,id.asc');
 const installmentMap=new Map(installments.map(i=>[i.id,i]));
 const relation=(r:Row)=>{const i=installmentMap.get(r.installment_id),c=contractMap.get(i?.contract_id);return {i,c};};
 if(input.topic==='pagamentos'||input.topic==='comprovantes'){
  const rows=(input.topic==='pagamentos'?payments:proofs).filter(r=>inPeriod(input,input.topic==='pagamentos'?r.paid_at:r.created_at)&&allowedSearch(relation(r).c||{}));
  return result({...list(rows.map(r=>{const {i,c}=relation(r);return {contrato:c?.number,cliente:customerNames.get(c?.customer_id),parcela:i?.number,data:input.topic==='pagamentos'?r.paid_at:String(r.created_at).slice(0,10),situacao:r.status,valor:money(Number(input.topic==='pagamentos'?r.amount_cents:r.informed_cents))};}),input),por_situacao:counts(rows),confirmado:input.topic==='pagamentos'?money(total(rows.filter(r=>r.status!=='ESTORNADO'),'amount_cents')):undefined});
 }
 const sales=contracts.filter(c=>c.status!=='CANCELADO'&&inPeriod(input,c.sale_date)&&allowedSearch(c)),received=payments.filter(p=>p.status!=='ESTORNADO'&&inPeriod(input,p.paid_at)&&allowedSearch(relation(p).c||{})),visibleOpen=open.filter(i=>allowedSearch(contractMap.get(i.contract_id)||{}));
 return result({clientes_com_contrato_ativo:new Set(contracts.filter(c=>c.status==='ATIVO').map(c=>c.customer_id)).size,contratos_ativos:contracts.filter(c=>c.status==='ATIVO').length,contratos_no_periodo:sales.length,financiado_no_periodo:money(total(sales,'principal_cents')),recebido_no_periodo:money(total(received,'amount_cents')),carteira_atual_a_receber:money(balance(visibleOpen)),parcelas_vencidas:visibleOpen.filter(i=>String(i.due_date)<today).length,saldo_vencido:money(balance(visibleOpen.filter(i=>String(i.due_date)<today))),comprovantes_pendentes:proofs.filter(p=>p.status==='COMPROVANTE_ENVIADO').length,observacao:'Carteira atual e atraso são a posição de hoje. Recebimentos e contratos respeitam o período. Estes são contratos parcelados, não lucro das vendas administrativas.'});
}
