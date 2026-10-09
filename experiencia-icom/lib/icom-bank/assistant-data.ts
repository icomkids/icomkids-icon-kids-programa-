import {accountSummary,type BankAccount,type AccountLink} from './accounts.ts';
import type {RentDue} from './property.ts';
import {expenseAudiences,expenseNatures,type ExpenseAudience,type ExpenseNature} from './expense-context.ts';
import {personalCategories,personalCategory,personalSummary,tripName} from './personal-expenses.ts';
import {canBank,brazilDay,currency,installmentStatus,type BankRole,type BankData} from './model.ts';
import {realDate} from './contracts.ts';
import {adminStats,saleProfit} from './administrative.ts';
import {wealthSummary,type WealthRecord} from './personal-wealth.ts';
import {financialOverview} from './financial-overview.ts';
import {cashPosition,type CashEntry} from './cash.ts';
import {payableState,type Payable} from './payables.ts';
import {receivableState,receivableRemaining,type Receivable} from './receivables.ts';
import type {StockRow} from './stock.ts';

const sections={contas_bancarias:'administrativo',alugueis:'administrativo',patrimonio_pessoal:'administrativo',rendas_pessoais:'administrativo',resultado_empresa:'administrativo',despesas_loja:'administrativo',lancamentos:'administrativo',despesas_pessoais:'administrativo',administrativo:'administrativo',investidores:'administrativo',caixa:'administrativo',contas_pagar:'administrativo',contas_receber:'administrativo',carteira:'dashboard',clientes:'clientes',contratos:'contratos',parcelas:'parcelas',pagamentos:'pagamentos',comprovantes:'comprovantes',inadimplencia:'inadimplencia',veiculos:'veiculos',relatorios:'relatorios',funcionarios:'funcionarios',vendedores:'funcionarios',configuracoes:'configuracoes'} as const;
export type AssistantTopic=keyof typeof sections;
export class AssistantDataError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export type AssistantReadInput={topic:AssistantTopic;period:'total'|'mes_atual'|'mes_anterior'|'personalizado';from:string;to:string;scope:'TODOS'|'LOJA'|'PESSOAL';search:string;limit:number;offset?:number;situation?:'TODOS'|'PENDENTES'|'PAGOS'|'VENCIDOS';category?:string;trip?:string;audience?:ExpenseAudience;nature?:ExpenseNature};
export function assistantReadTool(role:BankRole){return {type:'function' as const,name:'consultar_dados_icom',description:'Consulta somente leitura dos dados atuais do ICOM Bank, com as permissões da conta. Use antes de responder valores, saldos, quantidades, nomes ou situações reais. Administrativo inclui lucro líquido das vendas, despesas pessoais/loja e saldo livre. Contas_pagar e contas_receber consultam as agendas. Carteira e relatórios são os contratos parcelados, diferentes das vendas administrativas. Investidores consulta nomes e quantidade. Vendedores consulta apenas os vendedores ativos. Para saldo disponível use caixa, que é mais rápido e não busca contas ou estoque. Para gasto pessoal por categoria ou viagem use despesas_pessoais: soma todos os pagamentos realizados do filtro, sem contar previstos/arquivados. category e trip são filtros independentes; sem período informado usa todo histórico. Para os cartões da nova Visão Geral use resultado_empresa. Para bens e investimentos pessoais use patrimonio_pessoal; rendimentos externos recebidos usam rendas_pessoais. Para saldos por banco use contas_bancarias; para agenda de aluguel use alugueis. Não altera dados.',parameters:{type:'object',additionalProperties:false,properties:{offset:{type:'integer',minimum:0,maximum:99999,description:'Próxima página da lista; totais continuam considerando todos os registros.'},situation:{type:'string',enum:['TODOS','PENDENTES','PAGOS','VENCIDOS'],description:'Use PENDENTES para parcelas a receber, contas a pagar ou receber abertas; VENCIDOS para atrasos.'},audience:{type:'string',enum:[...expenseAudiences],description:'Despesas pessoais: FAMILIA para gastos com a família.'},nature:{type:'string',enum:[...expenseNatures],description:'Despesas pessoais: OPCIONAL para gastos opcionais/supérfluos. Não classifique todos os restaurantes como supérfluos.'},category:{type:'string',enum:[...personalCategories],description:'Categoria exata em despesas_pessoais; nas despesas_loja pode usar search para categoria, descrição ou placa.'},trip:{type:'string',description:'Somente em despesas_pessoais. Nome exato da viagem, por exemplo Disney 2026. Se disser nesta viagem sem nome, pergunte qual.'},topic:{type:'string',enum:Object.keys(sections).filter(t=>canBank(role,sections[t as AssistantTopic]))},period:{type:'string',enum:['total','mes_atual','mes_anterior','personalizado'],description:'Sem período informado use total. Para mês atual/anterior use essas opções. Datas só em personalizado.'},from:{type:'string',description:'Data inicial YYYY-MM-DD apenas para período personalizado.'},to:{type:'string',description:'Data final YYYY-MM-DD apenas para período personalizado.'},scope:{type:'string',enum:['TODOS','LOJA','PESSOAL'],description:'PESSOAL para despesas da casa/Bruno/Gisela; LOJA para despesas da loja.'},search:{type:'string',description:'Parte do nome, veículo ou número de contrato. Não informe CPF, e-mail, telefone ou credenciais.'},limit:{type:'integer',minimum:1,maximum:25}},required:['topic']}};}
export function assistantReadInput(raw:unknown,role:BankRole,today=brazilDay()):AssistantReadInput{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AssistantDataError('Consulta inválida.');
 const b=raw as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['topic','period','from','to','scope','search','limit','category','trip','audience','nature','offset','situation'].includes(k))||typeof b.topic!=='string'||!Object.hasOwn(sections,b.topic))throw new AssistantDataError('Escolha uma consulta disponível no sistema.');
 const topic=b.topic as AssistantTopic;if(!canBank(role,sections[topic]))throw new AssistantDataError('Sua conta não tem acesso a estes dados.',403);
 const offset=b.offset??0,situation=b.situation??'TODOS';if(typeof offset!=='number'||!Number.isInteger(offset)||offset<0||offset>99999||!['TODOS','PENDENTES','PAGOS','VENCIDOS'].includes(String(situation)))throw new AssistantDataError('Confira a página e a situação.');
 const period=b.period??'total',scope=b.scope??'TODOS',limit=b.limit??20,search=b.search??'';
 if(!['total','mes_atual','mes_anterior','personalizado'].includes(String(period))||!['TODOS','LOJA','PESSOAL'].includes(String(scope))||typeof limit!=='number'||!Number.isInteger(limit)||limit<1||limit>25||typeof search!=='string'||search.length>80||search&&!/^[\p{L}\p{N} .-]+$/u.test(search))throw new AssistantDataError('Confira período, área e busca da consulta.');
 if((b.category!==undefined||b.trip!==undefined||b.audience!==undefined||b.nature!==undefined)&&topic!=='despesas_pessoais')throw new AssistantDataError('Use a consulta de despesas pessoais para categoria ou viagem.');
 if(b.category!==undefined&&(typeof b.category!=='string'||!personalCategories.includes(b.category as typeof personalCategories[number])))throw new AssistantDataError('Selecione uma categoria pessoal.');
 if(b.audience!==undefined&&!expenseAudiences.includes(b.audience as ExpenseAudience)||b.nature!==undefined&&!expenseNatures.includes(b.nature as ExpenseNature))throw new AssistantDataError('Confira o contexto do gasto pessoal.');
 let trip='';try{trip=tripName(b.trip);}catch{throw new AssistantDataError('Confira o nome da viagem.');}
 let from='2000-01-01',to='2100-12-31';
 if(period==='personalizado'){if(typeof b.from!=='string'||typeof b.to!=='string'||!realDate(b.from)||!realDate(b.to)||b.from>b.to||b.from<from||b.to>to)throw new AssistantDataError('Confira as datas inicial e final.');from=b.from;to=b.to;}
 else {if(b.from!==undefined||b.to!==undefined)throw new AssistantDataError('Datas exigem período personalizado.');if(period!=='total'){const [y,m]=today.split('-').map(Number),offset=period==='mes_anterior'?-1:0;from=new Date(Date.UTC(y,m-1+offset,1,12)).toISOString().slice(0,10);to=new Date(Date.UTC(y,m+offset,0,12)).toISOString().slice(0,10);}}
 return {topic,period:period as AssistantReadInput['period'],from,to,scope:scope as AssistantReadInput['scope'],search:search.trim(),limit,...(b.offset!==undefined?{offset}:{}),...(b.situation!==undefined?{situation:situation as AssistantReadInput['situation']}:{}),...(b.category?{category:b.category as string}:{}),...(trip?{trip}:{}),...(b.audience?{audience:b.audience as ExpenseAudience}:{}),...(b.nature?{nature:b.nature as ExpenseNature}:{})};
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
const list=(rows:unknown[],input:AssistantReadInput)=>{const offset=input.offset||0,registros=rows.slice(offset,offset+input.limit);return {quantidade:rows.length,exibidos:registros.length,lista_limitada:registros.length<rows.length,offset,proxima_pagina:offset+registros.length<rows.length?offset+registros.length:null,registros};};
const situationMatch=(input:AssistantReadInput,pending:boolean,paid:boolean,overdue:boolean)=>!input.situation||input.situation==='TODOS'||input.situation==='PENDENTES'&&pending||input.situation==='PAGOS'&&paid||input.situation==='VENCIDOS'&&overdue;
const counts=(rows:Row[],key='status')=>rows.reduce<Record<string,number>>((out,r)=>{const s=text(r[key],50)||'SEM_SITUACAO';out[s]=(out[s]||0)+1;return out;},{});
async function readRows(reader:AssistantReader,table:string,select:string,order='id.asc'){return await reader.rows(`${table}?select=${select}&order=${order}`) as Row[];}

