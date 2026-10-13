'use client';
import {useCallback,useEffect,useState} from 'react';
import {bankPath} from '@/lib/icom-bank/model';
type Contact={id:string;name:string;phone:string;subscriber_id:string|null;active:boolean;updated_at:string};
type Subscriber={id:string;store_name:string;deployment_status:string};
type Result={rows:Contact[];subscribers:Subscriber[];error?:string};
export default function BankWhatsappSubscribers(){
 const [data,setData]=useState<Result>({rows:[],subscribers:[]}),[name,setName]=useState(''),[phone,setPhone]=useState(''),[subscriber,setSubscriber]=useState(''),[editing,setEditing]=useState<Contact|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[removed,setRemoved]=useState(false);
 const load=useCallback(async(signal?:AbortSignal)=>{const r=await fetch(bankPath('/api/whatsapp/subscribers'),{cache:'no-store',signal}),d=await r.json() as Result;if(!r.ok)throw new Error(d.error||'Não foi possível carregar os assinantes.');return d;},[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal).then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[load]);
 async function save(action='save',contact:Contact|null=editing){
  setBusy(true);setError('');setNotice('');try{
   const body={action,...(contact?{id:contact.id,expected_updated_at:contact.updated_at}:{}),...(action==='save'?{name,phone,subscriber_id:subscriber||null}:{})};
   const r=await fetch(bankPath('/api/whatsapp/subscribers'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json() as {error?:string};
   if(!r.ok)throw new Error(d.error||'Não foi possível salvar.');
   if(action==='save'){setName('');setPhone('');setSubscriber('');setEditing(null);}
   setData(await load());setNotice(action==='remove'?'Número removido da lista ativa. Você pode restaurá-lo.':action==='restore'?'Cadastro restaurado.':'Número salvo. O acesso continua aguardando o ambiente separado da loja.');
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}
 }
 return <section className="bank-card bank-wa-subscribers"><div className="bank-heading"><div><span className="bank-pill gold">SOMENTE VOCÊ</span><h2>Números dos assinantes</h2><p>Cadastre uma pessoa ou loja por número. {data.rows.filter(r=>r.active).length} de 40 números ativos.</p></div></div>
 <div className="bank-note"><strong>Cada loja terá seus próprios dados.</strong><p>Este cadastro prepara os acessos. O número não entra na autorização da ICOM e ainda não consulta ou lança dados. A liberação exige o ambiente separado daquela loja. O assinante verá apenas o campo do próprio telefone e o contato IA Bank já definido.</p></div>
 {error&&<p className="bank-error" role="alert">{error}</p>}{notice&&<p className="bank-note" role="status">{notice}</p>}
 <form onSubmit={e=>{e.preventDefault();void save();}}><div className="bank-form-grid"><label>Nome da pessoa ou loja<input required minLength={2} maxLength={100} disabled={busy} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Auto Loja Silva"/></label><label>WhatsApp do assinante<input required inputMode="tel" disabled={busy} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="DDD + número"/></label><label>Vincular a uma assinatura (opcional)<select disabled={busy} value={subscriber} onChange={e=>setSubscriber(e.target.value)}><option value="">Vincular depois</option>{data.subscribers.map(s=><option key={s.id} value={s.id}>{s.store_name}</option>)}</select></label></div><div className="bank-actions"><button type="submit" className="bank-primary" disabled={busy}>{busy?'Salvando…':editing?'Salvar alteração':'Adicionar e salvar número'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setName('');setPhone('');setSubscriber('');}}>Cancelar edição</button>}</div></form>
 <label className="bank-checkbox"><input type="checkbox" checked={removed} onChange={e=>setRemoved(e.target.checked)}/>Mostrar removidos</label>
 <div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Pessoa / loja</th><th>Número</th><th>Assinatura</th><th>Acesso</th><th>Ações</th></tr></thead><tbody>{data.rows.filter(r=>r.active||removed).map(r=><tr key={r.id}><td>{r.name}</td><td>{r.phone}</td><td>{data.subscribers.find(s=>s.id===r.subscriber_id)?.store_name||'Vincular depois'}</td><td><span className="bank-pill gold">{r.active?'Aguardando ambiente da loja':'Removido'}</span></td><td className="bank-actions">{r.active?<><button disabled={busy} onClick={()=>{setEditing(r);setName(r.name);setPhone(r.phone);setSubscriber(r.subscriber_id||'');}}>Editar</button><button disabled={busy} onClick={()=>void save('remove',r)}>Remover</button></>:<button disabled={busy} onClick={()=>void save('restore',r)}>Restaurar</button>}</td></tr>)}</tbody></table>{!data.rows.length&&<p>Nenhum número de assinante cadastrado.</p>}</div>
 <a href={bankPath('/assinantes')}>Abrir controle das assinaturas →</a></section>;
}
