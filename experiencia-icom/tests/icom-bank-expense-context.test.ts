import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expenseContext,expenseStatusQuestion} from '../lib/icom-bank/expense-context.ts';
import {expenseDate} from '../lib/icom-bank/expense-date.ts';
import {expensePayload,type ExpenseDraft} from '../lib/icom-bank/whatsapp-expenses.ts';
import {personalSummary,personalCategory} from '../lib/icom-bank/personal-expenses.ts';
import {assistantExpenseTool,expenseVoiceText,signVoiceExpense,readVoiceExpense,sameVoiceExpense} from '../lib/icom-bank/assistant-expense.ts';
import {assistantReadInput,readAssistantData} from '../lib/icom-bank/assistant-data.ts';
import {adminInput,type AdminEntry} from '../lib/icom-bank/administrative.ts';
import {voiceSession} from '../lib/icom-bank/assistant-session.ts';
import {normalizeSpokenPlate,spokenPlateCandidates,expensePlate,attachExpenseVehicle} from '../lib/icom-bank/spoken-plate.ts';
import {prepareFinancial} from '../lib/icom-bank/assistant-financial.ts';
import {stockCosts,type StockRow} from '../lib/icom-bank/stock.ts';

const today='2026-10-07',id='0261ab47-da5a-4ea8-8462-7b6bc26354d3';
const actual='Faz um favor pra mim, eu acabei de gastar 230 reais num parque de diversão aqui com a minha família. Lança pra mim, por favor.';
const draft:ExpenseDraft={intent:'DESPESA',scope:'PESSOAL',description:'Parque de diversão com a família',category:'Lazer',amount:'230,00',amount_excerpt:'230',paid:true,payment_method:null,date:'2023-10-07',date_excerpt:'acabei de gastar',plate:null,confidence:'ALTA',question:''};
const payload=expensePayload(draft,actual,id,[],today);

test('Both plate formats survive extraction, expense validation and signed review without converting the fifth character',()=>{
 for(const fifth of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'){
  const plate='ABC1'+fifth+'23';
  const speech='Paguei 30 reais no pneu da loja, placa '+plate.split('').join(' ');
  assert.equal(normalizeSpokenPlate(plate),plate);
  assert.deepEqual(spokenPlateCandidates(speech),[plate]);
  const result=expensePayload({...draft,scope:'LOJA',description:'Pneu',category:'Manutenção',amount:'30,00',amount_excerpt:'30',plate:null},speech,id,[],today,'VOICE');
  assert.equal(result.details.plate,plate);
  const {expected_updated_at:_,...review}=result;void _;
  assert.equal(readVoiceExpense(signVoiceExpense(review,'owner','secret',1000),'owner','secret',2000).details.plate,plate);
 }
 const plate='TTQ9F92',speech='Paguei 30 reais no pneu da placa T de tatu T de tatu Q de queijo nove F de faca nove dois';
 assert.equal(expensePlate(null,speech),plate);
 for(const plate of ['ABCD123','ABC12D3','ABC1D2E','ABC123','ABC1D234'])assert.throws(()=>normalizeSpokenPlate(plate),/Mercosul/);
});

test('Mercosul speech preserves phonetic letters and grouped digits without repairing missing characters',()=>{
 for(const text of ['TTQ9F92','T T Q 9 F 9 2','t de tatu, t de dado, q de quica, nove, efe, noventa e dois','tê tê quê nove efe nove dois'])assert.equal(normalizeSpokenPlate(text),'TTQ9F92');
 assert.equal(normalizeSpokenPlate('a de amor b de bola c de casa 1 2 3 4'),'ABC1234');
 const text='Lança 500 reais no pneu da placa T de tatu T de tatu Q de queijo nove F noventa e dois hoje';
 assert.deepEqual(spokenPlateCandidates(text),['TTQ9F92']);assert.equal(expensePlate(null,text),'TTQ9F92');
 assert.deepEqual(spokenPlateCandidates('Lança 500 no pneu. A placa do carro é T de tatu T de tatu Q de queijo nove F noventa e dois.'),['TTQ9F92']);
 assert.deepEqual(spokenPlateCandidates('Placa E de escola F de faca G de gato um H de hotel dois três'),['EFG1H23']);
 assert.equal(expensePlate('T de tatu T de tatu Q de queijo nove F noventa e dois',text),'TTQ9F92');
 assert.throws(()=>expensePlate('TDQ9F92',text),/diferente/);
 assert.throws(()=>expensePlate('TTQ9F92','Paguei 500 na luz'),/Diga a placa/);
 assert.throws(()=>expensePlate(null,'Paguei 500 nos carros placa TTQ9F92 e placa ABC1D23'),/mais de uma/);
 for(const text of ['TTQ9F9','TTQ9F922','TTQOF92','placa XXX','t de tatu q de queijo nove f nove dois'])assert.throws(()=>normalizeSpokenPlate(text));
});