// Queries use the caller's JWT. No SQL, table, field, role or write action comes from the model.
export async function readAssistantData(reader:AssistantReader,raw:unknown,role:BankRole,today=brazilDay()){
 const input=assistantReadInput(raw,role,today),meta={consulta:input.topic,consultado_em:new Date().toISOString(),hoje:today,periodo:input.period==='total'?'Todo o histórico cadastrado; contas futuras também podem estar incluídas':`${input.from} a ${input.to}`,escopo:input.scope,fonte:'Registros do ICOM Bank, não extrato bancário',somente_leitura:true};
 const result=(data:unknown)=>({ok:true,...meta,dados:data});
 if(input.topic==='contas_bancarias'){const [accounts,links,entries]=await Promise.all([readRows(reader,'icom_bank_accounts','*'),readRows(reader,'icom_bank_account_links','*','ledger_entry_id.asc'),reader.ledger()]);const s=accountSummary({accounts:accounts as BankAccount[],links:links as AccountLink[],entries},today);return result({saldo_registrado:money(s.gross),saldo_disponivel_total:money(s.available),reservado:money(s.reserved),sem_conta:money(s.unassigned),...list(s.rows.filter(a=>match(input,a.name,a.bank)&&scopeMatch(input,a.scope)).map(a=>({conta:a.name,banco:a.bank,area:a.scope,ativa:a.active,saldo:money(a.balance)})),input),regra:'Saldos por conta antes das reservas. Saldo disponível total desconta reservas. Não consulta bancos.'});}
 if(input.topic==='alugueis'){const rows=await readRows(reader,'icom_bank_rent_dues','*','due_date.asc,id.asc') as unknown as RentDue[],items=rows.filter(r=>r.active&&inPeriod(input,r.due_date)&&match(input,r.title)&&situationMatch(input,r.status==='PENDENTE',r.status==='RECEBIDO',r.status==='PENDENTE'&&r.due_date<today));return result({previsto_a_receber:money(items.filter(r=>r.status==='PENDENTE').reduce((n,r)=>n+Number(r.amount_cents),0)),...list(items.map(r=>({imovel:r.title,vencimento:r.due_date,valor:money(Number(r.amount_cents)),situacao:r.status,recebido_em:r.received_at})),input),regra:'Aluguel previsto não é dinheiro recebido. Confirme em Aluguéis a receber.'});}
 if(input.topic==='patrimonio_pessoal'||input.topic==='rendas_pessoais'){
  const all=await readRows(reader,'icom_bank_personal_wealth','id,kind,category,name,record_date,amount_cents,debt_cents,invested_cents,rate_percent,rate_period,source_id,active','record_date.desc,id.asc') as unknown as WealthRecord[];
  const filtered=all.filter(r=>r.active&&r.record_date<=today&&match(input,r.name,r.category));
  const totals=wealthSummary(filtered.filter(r=>r.kind==='ATIVO'||inPeriod(input,r.record_date)),'',today);
  const items=filtered.filter(r=>input.topic==='patrimonio_pessoal'?r.kind==='ATIVO':r.kind==='RENDA'&&inPeriod(input,r.record_date));
  return result({patrimonio_liquido_atual:money(totals.net),bens_e_saldos:money(totals.gross),dividas_vinculadas:money(totals.debt),capital_investido_cadastrado:money(totals.invested),renda_liquida_recebida_no_periodo:money(totals.income),regra:'Patrimônio é cadastro atual, não caixa. Rendas só incluem rendimento recebido, não aporte ou resgate do principal. Taxas são referências estimadas.',...list(items.map(r=>({nome:text(r.name),categoria:text(r.category),data:r.record_date,valor:money(Number(r.amount_cents)),tipo:r.kind})),input)});
 }
 if(input.topic==='resultado_empresa'){
  const entries=await reader.ledger();const s=financialOverview(entries,[],'',today,{from:input.from,to:input.to});
  return result({entradas_de_lucro:money(s.earnings),gastos_operacionais:money(s.costs),despesas_pessoais:money(s.personal),resultado_empresa:money(s.company),resultado_apos_pessoais:money(s.real),caixa_livre_acumulado:money(s.cash.available),regra:'Mesmo resumo da Visão Geral. Lucro do carro já desconta compra, custos e comissão. Baixas desses mesmos custos e capital de investidores não são outra despesa. Caixa é separado do lucro.'});
 }
 if(input.topic==='despesas_pessoais'){
  if(input.scope==='LOJA')throw new AssistantDataError('Esta consulta é de despesas pessoais.');
  const entries=(await reader.ledger()).filter(e=>match(input,e.description,e.category,e.details.trip_name));
  const summary=personalSummary(entries,input.category,input.trip,input.from,input.to,input.audience,input.nature),all=personalSummary(entries,input.category,input.trip,input.from,input.to);
  const unclassified=all.natures.find(g=>g.name==='NAO_CLASSIFICADO');
  return result({nao_classificados_no_periodo:{quantidade:unclassified?.count||0,total:money(unclassified?.amount_cents||0)},contexto:input.audience||'Todos',classificacao:input.nature||'Todas',contexto_ou_classificacao_inferidos:'Registros antigos sem marcação usam descrição e categoria; classificações explícitas prevalecem.',categoria:input.category||'Todas',viagem:input.trip||'Todas / sem viagem',total_pago:money(summary.amount_cents),total_parcial:summary.missing>0,sem_valor:summary.missing,regra:'Somente despesas pessoais realizadas e ativas. Soma todos os registros do filtro, inclusive os que não cabem na lista. Categoria e viagem agrupam os mesmos gastos; não some os dois resumos.',por_contexto:summary.audiences.map(g=>({contexto:g.name,total:money(g.amount_cents)})),por_classificacao:summary.natures.map(g=>({classificacao:g.name,total:money(g.amount_cents)})),por_categoria:summary.categories.map(g=>({categoria:g.name,total:money(g.amount_cents),quantidade:g.count})),por_viagem:summary.trips.map(g=>({viagem:g.name,total:money(g.amount_cents),quantidade:g.count})),...list(summary.rows.map(e=>({data:e.entry_date,descricao:text(e.description),categoria:personalCategory(e.category,e.description),viagem:e.details.trip_name||null,valor:money(Number(e.amount_cents||0))})),input)});
 }
 if(input.topic==='lancamentos'||input.topic==='despesas_loja'){
  const rows=(await reader.ledger()).filter(e=>e.active&&inPeriod(input,e.entry_date)&&scopeMatch(input,e.scope)&&match(input,e.description,e.category,e.details.plate,e.details.vehicle,e.details.seller)&&
   (input.topic!=='despesas_loja'||e.scope==='LOJA'&&['CUSTO','MENSAL','RETORNO'].includes(e.kind))&&situationMatch(input,e.status==='PREVISTO',e.status==='REALIZADO',false));
  const stats=adminStats(rows,'');
  return result({...list(rows.map(e=>({data:e.entry_date,tipo:e.kind,area:e.scope,descricao:text(e.description),categoria:text(e.category),placa:text(e.details.plate,7),valor:e.amount_cents===null?'Valor não informado':money(Number(e.amount_cents)),situacao:e.status})),input),total_despesas_loja:money(stats.expenses),total_despesas_pessoais:money(stats.personal),total_entradas:money(stats.income),total_previsto:money(stats.planned),sem_valor:stats.missing,regra:'Totais de todos os registros do filtro, sem limitar à página. Despesas de retorno incluem impostos e repasses; valor de retorno não é todo despesa. Lançamentos são registros, não extrato bancário.'});
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
  const selected=entries.filter(e=>inPeriod(input,e.entry_date)&&match(input,e.description,e.category,e.details.plate,e.details.vehicle,e.details.seller)),stats=adminStats(selected.filter(e=>!['SALDO_INICIAL','RENDA_PESSOAL'].includes(e.cash_account_purpose||'')),''),cash=cashPosition(entries,input.period==='total'?today:input.to);
  if(input.topic==='administrativo'){
   const storePending=pending.filter(p=>p.scope!=='PESSOAL'),personalPending=pending.filter(p=>p.scope==='PESSOAL');
   const sales=selected.filter(e=>e.active&&e.status==='REALIZADO'&&e.kind==='VENDA'&&match(input,e.details.vehicle,e.details.plate,e.details.seller,e.details.investor_name));
   return result({vendas:{lucro_liquido_loja:money(sales.reduce((n,e)=>n+saleProfit(e),0)),faturamento:money(sales.reduce((n,e)=>n+Number(e.details.sale_cents||0),0)),regra:'Lucro = venda menos compra, custos do veículo e comissão. Não é total recebido nem saldo disponível.',...list(sales.map(e=>({carro:text(e.details.vehicle),placa:text(e.details.plate,7),vendedor:text(e.details.seller),data:e.entry_date,lucro:money(saleProfit(e)),situacao:e.status})),input)},despesas_loja:input.scope==='PESSOAL'?undefined:{pagas:money(stats.expenses),pendentes_agenda:money(total(storePending,'amount_cents')),pagas_mais_pendentes:money(stats.expenses+total(storePending,'amount_cents'))},despesas_pessoais:input.scope==='LOJA'?undefined:{pagas:money(stats.personal),pendentes_agenda:money(total(personalPending,'amount_cents')),pagas_mais_pendentes:money(stats.personal+total(personalPending,'amount_cents'))},caixa:{data_corte:input.period==='total'?today:input.to,saldo_registrado:money(cash.gross),saldo_livre:money(cash.available),reservado_investidores:money(cash.investor),reservado_capital:money(cash.capital),reservado_custos:money(cash.costs),aguardando_revisao:money(cash.review),observacao:'Saldo acumulado até a data de corte, descontando reservas. Lucro de vendas não significa dinheiro integralmente recebido.'}});
  }
  const rows=valid.filter(p=>scopeMatch(input,p.scope)&&(input.period==='total'||inPeriod(input,p.status==='PAGO'?p.paid_at:p.due_date))&&match(input,p.title,p.kind,p.person)&&situationMatch(input,p.status==='PENDENTE',p.status==='PAGO',p.status==='PENDENTE'&&typeof p.due_date==='string'&&p.due_date<today));
  return result({...list(rows.map(p=>({titulo:text(p.title||p.kind),area:p.scope||'LOJA',pessoa:p.person,valor:money(Number(p.amount_cents)),vencimento:p.due_date,pago_em:p.paid_at,situacao:payableState(p as unknown as Payable,p.stock_id?stockMap.get(p.stock_id) as unknown as StockRow:undefined,today)})),input),pendente:money(total(rows.filter(p=>p.status==='PENDENTE'),'amount_cents')),vencido:money(total(rows.filter(p=>p.status==='PENDENTE'&&typeof p.due_date==='string'&&p.due_date<today),'amount_cents')),pago:money(total(rows.filter(p=>p.status==='PAGO'),'amount_cents'))});
 }
 if(input.topic==='investidores'){
  const rows=(await readRows(reader,'icom_bank_investors','id,name,active','name.asc,id.asc')).filter(r=>match(input,r.name));
  const active=rows.filter(r=>r.active);return result({cadastrados:rows.length,ativos:active.length,inativos:rows.length-active.length,...list(active.map(r=>({nome:text(r.name)})),input)});
 }
 if(input.topic==='contas_receber'){
  const [rows,entries]=await Promise.all([readRows(reader,'icom_bank_receivables','id,source_entry_id,title,payer,kind,bank,amount_cents,received_cents,due_date,active','due_date.asc,id.asc'),reader.ledger()]);
  const sources=new Map(entries.map(e=>[e.id,e]));
  const selected=rows.filter(r=>r.active&&(!r.source_entry_id||sources.get(String(r.source_entry_id))?.active&&sources.get(String(r.source_entry_id))?.status==='REALIZADO')&&(input.period==='total'||inPeriod(input,r.due_date))&&match(input,r.title,r.payer,r.bank)&&situationMatch(input,receivableRemaining(r as unknown as Receivable)>0,receivableRemaining(r as unknown as Receivable)<=0,receivableRemaining(r as unknown as Receivable)>0&&typeof r.due_date==='string'&&r.due_date<today));
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
   const stocks=(await readRows(reader,'icom_bank_stock_vehicles','id,plate,vehicle,status,active,entry_date,source_details,purchase_cents,debt_cents','entry_date.desc,id.asc')).filter(r=>r.active&&inPeriod(input,r.entry_date)&&match(input,r.plate,JSON.stringify(r.vehicle),(r.source_details as Row)?.trade_investor_name));
   data.estoque_trocas=list(stocks.map(r=>{const v=(r.vehicle||{}) as Row;return {marca:text(v.brand),modelo:text(v.model),versao:text(v.version),ano:v.year,placa:text(r.plate,7),situacao:r.status,destino:text((r.source_details as Row)?.trade_destination),investidor:text((r.source_details as Row)?.trade_investor_name),valor_entrada:r.purchase_cents===undefined?undefined:money(Number(r.purchase_cents)),debitos:r.debt_cents===undefined?undefined:money(Number(r.debt_cents))};}),input);
  }return result(data);
 }
 // The remaining topics reuse the contract/portfolio model. Select only fields needed for totals.
 const [contracts,names]=await Promise.all([readRows(reader,'icom_bank_contracts','id,customer_id,number,status,principal_cents,total_cents,sale_date','sale_date.desc,id.asc'),canBank(role,'clientes')?readRows(reader,'icom_bank_customers','id,name','name.asc,id.asc'):Promise.resolve([])]);
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
  const rows=input.topic==='inadimplencia'?open.filter(i=>String(i.due_date)<today&&inPeriod(input,i.due_date)&&allowedSearch(contractMap.get(i.contract_id)||{})):selectedInstallments.filter(i=>situationMatch(input,open.includes(i),i.status==='PAGO',open.includes(i)&&String(i.due_date)<today));
  return result({...list(rows.map(i=>({contrato:contractMap.get(i.contract_id)?.number,cliente:customerNames.get(contractMap.get(i.contract_id)?.customer_id),parcela:i.number,vencimento:i.due_date,situacao:installmentStatus(i as unknown as BankData['installments'][number],today),saldo:money(Math.max(0,Number(i.updated_cents)-Number(i.paid_cents)))})),input),saldo:money(balance(rows.filter(i=>open.includes(i)))),clientes_com_parcela_aberta:new Set(rows.filter(i=>open.includes(i)).map(i=>contractMap.get(i.contract_id)?.customer_id)).size,quantidade_a_receber:rows.filter(i=>open.includes(i)).length,saldo_a_receber:money(balance(rows.filter(i=>open.includes(i))))});
 }
 const [payments,proofs]=await Promise.all([input.topic==='comprovantes'?Promise.resolve([]):readRows(reader,'icom_bank_payments','id,installment_id,amount_cents,paid_at,status','paid_at.desc,id.asc'),input.topic==='pagamentos'?Promise.resolve([]):readRows(reader,'icom_bank_payment_proofs','id,installment_id,informed_cents,status,created_at','created_at.desc,id.asc')]);
 const installmentMap=new Map(installments.map(i=>[i.id,i]));
 const relation=(r:Row)=>{const i=installmentMap.get(r.installment_id),c=contractMap.get(i?.contract_id);return {i,c};};
 if(input.topic==='pagamentos'||input.topic==='comprovantes'){
  const rows=(input.topic==='pagamentos'?payments:proofs).filter(r=>inPeriod(input,input.topic==='pagamentos'?r.paid_at:r.created_at)&&allowedSearch(relation(r).c||{}));
  return result({...list(rows.map(r=>{const {i,c}=relation(r);return {contrato:c?.number,cliente:customerNames.get(c?.customer_id),parcela:i?.number,data:input.topic==='pagamentos'?r.paid_at:String(r.created_at).slice(0,10),situacao:r.status,valor:money(Number(input.topic==='pagamentos'?r.amount_cents:r.informed_cents))};}),input),por_situacao:counts(rows),confirmado:input.topic==='pagamentos'?money(total(rows.filter(r=>r.status!=='ESTORNADO'),'amount_cents')):undefined});
 }
 const sales=contracts.filter(c=>c.status!=='CANCELADO'&&inPeriod(input,c.sale_date)&&allowedSearch(c)),received=payments.filter(p=>p.status!=='ESTORNADO'&&inPeriod(input,p.paid_at)&&allowedSearch(relation(p).c||{})),visibleOpen=open.filter(i=>allowedSearch(contractMap.get(i.contract_id)||{}));
 return result({clientes_com_contrato_ativo:new Set(contracts.filter(c=>c.status==='ATIVO').map(c=>c.customer_id)).size,contratos_ativos:contracts.filter(c=>c.status==='ATIVO').length,contratos_no_periodo:sales.length,financiado_no_periodo:money(total(sales,'principal_cents')),recebido_no_periodo:money(total(received,'amount_cents')),carteira_atual_a_receber:money(balance(visibleOpen)),quantidade_parcelas_a_receber:visibleOpen.length,parcelas_vencidas:visibleOpen.filter(i=>String(i.due_date)<today).length,saldo_vencido:money(balance(visibleOpen.filter(i=>String(i.due_date)<today))),comprovantes_pendentes:proofs.filter(p=>p.status==='COMPROVANTE_ENVIADO').length,observacao:'Carteira atual e atraso são a posição de hoje. Recebimentos e contratos respeitam o período. Estes são contratos parcelados, não lucro das vendas administrativas.'});
}
