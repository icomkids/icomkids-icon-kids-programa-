'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {bankPath,brazilDay,currency} from '@/lib/icom-bank/model';
import {moneyInput} from '@/lib/icom-bank/contracts';
import {adminInput,type AdminEntry,type AdminKind,type AdminScope,type AdminDetails} from '@/lib/icom-bank/administrative';

const kinds:{value:AdminKind;label:string}[]=[{value:'VENDA',label:'Venda de veículo'},{value:'ENTRADA',label:'Entrada de caixa'},{value:'CUSTO',label:'Custo / despesa da loja'},{value:'RETORNO',label:'Retorno bancário'},{value:'TROCA',label:'Troca de veículo'},{value:'MENSAL',label:'Conta mensal'},{value:'PESSOAL',label:'Despesa pessoal'}];
type Field={key:keyof AdminDetails;label:string;money?:boolean;number?:boolean;required?:boolean};
const fields:Record<AdminKind,Field[]>={
 VENDA:[{key:'vehicle',label:'Carro / modelo',required:true},{key:'plate',label:'Placa'},{key:'seller',label:'Vendedor'},{key:'purchase_cents',label:'Valor de compra',money:true},{key:'vehicle_cost_cents',label:'Custo do veículo',money:true},{key:'commission_cents',label:'Caixa / vendedor (comissão)',money:true},{key:'sale_cents',label:'Valor da venda',money:true},{key:'trade_vehicle',label:'Troca recebida (opcional)'}],
 ENTRADA:[],PESSOAL:[],CUSTO:[{key:'vehicle',label:'Carro / referência (opcional)'},{key:'plate',label:'Placa (opcional)'}],
 RETORNO:[{key:'vehicle',label:'Carro / modelo',required:true},{key:'plate',label:'Placa'},{key:'seller',label:'Vendedor'},{key:'bank',label:'Banco'},{key:'return_level',label:'Retorno (1, 2 ou 3)',number:true},{key:'financed_cents',label:'Valor financiado',money:true},{key:'tax_cents',label:'Imposto',money:true},{key:'manager_cents',label:'Repasse Lazinho / gerente',money:true},{key:'seller_cents',label:'Repasse vendedor',money:true}],
 TROCA:[{key:'vehicle',label:'Carro de troca',required:true},{key:'plate',label:'Placa'},{key:'paid_cents',label:'Valor pago',money:true},{key:'debt_cents',label:'Débito da troca',money:true},{key:'document_cents',label:'Valor documentação vendida',money:true},{key:'cc_cents',label:'Valor pago CC',money:true},{key:'discount_cents',label:'Desconto débito / documento / caixa',money:true},{key:'division_cents',label:'Divisão para cada (manual)',money:true},{key:'profit_share_cents',label:'Lucro para cada (manual)',money:true}],
 MENSAL:[{key:'due_day',label:'Dia habitual do vencimento',number:true}],
};
export type AdminPreset={kind:AdminKind;date?:string;description?:string;scope?:AdminScope;due_day?:number};
export default function BankAdminForm({entry,preset,onSaved,onCancel}:{entry?:AdminEntry;preset:AdminPreset;onSaved:(entry:AdminEntry)=>void;onCancel:()=>void}){
 const initialKind=entry?.kind||preset.kind;
 const [kind,setKind]=useState(initialKind),[id]=useState(()=>entry?.id||crypto.randomUUID()),[date,setDate]=useState(entry?.entry_date||preset.date||brazilDay()),[description,setDescription]=useState(entry?.description||preset.description||''),[scope,setScope]=useState<AdminScope|''>(entry?.scope||preset.scope||(initialKind==='MENSAL'?'':initialKind==='PESSOAL'?'PESSOAL':'LOJA')),[category,setCategory]=useState(entry?.category||''),[status,setStatus]=useState(entry?.status||'PREVISTO'),[value,setValue]=useState(entry?.amount_cents===null?'':entry?.amount_cents!==undefined?(entry.amount_cents/100).toFixed(2).replace('.',','):''),[details,setDetails]=useState<Record<string,string>>(()=>{const obj:Record<string,string>={};for(const [key,v] of Object.entries(entry?.details||{}))obj[key]=typeof v==='number'&&key.endsWith('_cents')?(v/100).toFixed(2).replace('.',','):String(v);if(preset.due_day)obj.due_day=String(preset.due_day);return obj;}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{document.getElementById('admin-form')?.scrollIntoView({block:'start'});},[]);
 const changeKind=(next:AdminKind)=>{setKind(next);setScope(next==='MENSAL'?'':next==='PESSOAL'?'PESSOAL':'LOJA');setDetails({});setValue('');setError('');};
 const safeMoney=(key:string)=>{try{return moneyInput(details[key]||'0');}catch{return 0;}};
 const realCost=safeMoney('purchase_cents')+safeMoney('vehicle_cost_cents')+safeMoney('commission_cents');
 const returnValue=()=>{try{return moneyInput(value||'0')-safeMoney('tax_cents')-safeMoney('manager_cents')-safeMoney('seller_cents');}catch{return 0;}};
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setError('');let input;
  try{const payload:Record<string,unknown>={notes:details.notes||'',payment_method:details.payment_method||''};for(const f of fields[kind]){const v=details[f.key]||'';if(f.money)payload[f.key]=moneyInput(v||'0');else if(f.number){if(v)payload[f.key]=Number(v);}else payload[f.key]=f.key==='plate'?v.replace(/[^a-z0-9]/gi,'').toUpperCase():v;}
   input=adminInput({id,kind,scope,entry_date:date,description,category,status,amount_cents:value.trim()?moneyInput(value):kind==='VENDA'?0:null,details:payload,expected_updated_at:entry?.updated_at||null});
  }catch(e){setError(e instanceof Error?e.message:'Confira os campos.');return;}
  setBusy(true);try{const r=await fetch(bankPath('/api/administrative'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),data=await r.json() as {row?:AdminEntry;error?:string};if(!r.ok||!data.row)throw new Error(data.error||'Não foi possível salvar.');onSaved(data.row);}catch(e){setError(e instanceof Error?e.message:'Não foi possível confirmar o salvamento. Tente novamente nesta mesma tela.');}finally{setBusy(false);}
 }
 return <section className="bank-panel bank-admin-form" id="admin-form"><h2>{entry?'Editar lançamento':'Novo lançamento'}</h2><form onSubmit={submit}>
  <div className="bank-form-grid">
   <label>Área<select value={kind} disabled={busy||!!entry} onChange={e=>changeKind(e.target.value as AdminKind)}>{kinds.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
   <label>{kind==='MENSAL'?'Vencimento / mês de referência':'Data do lançamento'}<input required type="date" value={date} min="2000-01-01" max="2100-12-31" disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
   <label>Descrição<input required minLength={2} maxLength={160} value={description} disabled={busy} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: aluguel, venda ou recebimento"/></label>
   <label>Categoria{kind==='CUSTO'?<select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy}><option value="">Selecione</option>{['Custos loja','Custos variáveis','Pós-venda'].map(c=><option key={c}>{c}</option>)}</select>:<input value={category} maxLength={80} disabled={busy} onChange={e=>setCategory(e.target.value)} placeholder="Ex.: aluguel, cartão, manutenção"/>}</label>
   <label>Escopo<select required value={scope} disabled={busy||kind!=='MENSAL'} onChange={e=>setScope(e.target.value as AdminScope)}><option value="">Selecione Loja ou Pessoal</option><option value="LOJA">Loja</option><option value="PESSOAL">Pessoal</option></select></label>
   <label>Situação<select value={status} disabled={busy} onChange={e=>setStatus(e.target.value as 'PREVISTO'|'REALIZADO')}><option value="PREVISTO">Previsto / ainda não realizado</option><option value="REALIZADO">Realizado / pago ou recebido</option></select></label>
   {kind!=='TROCA'&&<label>{kind==='VENDA'?'Dinheiro efetivamente recebido nesta venda':kind==='RETORNO'?'Retorno bruto recebido (valor conta)':'Valor em reais'}<input inputMode="decimal" placeholder="Ex.: 1250,50" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}/><small>{kind==='VENDA'?'Deixe vazio para registrar R$ 0 recebido. Não é o valor total da venda.':kind==='MENSAL'?'Pode deixar sem valor quando a planilha indicar apenas “OK”. O total ficará sinalizado como incompleto.':'Sem ponto de milhar. Use vírgula nos centavos.'}</small></label>}
   {fields[kind].map(f=><label key={f.key}>{f.label}<input required={f.required} disabled={busy} type={f.number?'number':'text'} inputMode={f.money?'decimal':undefined} min={f.number?1:undefined} max={f.key==='return_level'?3:f.key==='due_day'?31:undefined} maxLength={f.money?13:f.key==='plate'?9:160} placeholder={f.money?'0,00':undefined} value={details[f.key]||''} onChange={e=>setDetails({...details,[f.key]:e.target.value})}/></label>)}
   {!['TROCA','RETORNO'].includes(kind)&&<label>Forma de pagamento / recebimento<input maxLength={160} value={details.payment_method||''} disabled={busy} onChange={e=>setDetails({...details,payment_method:e.target.value})}/></label>}
  </div>
  {kind==='VENDA'&&<div className="bank-admin-calculation"><span>Custo real: <b>{currency(realCost)}</b></span><span>Lucro da venda: <b>{currency(safeMoney('sale_cents')-realCost)}</b></span></div>}
  {kind==='RETORNO'&&<p className="bank-note">Loja após imposto e repasses informados: <strong>{currency(returnValue())}</strong>. Os repasses são manuais; a divisão da sua planilha ainda será confirmada.</p>}
  {kind==='TROCA'&&<p className="bank-note">A troca controla os valores do veículo. Divisão e lucro por pessoa são manuais. Para movimentar o caixa, registre a entrada ou o custo correspondente em sua área própria.</p>}
  {kind==='ENTRADA'&&<p className="bank-note">Registre aqui receitas que ainda não foram incluídas como recebido de uma venda ou retorno. Assim você evita contar a mesma entrada duas vezes.</p>}
  <label>Observações<textarea maxLength={2000} rows={3} disabled={busy} value={details.notes||''} onChange={e=>setDetails({...details,notes:e.target.value})}/></label>
  {error&&<p className="bank-error" role="alert">{error}</p>}
  <div className="bank-actions"><button type="button" disabled={busy} onClick={onCancel}>Cancelar</button><button className="bank-primary" disabled={busy}>{busy?'Salvando…':'SALVAR LANÇAMENTO'}</button></div>
 </form></section>;
}