test('A spoken vehicle cost binds once to the exact available car and never manufactures stock',async()=>{
 const row={id:'0f901114-2065-4e08-828a-1e35ba7f1215',plate:'TTQ9F92',status:'DISPONIVEL',entry_date:'2026-10-01',active:true} as StockRow;
 const text='Paguei 500 reais no pneu da loja, placa T de tatu T de tatu Q de queijo nove F noventa e dois hoje';
 const tyre=expensePayload({...draft,scope:'LOJA',description:'Pneu',category:'Manutenção de veículo',amount:'500,00',amount_excerpt:'500',plate:'T de tatu T de tatu Q de queijo nove F noventa e dois'},text,id,[row],today,'VOICE');
 assert.equal(tyre.details.plate,'TTQ9F92');assert.equal(tyre.details.stock_id,row.id);
 assert.equal(stockCosts(row,[{...tyre,active:true,created_at:'2026-10-07T12:00:00Z',updated_at:'2026-10-07T12:00:00Z'}]),50000);
 const {expected_updated_at:_,...p}=tyre;void _;assert.equal(readVoiceExpense(signVoiceExpense(p,'owner','secret',1000),'owner','secret',2000).details.stock_id,row.id);
 const unknown=expensePayload({...draft,scope:'LOJA',description:'Pneu',category:'Manutenção',amount:'500,00',amount_excerpt:'500',plate:null},text,id,[],today,'VOICE');assert.equal(unknown.details.plate,row.plate);assert.equal(unknown.details.stock_id,undefined);
 assert.throws(()=>attachExpenseVehicle({plate:row.plate},[row,{...row,id:'other'}],today),/mais de um/);
 assert.throws(()=>attachExpenseVehicle({plate:row.plate},[{...row,status:'PREVISTO'}],today),/ainda não entrou/);
 assert.throws(()=>attachExpenseVehicle({plate:row.plate},[row],'2026-09-01'),/data/);
 const sold={plate:row.plate};attachExpenseVehicle(sold,[{...row,status:'VENDIDO'}],today);assert.equal('stock_id' in sold,false);
 const personal=expensePayload({...draft,description:'Pneu pessoal',amount:'500,00',amount_excerpt:'500',plate:row.plate},text,id,[row],today,'VOICE');assert.equal(personal.details.stock_id,undefined);assert.equal(personal.details.plate,undefined);
 const prepared=await prepareFinancial({operation:'LANCAMENTO',confidence:'ALTA',question:'',form:JSON.stringify({kind:'CUSTO',scope:'LOJA',description:'Pneu',category:'Manutenção',status:'REALIZADO',amount_cents:'500,00',details:{plate:'TTQ9F92'}}),evidence:JSON.stringify({amount_cents:'500'})},text,today,async path=>{assert.match(path,/plate=eq.TTQ9F92/);return [row] as unknown as Record<string,unknown>[];},id);
 assert.equal((prepared.args.p_payload as AdminEntry).details.stock_id,row.id);assert.match(JSON.stringify(prepared.summary),/vinculado/);
});

