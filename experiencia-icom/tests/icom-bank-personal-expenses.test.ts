import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personalCategory,personalSummary,tripName} from '../lib/icom-bank/personal-expenses.ts';
import {adminInput,type AdminEntry} from '../lib/icom-bank/administrative.ts';
import {assistantReadInput,assistantReadTool,readAssistantData,type AssistantReader} from '../lib/icom-bank/assistant-data.ts';
const id='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const entry=(extra:Partial<AdminEntry>={}):AdminEntry=>({id,kind:'PESSOAL',scope:'PESSOAL',entry_date:'2026-10-07',description:'Restaurante',category:'Restaurante',status:'REALIZADO',amount_cents:23000,details:{trip_name:'Disney'},active:true,created_at:'',updated_at:'',...extra});
test('Personal categories map common Portuguese names and preserve old custom categories',()=>{
 for(const [s,c] of [['restaurantes','Restaurante'],['gasolina','Combustível'],['escola','Escola / educação'],['plano médico','Plano de saúde'],['luz','Energia elétrica'],['água','Água']])assert.equal(personalCategory(s),c);
 assert.equal(personalCategory('alimentação','gasto no restaurante'),'Restaurante');assert.equal(personalCategory('Minha categoria'),'Minha categoria');
 assert.equal(tripName('  Disney   2026 '),'Disney 2026');assert.throws(()=>tripName('x'.repeat(81)));assert.throws(()=>tripName('x\ny'));
});
test('Summary excludes archived, unpaid, store and out-of-period expenses and never double counts trips',()=>{
 const rows=[entry(),entry({amount_cents:1000,category:'Água',description:'Água'}),entry({active:false}),entry({status:'PREVISTO'}),entry({scope:'LOJA',kind:'CUSTO'}),entry({entry_date:'2025-10-07'})];
 const all=personalSummary(rows,'','','2026-10-01','2026-10-31');assert.equal(all.count,2);assert.equal(all.amount_cents,24000);assert.equal(all.trips[0].amount_cents,24000);
 assert.equal(personalSummary(rows,'Restaurante','disney','2026-10-01','2026-10-31').amount_cents,23000);
 assert.equal(personalSummary(rows,'Restaurante','Desconhecida').amount_cents,0);
});
test('Named trip validation is kept in the existing audited administrative write payload',()=>{
 const e=entry();const p=adminInput({...e,details:{trip_name:'Disney 2026'},expected_updated_at:null});assert.equal(p.details.trip_name,'Disney 2026');
 assert.throws(()=>adminInput({...e,details:{trip_name:'x'.repeat(81)},expected_updated_at:null}));
 assert.throws(()=>adminInput({...e,kind:'MENSAL',scope:'LOJA',details:{trip_name:'Disney'},expected_updated_at:null}));
});
test('Voice sums all matching entries before list limits and keeps personal data owner only',async()=>{
 const entries=Array.from({length:30},()=>entry());
 const reader:AssistantReader={rows:async()=>{throw Error('No unrelated database queries');},staff:async()=>[],ledger:async()=>entries};
 const result=await readAssistantData(reader,{topic:'despesas_pessoais',category:'Restaurante',trip:'Disney',limit:1},'OWNER','2026-10-07');
 const d=result.dados as {total_pago:{centavos:number};quantidade:number;exibidos:number;lista_limitada:boolean};assert.equal(d.total_pago.centavos,690000);assert.equal(d.quantidade,30);assert.equal(d.exibidos,1);assert.equal(d.lista_limitada,true);
 for(const role of ['VENDEDOR','GERENTE','FINANCEIRO','ADMIN'] as const)assert.throws(()=>assistantReadInput({topic:'despesas_pessoais'},role));
 assert.throws(()=>assistantReadInput({topic:'investidores',trip:'Disney'},'OWNER'));assert.throws(()=>assistantReadInput({topic:'despesas_pessoais',category:'bad'},'OWNER'));
 assert.match(JSON.stringify(assistantReadTool('OWNER')),/despesas_pessoais/);assert.doesNotMatch(JSON.stringify(assistantReadTool('VENDEDOR')),/"despesas_pessoais"/);
});
