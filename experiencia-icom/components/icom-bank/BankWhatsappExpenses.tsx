'use client';
import {useCallback,useEffect,useState} from 'react';
import Image from 'next/image';
import {bankPath} from '@/lib/icom-bank/model';
import type {Connection} from '@/lib/whatsapp';
type Settings={phone:string;allowed_phones:string[];enabled:boolean;status:string;updated_at:string};
type History={id:string;sender:string;type:string;transcript:string;status:string;entry_id:string|null;reply:string;reply_status:string;created_at:string};
type Result={settings:Settings|null;connection:Connection|null;history:History[];ai_configured:boolean;error?:string};
const labels:Record<string,string>={FILA:'Recebido',PROCESSANDO:'Lendo a despesa',LANCADO:'Lançado',ESCLARECER:'Precisa de informação',ERRO:'Verificar',RESOLVIDO:'Resolvido'};
export default function BankWhatsappExpenses(){
 const [result,setResult]=useState<Result|null>(null),[phone,setPhone]=useState(''),[allowed,setAllowed]=useState(''),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [connection,setConnection]=useState<Connection|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{const r=await fetch(bankPath('/api/whatsapp'),{cache:'no-store',signal}),d=await r.json() as Result;if(!r.ok)throw new Error(d.error||'Não foi possível abrir a integração.');return d;},[]);
 useEffect(()=>{const c=new AbortController();void load(c.signal).then(d=>{if(c.signal.aborted)return;setResult(d);setConnection(d.connection);setPhone(d.settings?.phone||'');setAllowed(d.settings?.allowed_phones.join('\n')||'');setEnabled(d.settings?.enabled||false);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Não foi possível carregar.');});return()=>c.abort();},[load]);
 async function action(kind:'save'|'connect'|'refresh'){
  setBusy(true);setError('');setNotice('');try{
   if(kind==='refresh'){const fresh=await load();setResult(fresh);setConnection(fresh.connection);return;}
   const r=await fetch(bankPath('/api/whatsapp'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(kind==='save'?{action:'save',phone,allowed_phones:allowed.split(/[\n,;]/).map(n=>n.trim()).filter(Boolean),enabled,expected_updated_at:result?.settings?.updated_at}: {action:'connect'})}),d=await r.json() as {error?:string;connection?:Connection};if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');
   if(kind==='connect')setConnection(d.connection||null);else{const fresh=await load();setResult(fresh);setConnection(fresh.connection);setNotice('Números e preferência salvos. Conecte o WhatsApp pelo QR Code para começar.');}
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}
 }
 return <><div className="bank-heading"><div><p className="bank-eyebrow">ADMINISTRATIVO POR VOZ</p><h1>WhatsApp ICOM Bank</h1><p>Fale uma despesa. O sistema organiza e registra para você.</p></div><a href={bankPath('/administrativo')}>Voltar ao Administrativo</a></div>
  <div className="bank-wa-grid"><section className="bank-card"><h2>1. Conecte o contato ICOM Bank</h2><p>Use um número próprio para receber os áudios, separado dos WhatsApps dos vendedores. Salve esse contato no seu celular como <strong>ICOM Bank</strong>.</p>
   {error&&<p className="bank-error" role="alert">{error}</p>}{notice&&<p className="bank-note" role="status">{notice}</p>}
   <form onSubmit={e=>{e.preventDefault();void action('save');}}><label>Número do WhatsApp ICOM Bank<input required inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="DDD + número que será conectado"/></label>
    <label>Números autorizados a enviar despesas<textarea required rows={3} value={allowed} onChange={e=>setAllowed(e.target.value)} placeholder="Seu número com DDD. Um por linha."/></label>
    <small>Esses números poderão registrar despesas pessoais e da loja em seu nome. Somente você pode alterar esta autorização.</small>
    <label className="bank-wa-switch"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Ativar lançamentos automáticos</label>
    <div className="bank-actions"><button type="submit" disabled={busy||!result}>Salvar números</button><button type="button" disabled={busy||!result?.settings} onClick={()=>void action('connect')}>Conectar WhatsApp / QR Code</button></div>
   </form>
   <div className={'bank-wa-status '+(connection?.connected?'connected':'')}><strong>{connection?.connected?'● Conectado':'○ Aguardando conexão'}</strong><p>{connection?.message||'Salve o número e clique em Conectar WhatsApp.'}</p>{result?.settings&&!enabled&&<p>Os lançamentos estão desativados. Você pode conectar e testar o QR antes de ativar.</p>}</div>
   {connection?.qr&&<div className="bank-wa-qr">{/* QR is a validated, inline data URI from the authenticated instance. */}<Image unoptimized src={connection.qr} alt="QR Code para conectar o WhatsApp ICOM Bank" width={240} height={240}/><p>No celular desse número: WhatsApp → Aparelhos conectados → Conectar um aparelho.</p></div>}
   {connection?.paircode&&<p>Código de conexão: <strong>{connection.paircode}</strong></p>}
   <button type="button" disabled={busy} onClick={()=>void action('refresh')}>{busy?'Aguarde…':'Atualizar conexão e histórico'}</button>
   {result&&!result.ai_configured&&<p className="bank-error">A chave OpenAI precisa estar ativa no servidor para ler os áudios.</p>}
  </section><section className="bank-card bank-wa-help"><span className="bank-pill gold">SEM DIGITAR NA PLANILHA</span><h2>2. Envie uma despesa por áudio</h2><p>Envie do seu número autorizado para o contato ICOM Bank. Uma despesa por mensagem, com o valor e o que você pagou.</p>
   <blockquote>“Paguei no Pix R$ 250 da escola da minha filha. Lança nas minhas despesas pessoais.”</blockquote><p><strong>Resultado:</strong> R$ 250,00 em Despesas pessoais.</p>
   <blockquote>“Despesa da loja: paguei R$ 180 na conta de luz, hoje, no Pix.”</blockquote><p><strong>Resultado:</strong> R$ 180,00 em Despesas da loja.</p>
   <blockquote>“Custo de um carro da loja: comprei um pneu de R$ 450 para a placa ABC1D23, pago no cartão.”</blockquote><p><strong>Resultado:</strong> custo vinculado ao carro que estiver cadastrado em estoque com essa placa.</p>
   <div className="bank-note"><strong>3. Confira a resposta</strong><p>O WhatsApp confirma valor, data e destino após salvar. Se faltar um dado ou a placa não for encontrada, ele pergunta antes de lançar. Você pode responder com a informação que faltou.</p><p>O destino padrão é Pessoal. Para uma despesa da empresa, diga “da loja”. Somente pagamentos já realizados entram como saída; este acesso registra o que você pagou.</p></div>
   <p>O lançamento aparece no Administrativo e na conferência diária. Custos de estoque entram no histórico do carro. Você pode corrigir ou arquivar pelo painel, preservando o histórico.</p>
   <small>Áudios de números autorizados são processados pela OpenAI. A transcrição fica no histórico privado do proprietário; o arquivo de áudio não é armazenado pelo aplicativo.</small>
   {connection?.connected&&result?.settings&&<a className="bank-wa-open" target="_blank" rel="noopener noreferrer" href={'https://wa.me/'+result.settings.phone}>Abrir contato ICOM Bank no WhatsApp ↗</a>}
  </section></div>
  <section className="bank-card"><h2>Últimas mensagens e lançamentos</h2><p>“Lançado” confirma o registro financeiro. “Aceito pelo WhatsApp” confirma o envio da resposta ao serviço.</p><div className="bank-table-wrap"><table className="bank-table"><thead><tr><th>Quando</th><th>Remetente</th><th>Mensagem</th><th>Situação</th><th>Resposta</th></tr></thead><tbody>{result?.history.map(h=><tr key={h.id}><td>{new Date(h.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</td><td>{h.sender}</td><td>{h.transcript||'Áudio aguardando leitura'}</td><td><span className={'bank-pill '+(h.status==='LANCADO'?'green':'gold')}>{labels[h.status]||h.status}</span>{h.entry_id&&<small>Registro {h.entry_id.slice(0,8)}</small>}</td><td>{h.reply}<small>{h.reply_status==='ACEITO'?'Resposta aceita pelo WhatsApp':h.reply_status==='INCERTO'||h.reply_status==='ENVIANDO'?'Envio em conferência':h.reply_status==='FALHOU'?'Resposta não enviada':'Resposta pendente'}</small></td></tr>)}</tbody></table>{!result?.history.length&&<p>Nenhuma mensagem recebida ainda. Conecte o número e envie a primeira despesa.</p>}</div></section>
 </>;
}
