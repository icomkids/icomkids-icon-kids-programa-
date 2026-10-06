'use client';
import {useState} from 'react';
import {bankPath,brazilDay} from '@/lib/icom-bank/model';
import {adminMoneyInput,adminMoneyText} from '@/lib/icom-bank/administrative';
import {monthlyDueDates,payablePeople,type Payable} from '@/lib/icom-bank/payables';
export default function BankExpenseForm({bill,defaultScope,onCancel,onSaved}:{bill?:Payable;defaultScope:'LOJA'|'PESSOAL';onCancel:()=>void;onSaved:(message:string)=>void}){
 const [id]=useState(()=>bill?.id||crypto.randomUUID()),[scope,setScope]=useState(bill?.scope||defaultScope),[person,setPerson]=useState(bill?.person||'AMBOS'),[title,setTitle]=useState(bill?.title||''),[amount,setAmount]=useState(bill?adminMoneyText(Number(bill.amount_cents)):''),[due,setDue]=useState(bill?.due_date||brazilDay()),[recurring,setRecurring]=useState(false),[months,setMonths]=useState(12),[notes,setNotes]=useState(bill?.notes||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const count=recurring&&!bill?months:1;
 let dates:string[]=[];try{dates=monthlyDueDates(due,count);}catch{}
 const dateText=(d:string)=>d.split('-').reverse().join('/');
 async function save(values:FormData){setBusy(true);setError('');try{
  const cents=adminMoneyInput(String(values.get('amount')||''));if(cents<=0)throw new Error('Informe um valor maior que 0,00.');
  const response=await fetch(bankPath('/api/payables'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'expense',id,expected_updated_at:bill?.updated_at||null,scope,person:scope==='LOJA'?'AMBOS':person,title,amount_cents:cents,due_date:String(values.get('due_date')||''),months:count,category:bill?.category||(recurring?'Conta mensal':'Despesa avulsa'),notes})});
  const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error||'Não foi possível cadastrar a conta.');
  onSaved(bill?'Conta atualizada. Os outros meses foram preservados.':`${count===1?'Conta cadastrada':`${count} vencimentos cadastrados`}. Nenhuma saída foi registrada no caixa.`);
 }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 return <form className="bank-panel bank-expense-form" onSubmit={e=>{e.preventDefault();void save(new FormData(e.currentTarget));}}><div className="bank-panel-title"><div><p className="bank-eyebrow">ORGANIZAR ANTES DE PAGAR</p><h2>{bill?'Editar conta':'Cadastrar conta a pagar'}</h2><p>Contas fixas e despesas avulsas, com data e valor bem à vista.</p></div></div><fieldset disabled={busy}><div className="bank-form-grid">
 <label>De quem é esta conta?<select value={scope} onChange={e=>setScope(e.target.value as 'LOJA'|'PESSOAL')}><option value="LOJA">Loja</option><option value="PESSOAL">Pessoal · Bruno e Gisela</option></select></label>
 {scope==='PESSOAL'&&<label>Identificação pessoal<select value={person} onChange={e=>setPerson(e.target.value as keyof typeof payablePeople)}>{Object.entries(payablePeople).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>}
 <label>Nome da conta<input autoFocus required minLength={2} maxLength={160} placeholder="Ex.: Aluguel, água, luz ou despesa pessoal" value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>Valor por vencimento (R$)<input name="amount" required inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} onBlur={()=>{try{setAmount(adminMoneyText(adminMoneyInput(amount)));}catch{}}}/></label>
 <label>{bill?'Vencimento':'Primeiro vencimento'}<input name="due_date" required type="date" min="2000-01-01" max="2100-12-31" value={due} onChange={e=>setDue(e.target.value)}/></label>
 {!bill&&<label>Frequência<select value={recurring?'monthly':'once'} onChange={e=>setRecurring(e.target.value==='monthly')}><option value="once">Avulsa · uma única conta</option><option value="monthly">Mensal · repetir os vencimentos</option></select></label>}
 {!bill&&recurring&&<label>Quantos meses cadastrar?<select value={months} onChange={e=>setMonths(Number(e.target.value))}>{[2,3,6,12,18,24,36,48,60].map(n=><option key={n} value={n}>{n} meses</option>)}</select><small>Você escolhe até quando a conta se repete.</small></label>}
 <label>Observações (opcional)<textarea maxLength={2000} rows={2} placeholder="Ex.: instrução de pagamento ou referência da conta" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
 </div>{!bill&&recurring&&<p className="bank-payable-warning">{dates.length?`${count} contas mensais, de ${dateText(dates[0])} até ${dateText(dates.at(-1)!)}.`:'Confira a data e o período.'} Em meses mais curtos, usamos o último dia do mês. Cada vencimento começa com este valor; você pode ajustá-lo depois se a conta variar.</p>}
 {bill&&<p className="bank-note">Esta alteração vale somente para este vencimento. Os demais meses da série permanecem como foram cadastrados.</p>}
 <p className="bank-note">Cadastrar uma conta não significa que ela foi paga. Depois do pagamento, use “Confirmar pagamento” para registrar a saída no caixa da loja ou no pessoal.</p>
 <div className="bank-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="bank-primary" disabled={busy}>{busy?'Salvando…':bill?'SALVAR ALTERAÇÕES':`CADASTRAR ${count===1?'CONTA':count+' VENCIMENTOS'}`}</button></div></fieldset>{error&&<p className="bank-error" role="alert">{error}</p>}</form>;
}