test('Voice records store light bills, personal care and unknown plates in separate scopes',()=>{
 const light=expensePayload({...draft,scope:'LOJA',description:'Conta de luz da loja',category:'Energia elétrica',amount:'500,00',amount_excerpt:'500'},'Lança 500 da conta de luz da loja',id,[],today,'VOICE');
 assert.equal(light.kind,'CUSTO');assert.equal(light.scope,'LOJA');assert.equal(light.amount_cents,50000);assert.equal(light.category,'Energia elétrica');assert.equal(light.details.expense_audience,undefined);
 const tyre=expensePayload({...draft,scope:'LOJA',description:'Troca de pneu',category:'Manutenção de veículo',amount:'500,00',amount_excerpt:'500',plate:'GHF 5D 3 2'},'Paguei 500 no pneu da placa GHF 5D 3 2 ontem',id,[],today,'VOICE');
 assert.equal(tyre.details.plate,'GHF5D32');assert.equal(tyre.details.stock_id,undefined);assert.equal(tyre.entry_date,'2026-10-06');assert.match(tyre.details.notes!,/ICOM IA por voz/);assert.match(tyre.details.notes!,/GHF5D32 em 06\/10\/2026/);
 const personal=expensePayload({...draft,description:'Manicure da filha',category:'manicure',amount:'17,00',amount_excerpt:'17'},'Gastei 17 com minha filha na manicure',id,[],today,'VOICE');
 assert.equal(personal.scope,'PESSOAL');assert.equal(personal.category,'Cuidados pessoais');assert.equal(personal.details.expense_audience,'FAMILIA');
 const {expected_updated_at:_,...p}=tyre;void _;assert.deepEqual(readVoiceExpense(signVoiceExpense(p,'owner','secret',1000),'owner','secret',2000),p);
 assert.throws(()=>expensePayload({...draft,paid:false},actual,id,[],today,'VOICE'));
});
test('Actual park audio launches on the message day despite a non-date or fabricated model excerpt',()=>{
 assert.equal(payload.entry_date,today);assert.equal(payload.amount_cents,23000);assert.equal(payload.details.expense_audience,'FAMILIA');assert.equal(payload.details.expense_nature,'OPCIONAL');
 for(const excerpt of [null,'hoje','acabei de gastar','ontem','2023-10-07','há poucos minutos'])assert.equal(expenseDate(actual,excerpt,today),today);
 for(const source of ['Lança pra mim 230 reais que eu gastei no shopping com a família','Esqueci de lançar 30 reais de gasolina hoje','Paguei 250 agora'])assert.equal(expenseDate(source,null,today),today);
 assert.equal(expenseDate('Paguei 230 ontem',null,today),'2026-10-06');assert.equal(expenseDate('Paguei 230 em 2026-10-05',null,today),'2026-10-05');
 for(const source of ['Paguei 230 em 30/02/2026','Paguei 230 em 08/10/2026','Paguei 230 ontem e hoje','Paguei 230 semana passada','Paguei 230 dia 5'])assert.throws(()=>expenseDate(source,null,today));
});
test('Repeated amount in a status question never becomes another expense',()=>{
 assert.equal(expenseStatusQuestion('Eu gastei duzentos e trinta reais. Você lançou duzentos e trinta reais no parque?'),true);
 assert.equal(expenseStatusQuestion('Já foi lançado?'),true);assert.equal(expenseStatusQuestion(actual),false);assert.equal(expenseStatusQuestion('Lança 30 reais que abasteci'),false);
});
test('Context preserves independent category, family, trip and adjustable optional classification',async()=>{
 assert.equal(personalCategory('','Almoço no shopping'),'Restaurante');
 assert.deepEqual(expenseContext('Parque com minha família','Lazer'),{expense_audience:'FAMILIA',expense_nature:'OPCIONAL'});
 assert.equal(expenseContext('Restaurante','Restaurante').expense_nature,'NAO_CLASSIFICADO');
 assert.equal(expenseContext('Escola da filha','Escola / educação').expense_nature,'ESSENCIAL');
 assert.equal(expenseContext('Pix para Gisela','Retirada / Pix').expense_audience,'NAO_INFORMADO');
 assert.equal(expenseContext('Esta viagem foi necessária','Viagem / hospedagem').expense_nature,'ESSENCIAL');
 assert.equal(expenseContext('Gasto só para mim','Restaurante').expense_audience,'INDIVIDUAL');
 const rows=[{...payload,active:true,created_at:'',updated_at:'',details:{...payload.details,trip_name:'Disney'}},{...payload,id:'other',active:true,amount_cents:3000,description:'Gasolina',category:'Combustível',details:{expense_audience:'INDIVIDUAL',expense_nature:'ESSENCIAL'}},{...payload,id:'inactive',active:false}] as AdminEntry[];
 assert.equal(personalSummary(rows,'Lazer','Disney',undefined,undefined,'FAMILIA','OPCIONAL').amount_cents,23000);
 assert.equal(personalSummary(rows,'','',undefined,undefined,'INDIVIDUAL').amount_cents,3000);
 assert.equal(personalSummary(rows).amount_cents,26000);
 const data=await readAssistantData({ledger:async()=>rows,rows:async()=>[],staff:async()=>[]},{topic:'despesas_pessoais',audience:'FAMILIA',nature:'OPCIONAL'},'OWNER',today);
 assert.match(JSON.stringify(data),/230,00/);
 for(const role of ['VENDEDOR','GERENTE','FINANCEIRO','ADMIN'] as const)assert.throws(()=>assistantReadInput({topic:'despesas_pessoais',audience:'FAMILIA'},role,today));
 assert.throws(()=>assistantReadInput({topic:'caixa',nature:'OPCIONAL'},'OWNER',today));assert.throws(()=>adminInput({...payload,details:{expense_nature:'EVIL'}}));
});
test('Only owner can prepare a voice expense, whose confirmation is signed, bounded and bound to that owner',()=>{
 assert.ok(assistantExpenseTool('OWNER'));for(const role of ['VENDEDOR','GERENTE','FINANCEIRO','ADMIN'] as const){assert.equal(assistantExpenseTool(role),null);assert.equal(voiceSession(role,'dashboard').tools.length,1);}
 assert.match(voiceSession('OWNER','dashboard').instructions,/Nunca diga lançado\/salvo antes/);
 assert.equal(expenseVoiceText({transcript:actual}),actual);assert.throws(()=>expenseVoiceText({transcript:actual,role:'OWNER'}));
 const {expected_updated_at:_,...p}=payload;void _;const token=signVoiceExpense(p,'owner','secret',1000);
 assert.deepEqual(readVoiceExpense(token,'owner','secret',2000),p);
 for(const [t,u,k,time] of [[token,'other','secret',2000],[token,'owner','other',2000],[token+'x','owner','secret',2000],[token,'owner','secret',601000]] as const)assert.throws(()=>readVoiceExpense(t,u,k,time));
 assert.equal(sameVoiceExpense({...p,details:{...p.details}} as Record<string,unknown>,p),true);assert.equal(sameVoiceExpense({...p,amount_cents:999} as Record<string,unknown>,p),false);
});
