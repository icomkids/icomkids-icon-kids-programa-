import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantFinancialTool,prepareFinancial,signFinancial,readFinancial,refuseVoiceWithdrawal,extractFinancial,type FinancialDraft} from '../lib/icom-bank/assistant-financial.ts';
import {readAssistantData,assistantReadInput,type AssistantReader} from '../lib/icom-bank/assistant-data.ts';
import type {CashEntry} from '../lib/icom-bank/cash.ts';
const today='2026-10-07',id='a4234118-8a17-4993-b490-92edfa233456',bill='b4234118-8a17-4993-b490-92edfa233456';
const draft=(operation:FinancialDraft['operation'],form:Record<string,unknown>,evidence:Record<string,string>):FinancialDraft=>({operation,form:JSON.stringify(form),evidence:JSON.stringify(evidence),confidence:'ALTA',question:''});
const reader=(tables:Record<string,Record<string,unknown>[]>)=>async(path:string)=>tables[path.split('?')[0]]||[];
const empty=reader({});
test('Only OWNER has financial tools; withdrawal language cannot be disguised as an expense or Pix',()=>{
 assert.equal(assistantFinancialTool('OWNER')?.name,'preparar_lancamento_icom');for(const role of ['ADMIN','GERENTE','FINANCEIRO','VENDEDOR'] as const)assert.equal(assistantFinancialTool(role),null);
 for(const text of ['lança retirada de 500','transfira 500 para a conta pessoal','registre transferência entre contas','devolução ao investidor de 2000','faça um Pix de 300 para João'])assert.throws(()=>refuseVoiceWithdrawal(text),/manualmente/);
 assert.doesNotThrow(()=>refuseVoiceWithdrawal('paguei 500 de luz da loja por Pix'));
});
test('Future recurring bill keeps cash untouched, month count and explicit due date in a signed owner-bound preview',async()=>{
 const text='Cadastre aluguel da loja de 2500,00, vencimento 10/10/2026, por 12 meses';
 const p=await prepareFinancial(draft('CONTA_PAGAR',{title:'Aluguel',scope:'LOJA',category:'Aluguel',amount_cents:'2500,00',due_date:'2026-10-10',months:12},{amount_cents:'2500,00',due_date:'10/10/2026'}),text,today,empty,id);
 assert.equal(p.rpc,'icom_bank_save_expense');assert.equal((p.args.p_payload as Record<string,unknown>).months,12);assert.equal((p.args.p_payload as Record<string,unknown>).amount_cents,250000);assert.match(p.summary.at(-1)!.value,/sem saída/);
 const token=signFinancial(p,'owner','key',1000);assert.deepEqual(readFinancial(token,'owner','key',2000),p);
 assert.throws(()=>readFinancial(token,'other','key',2000));assert.throws(()=>readFinancial(token,'owner','wrong',2000));assert.throws(()=>readFinancial(token,'owner','key',601000));assert.throws(()=>readFinancial(token+'.tamper','owner','key',2000));
});
test('Preparation rejects fabricated money, absent due dates and arbitrary IDs, RPCs or settlement fields',async()=>{
 for(const [form,evidence] of [[{title:'Luz',scope:'LOJA',amount_cents:'900,00',due_date:'2026-10-10'},{amount_cents:'500,00',due_date:'10/10/2026'}],[{title:'Luz',scope:'LOJA',amount_cents:'500,00'},{amount_cents:'500,00'}],[{title:'Luz',scope:'LOJA',amount_cents:'500,00',due_date:'2026-10-10',id},{amount_cents:'500,00',due_date:'10/10/2026'}]] as const)await assert.rejects(prepareFinancial(draft('CONTA_PAGAR',form,evidence),'Luz 500,00 para 10/10/2026',today,empty,id));
 await assert.rejects(prepareFinancial(draft('LANCAMENTO',{kind:'CUSTO',scope:'LOJA',status:'REALIZADO',description:'Luz',category:'Luz',amount_cents:'500,00',details:{sale_cost_id:id,settlement_part:'INVESTIDOR'}},{amount_cents:'500,00'}),'paguei luz 500,00',today,empty,id),/campo/);
});
test('Received entry and simple sale keep actual receipt separate from revenue and the approved fixed commission',async()=>{
 const entry=await prepareFinancial(draft('LANCAMENTO',{kind:'ENTRADA',scope:'LOJA',status:'REALIZADO',description:'Serviço recebido',category:'Serviço',amount_cents:'100,00',details:{payment_method:'PIX'}},{amount_cents:'100,00'}),'recebi 100,00 de serviço por Pix',today,empty,id);
 assert.equal((entry.args.p_payload as Record<string,unknown>).amount_cents,10000);
 const sale=await prepareFinancial(draft('LANCAMENTO',{kind:'VENDA',scope:'LOJA',status:'REALIZADO',description:'Venda Onix',category:'Venda',amount_cents:'72000,00',details:{sale_owner:'LOJA',vehicle:'Chevrolet Onix',plate:'ABC1D23',seller:'João',trade_in:false,purchase_cents:'85000,00',vehicle_cost_cents:'2500,00',sale_cents:'102000,00',payment_method:'PIX'}},{amount_cents:'72000,00','details.purchase_cents':'85000,00','details.vehicle_cost_cents':'2500,00','details.sale_cents':'102000,00'}),'Venda Onix loja João ABC1D23 sem troca, compra 85000,00, custos 2500,00, venda 102000,00 recebi 72000,00 Pix',today,empty,id);
 const payload=sale.args.p_payload as {amount_cents:number;details:{commission_cents:number;sale_cents:number}};assert.equal(payload.amount_cents,7200000);assert.equal(payload.details.sale_cents,10200000);assert.equal(payload.details.commission_cents,165000);
});
test('Bill payment resolves current version and amount; recurrent ambiguity asks a date instead of choosing a bill',async()=>{
 const form={title:'Luz',scope:'LOJA',method:'PIX',amount_cents:'500,00'},evidence={amount_cents:'500,00'},rows=[{id:bill,title:'Luz',scope:'LOJA',status:'PENDENTE',active:true,amount_cents:50000,due_date:'2026-10-10',updated_at:'2026-10-07T10:00:00Z'}];
 const p=await prepareFinancial(draft('PAGAR_CONTA',form,evidence),'Paguei a conta Luz da loja 500,00 Pix',today,reader({icom_bank_payables:rows}),id);
 assert.equal(p.rpc,'icom_bank_pay_trade_debt');assert.equal(p.args.p_expected,rows[0].updated_at);assert.equal(p.args.p_request,id);assert.equal(p.args.p_paid,today);
 await assert.rejects(prepareFinancial(draft('PAGAR_CONTA',form,evidence),'Paguei Luz 500,00 Pix',today,reader({icom_bank_payables:[...rows,{...rows[0],id}]}),id),/mais de um/);
 await assert.rejects(prepareFinancial(draft('PAGAR_CONTA',{...form,amount_cents:'600,00'},{amount_cents:'600,00'}),'paguei Luz 600,00 Pix',today,reader({icom_bank_payables:rows}),id),/saldo/);
  await assert.rejects(prepareFinancial(draft('PAGAR_CONTA',form,evidence),'Paguei Luz 500,00 Pix',today,reader({icom_bank_payables:rows,icom_bank_admin_entries:[{id,kind:'CUSTO',scope:'LOJA',entry_date:today,status:'REALIZADO',amount_cents:50000,active:true,details:{payment_method:'PIX'}}]}),id),/evitar duplicação/);
});
test('Receivable creation is pending; partial receipt cannot exceed the current outstanding balance',async()=>{
 const p=await prepareFinancial(draft('CONTA_RECEBER',{title:'Santander',payer:'Santander',kind:'BANCO',bank:'Santander',amount_cents:'70000,00',due_date:'2026-10-10'},{amount_cents:'70000,00',due_date:'10/10/2026'}),'Cadastrar Santander a receber 70000,00 dia 10/10/2026',today,empty,id);
 assert.equal(p.rpc,'icom_bank_save_receivable');assert.match(p.summary.at(-1)!.value,/sem entrada/);
 const rows=[{id:bill,title:'Santander',payer:'Santander',active:true,amount_cents:7000000,received_cents:1000000,due_date:'2026-10-10',updated_at:'2026-10-07T10:00:00Z'}];
 const partial=await prepareFinancial(draft('RECEBER_CONTA',{title:'Santander',method:'PIX',amount_cents:'500,00'},{amount_cents:'500,00'}),'recebi Santander 500,00 Pix',today,reader({icom_bank_receivables:rows}),id);assert.equal(partial.args.p_amount,50000);assert.equal(partial.args.p_request,id);
 await assert.rejects(prepareFinancial(draft('RECEBER_CONTA',{title:'Santander',method:'PIX',amount_cents:'70000,00'},{amount_cents:'70000,00'}),'recebi Santander 70000,00 Pix',today,reader({icom_bank_receivables:rows}),id),/saldo/);
});
test('Installment recording requires a submitted proof, active contract, exact amount and explicit bank check',async()=>{
 const tables={icom_bank_customers:[{id:'c',name:'Bruno'}],icom_bank_contracts:[{id:'contract',customer_id:'c',number:'2026-1',status:'ATIVO',sale_date:'2026-09-01'}],icom_bank_installments:[{id:'installment',contract_id:'contract',number:1,status:'COMPROVANTE_ENVIADO',updated_cents:210000,paid_cents:0}],icom_bank_payment_proofs:[{id:bill,installment_id:'installment',status:'COMPROVANTE_ENVIADO',informed_cents:210000}]};
 const d=draft('PAGAR_PARCELA',{customer:'Bruno',installment_number:1,amount_cents:'2100,00'},{amount_cents:'2100,00'}),text='Confirme parcela 1 de Bruno, recebi 2100,00';
 const p=await prepareFinancial(d,text,today,reader(tables),id);assert.equal(p.rpc,'icom_bank_review_proof');assert.equal(p.args.p_id,bill);assert.match(p.summary.at(-1)!.value,/recebimento real/);
 await assert.rejects(prepareFinancial(d,text,today,reader({...tables,icom_bank_payment_proofs:[]}),id),/envie o arquivo/);
});
test('Financial interpreter uses bounded structured output and never treats incomplete or multiple drafts as saved',async()=>{
 let body:Record<string,unknown>={};const fetcher=async(_url:unknown,init?:RequestInit)=>{body=JSON.parse(String(init?.body));return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({operation:'CONTA_PAGAR',form:'{}',evidence:'{}',confidence:'BAIXA',question:'Qual é o vencimento?'})}]}]});};
 const d=await extractFinancial('cadastre conta 500',today,'test-key',fetcher as typeof fetch);assert.equal(body.store,false);await assert.rejects(prepareFinancial(d,'cadastre conta 500',today,empty,id),/vencimento/);
});
const readFixture=(tables:Record<string,Record<string,unknown>[]>,ledger:CashEntry[]=[]):AssistantReader=>({rows:reader(tables),ledger:async()=>ledger,staff:async()=>[]});
test('Pagination can enumerate every client without changing totals or granting forbidden topic access',async()=>{
 const rows=Array.from({length:33},(_,i)=>({id:i,name:'Cliente '+i,status:'ATIVO',created_at:today})),r=readFixture({icom_bank_customers:rows});
 const first=(await readAssistantData(r,{topic:'clientes',limit:25},'OWNER',today)).dados as {quantidade:number;proxima_pagina:number;registros:unknown[]};
 const next=(await readAssistantData(r,{topic:'clientes',offset:first.proxima_pagina,limit:25},'OWNER',today)).dados as {quantidade:number;proxima_pagina:null;registros:unknown[]};
 assert.equal(first.quantidade,33);assert.equal(first.registros.length,25);assert.equal(next.quantidade,33);assert.equal(next.registros.length,8);assert.equal(next.proxima_pagina,null);
 assert.throws(()=>assistantReadInput({topic:'lancamentos'},'VENDEDOR'),/acesso/);assert.throws(()=>assistantReadInput({topic:'clientes',offset:-1},'OWNER'));assert.throws(()=>assistantReadInput({topic:'clientes',offset:100000},'OWNER'));
});
test('Open installment count and amount exclude paid, cancelled, renegotiated and inactive-contract balances',async()=>{
 const contracts=[{id:'a',number:'1',customer_id:'c',status:'ATIVO',sale_date:today},{id:'b',number:'2',customer_id:'c',status:'CANCELADO',sale_date:today}];
 const installments=[{id:'1',contract_id:'a',number:1,status:'A_VENCER',due_date:'2026-10-10',updated_cents:210000,paid_cents:0},{id:'2',contract_id:'a',number:2,status:'PAGO',due_date:'2026-10-10',updated_cents:210000,paid_cents:210000},{id:'3',contract_id:'b',number:1,status:'CANCELADO',due_date:'2026-10-10',updated_cents:500000,paid_cents:0},{id:'4',contract_id:'a',number:3,status:'RENEGOCIADO',due_date:'2026-10-10',updated_cents:500000,paid_cents:0}];
 const data=(await readAssistantData(readFixture({icom_bank_contracts:contracts,icom_bank_installments:installments}),{topic:'parcelas',situation:'PENDENTES'},'OWNER',today)).dados as {quantidade:number;quantidade_a_receber:number;saldo_a_receber:{centavos:number}};assert.equal(data.quantidade,1);assert.equal(data.quantidade_a_receber,1);assert.equal(data.saldo_a_receber.centavos,210000);
});
test('Shop expense queries aggregate all matching plates/categories and exclude personal, archived and planned expenses',async()=>{
 const base={id,kind:'CUSTO',scope:'LOJA',entry_date:today,description:'Pneu',category:'Manutenção',status:'REALIZADO',amount_cents:50000,details:{plate:'ABC1D23'},active:true,created_at:today,updated_at:today} as CashEntry;
 const rows=[base,{...base,id:bill},{...base,id:'p',scope:'PESSOAL',kind:'PESSOAL'},{...base,id:'x',active:false},{...base,id:'f',status:'PREVISTO'}] as CashEntry[];
 const data=(await readAssistantData(readFixture({},rows),{topic:'despesas_loja',search:'ABC1D23',limit:1},'OWNER',today)).dados as {quantidade:number;total_despesas_loja:{centavos:number}};assert.equal(data.quantidade,3);assert.equal(data.total_despesas_loja.centavos,100000);
});
