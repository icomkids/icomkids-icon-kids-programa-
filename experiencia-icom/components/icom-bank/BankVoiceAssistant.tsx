'use client';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Square,Sparkles,X,ChevronDown,Volume2,VolumeX,Minus} from 'lucide-react';
import {audienceLabel,natureLabel} from '@/lib/icom-bank/expense-context';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
import {bankPath,currency,type BankRole} from '@/lib/icom-bank/model';
import type {HelpTopic} from '@/lib/icom-bank/assistant-guide';
import {VoiceResources,answerVoiceTools,prepareVoiceTools,type VoiceToolCall} from '@/lib/icom-bank/assistant-client';

import BankAssistantReport,{type AssistantReport,type AssistantReportResult} from './BankAssistantReport';

type FinancialPreview={summary:{label:string;value:string}[];destination:string;confirmation:string};
type Pending={payload?:AdminEntry;summary?:FinancialPreview['summary'];destination?:string;confirmation:string;financial?:boolean};
type Status='idle'|'connecting'|'listening'|'speaking'|'paused';
type Setup={configured:boolean;topics:HelpTopic[]};
type QuickResult={ok?:boolean;error?:string;consultado_em?:string;dados?:{ativos?:number;registros?:{nome:string}[];saldo_livre?:{valor:string};saldo_registrado?:{valor:string}}};
function IntelligenceOrb(){return <span className="bank-ai-orb" aria-hidden="true"><span className="bank-ai-atmosphere"/><span className="bank-ai-current first"/><span className="bank-ai-current second"/><span className="bank-ai-current third"/><span className="bank-ai-glass"/></span>;}
export default function BankVoiceAssistant({role,onPanelChange}:{role:BankRole;onPanelChange?:(expanded:boolean)=>void}){
 const router=useRouter();
 const [open,setOpen]=useState(false),[status,setStatus]=useState<Status>('idle'),[setup,setSetup]=useState<Setup|null>(null),[error,setError]=useState(''),[transcript,setTranscript]=useState(''),[message,setMessage]=useState(''),[left,setLeft]=useState(300);
 const resources=useRef<VoiceResources|null>(null),lease=useRef<string|null>(null),muted=useRef(false),button=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLDialogElement>(null),audio=useRef<HTMLAudioElement>(null);
 const [quickLoading,setQuickLoading]=useState(false),[quickText,setQuickText]=useState(''),[quickElapsed,setQuickElapsed]=useState<number|null>(null);
 const quickAbort=useRef<AbortController|null>(null);
 const answerStarted=useRef<number|null>(null),[answerLatency,setAnswerLatency]=useState<number|null>(null),[readLatency,setReadLatency]=useState<number|null>(null),[responding,setResponding]=useState(false);
 const [soundMuted,setSoundMuted]=useState(false),[audioBlocked,setAudioBlocked]=useState(false);
 const [pendingExpense,setPendingExpense]=useState<Pending|null>(null),[savingExpense,setSavingExpense]=useState(false),[expenseNotice,setExpenseNotice]=useState('');
 const pendingRef=useRef<typeof pendingExpense>(null),savingRef=useRef(false),preparingRef=useRef(false);
 const [report,setReport]=useState<AssistantReport|null>(null);
 const [minimized,setMinimized]=useState(false);
 useEffect(()=>{onPanelChange?.(open&&!minimized);},[open,minimized,onPanelChange]);
 const busy=status!=='idle';
 function releaseLease(id:string){void fetch(bankPath('/api/assistant')+'?id='+encodeURIComponent(id),{method:'DELETE',keepalive:true}).catch(()=>{});}
 function stop(){pendingRef.current=null;setPendingExpense(null);resources.current?.close();resources.current=null;if(lease.current){releaseLease(lease.current);lease.current=null;}muted.current=false;answerStarted.current=null;setResponding(false);setStatus('idle');}
 function close(){stop();quickAbort.current?.abort();setQuickLoading(false);setQuickText('');setQuickElapsed(null);setOpen(false);setReport(null);setSetup(null);setTranscript('');setMessage('');setError('');dialog.current?.close();button.current?.focus();}
 useEffect(()=>{const shutdown=()=>{resources.current?.close();resources.current=null;if(lease.current){releaseLease(lease.current);lease.current=null;}};const onPageHide=()=>{shutdown();muted.current=false;setStatus('idle');};window.addEventListener('pagehide',onPageHide);return()=>{window.removeEventListener('pagehide',onPageHide);shutdown();};},[]);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();
  fetch(bankPath('/api/assistant'),{signal:controller.signal,cache:'no-store'}).then(async r=>{const body=await r.json() as Setup&{error?:string};if(!r.ok)throw new Error(body.error||'Não foi possível abrir a ajuda.');return body;}).then(setSetup).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
  if(role==='OWNER')void fetch(bankPath('/api/assistant/quick'),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(7000)]),cache:'no-store'}).catch(()=>{});
  return()=>{controller.abort();quickAbort.current?.abort();};
 },[open,role]);
 const quick=useCallback(async(topic:'investidores'|'vendedores'|'caixa')=>{
  const channel=resources.current?.channel;
  if(channel?.readyState==='open'){
   if(responding)return;
   answerStarted.current=performance.now();setAnswerLatency(null);setReadLatency(null);setResponding(true);
   channel.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:topic==='investidores'?'Quantos investidores ativos tenho cadastrados e quais são os nomes?':topic==='vendedores'?'Quantos vendedores ativos tenho na loja e quais são os nomes?':'Qual é o saldo livre do caixa da loja agora?'}]}}));
   channel.send(JSON.stringify({type:'response.create'}));return;
  }
  quickAbort.current?.abort();const controller=new AbortController();quickAbort.current=controller;setQuickLoading(true);setQuickText('');setQuickElapsed(null);const start=performance.now();
  try{
   const response=await fetch(bankPath('/api/assistant/data')+'?topic='+topic,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(7000)]),cache:'no-store'}),result=await response.json() as QuickResult;
   if(!response.ok||!result.ok||!result.dados)throw new Error(result.error||'Não foi possível consultar agora.');
   const data=result.dados;
   if(topic==='caixa'){if(!data.saldo_livre?.valor)throw new Error('Saldo indisponível.');setQuickText(`Saldo livre para a loja: ${data.saldo_livre.valor}. Saldo dos registros, antes das reservas: ${data.saldo_registrado?.valor||'indisponível'}.`);}
   else{if(!Number.isInteger(data.ativos))throw new Error('Quantidade indisponível.');setQuickText(`${data.ativos} ${topic==='investidores'?'investidor(es)':'vendedor(es)'} ativo(s)${data.registros?.length?': '+data.registros.map(r=>r.nome).join(', '):''}.`);}
   setQuickElapsed(Math.round(performance.now()-start));
  }catch(e){if(!controller.signal.aborted)setQuickText(e instanceof Error&&e.name!=='TimeoutError'?e.message:'A consulta demorou mais que o esperado. Tente novamente.');}
  finally{if(!controller.signal.aborted)setQuickLoading(false);}
 },[responding]);
 async function start(listenOnly=false){
  if(resources.current)return;setError('');setMessage('');setTranscript('');
  setSoundMuted(false);setAudioBlocked(false);
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){setError('Este navegador não oferece conversa por voz. Use Chrome, Edge ou Safari atualizado e abra o endereço seguro do sistema.');return;}
  const r=new VoiceResources();resources.current=r;setStatus('connecting');muted.current=false;
  try{
   // Unlock audio from the user gesture, before waiting on microphone/network.
   r.audio=audio.current;r.setSpeakerMuted(false);r.audio?.play().catch(()=>{});
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
   if(listenOnly){muted.current=true;stream.getAudioTracks().forEach(t=>{t.enabled=false;});}
   if(!r.attachStream(stream))return;
   const pc=new RTCPeerConnection();r.peer=pc;
   pc.ontrack=e=>{if(!r.cancelled&&r.audio){r.audio.srcObject=e.streams[0];void r.audio.play().catch(()=>{if(!r.cancelled){setAudioBlocked(true);setError('O navegador bloqueou o som. Toque em Ativar áudio para ouvir.');}});}};
   stream.getAudioTracks().forEach(t=>pc.addTrack(t,stream));
   const dc=pc.createDataChannel('oai-events');r.channel=dc;
   dc.onmessage=e=>{
    if(r.cancelled)return;
    let event:{type:string;transcript?:string;delta?:string;item?:VoiceToolCall;response?:{status:string;output?:VoiceToolCall[]}};
    try{event=JSON.parse(e.data);}catch{return;}
    if(event.type==='input_audio_buffer.speech_started'){setStatus(muted.current?'paused':'listening');setMessage('Ouvindo sua pergunta…');}
    if(event.type==='input_audio_buffer.speech_stopped'){answerStarted.current=performance.now();setAnswerLatency(null);setReadLatency(null);setMessage('Preparando a resposta…');}
    if(event.type==='response.output_audio_transcript.delta'){if(answerStarted.current!==null){setAnswerLatency(Math.round(performance.now()-answerStarted.current));answerStarted.current=null;}setStatus(muted.current?'paused':'speaking');setTranscript(t=>(t+(event.delta||'')).slice(-6000));}
    if(event.type==='response.output_audio_transcript.done')setTranscript((event.transcript||'').slice(0,6000));
    if(event.type==='response.created'){setResponding(true);setTranscript('');}
    if(event.type==='response.done'&&event.response?.status!=='completed')setResponding(false);
    const readTool=async(name:string,args:unknown)=>{
     if(name!=='consultar_dados_icom'&&(pendingRef.current||preparingRef.current))return {ok:false,error:'Há um lançamento em preparação ou aguardando confirmação no painel. Confirme ou cancele antes de preparar outra.'};
     const writing=name!=='consultar_dados_icom';if(writing)preparingRef.current=true;
     try{
     if(!lease.current||r.cancelled)throw new Error('Conversa encerrada.');
     const started=performance.now();
     const response=await fetch(bankPath(name==='preparar_lancamento_icom'?'/api/assistant/financial':name==='preparar_despesa_icom'?'/api/assistant/expense':'/api/assistant/data'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:lease.current,name,arguments:args}),signal:AbortSignal.any([r.abort.signal,AbortSignal.timeout(writing?45000:10000)])});
     const result=await response.json() as AssistantReportResult&{pending?:Pending};if(!r.cancelled&&writing&&result.pending){const pending={...result.pending,financial:name==='preparar_lancamento_icom'};pendingRef.current=pending;setPendingExpense(pending);setExpenseNotice('');}if(!r.cancelled&&!writing&&result.ok)setReport({input:args as Record<string,unknown>,result});
     if(!r.cancelled)setReadLatency(Math.round(performance.now()-started));if(!response.ok)return {ok:false,error:result.error||'Solicitação indisponível. Não invente valores.'};return writing?{ok:result.ok,saved:false,payload:result.pending?.payload,summary:result.pending?.summary,destination:result.pending?.destination,message:'Ainda não salvo. Diga apenas: Confira o resumo e confirme no botão, por favor. Não repita o pedido nem leia todos os campos.'}:result;
     }finally{if(writing)preparingRef.current=false;}
    };
    if(event.type==='response.output_item.done'&&event.item?.type==='function_call')prepareVoiceTools(r,[event.item],readTool);
    if(event.type==='response.done'&&event.response?.status==='completed'&&event.response.output?.some(i=>i.type==='function_call')){
     setMessage('Consultando os dados do sistema…');
     const items=event.response.output;
     r.toolQueue=r.toolQueue.then(()=>answerVoiceTools(r,items,readTool)).catch(()=>{if(!r.cancelled)setError('Não foi possível concluir a consulta. Tente novamente.');});
    }
    if(event.type==='output_audio_buffer.stopped'){setResponding(false);setStatus(muted.current?'paused':'listening');setMessage('Pode fazer outra pergunta.');}
    if(event.type==='error'||event.type==='response.done'&&event.response?.status==='failed'){stop();setError('A conversa foi interrompida. Confira a conexão e tente novamente.');}
   };
   dc.onopen=()=>{if(r.cancelled)return;setStatus(muted.current?'paused':'listening');setMessage(muted.current?'Microfone pausado. Toque em uma consulta para ouvir a resposta.':'Pode falar. Qual é sua dúvida sobre o ICOM Bank?');};
   dc.onclose=()=>{if(!r.cancelled){stop();setMessage('Conversa encerrada. Você pode iniciar outra.');}};
   pc.onconnectionstatechange=()=>{if(!r.cancelled&&['failed','disconnected','closed'].includes(pc.connectionState)){stop();setError('A conexão de voz foi encerrada. Você pode tentar novamente.');}};
   const offer=await pc.createOffer();if(r.cancelled)return;await pc.setLocalDescription(offer);
   const pathname=location.pathname.replace(/^\/experiencia-icom/,'');const section=pathname.split('/')[2]||'dashboard';
   const response=await fetch(bankPath('/api/assistant'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:offer.sdp,section}),signal:r.abort.signal});
   const data=await response.json() as {id?:string;sdp?:string;expiresAt?:number;error?:string};
   if(!response.ok)throw new Error(data.error||'Não foi possível iniciar a conversa.');
   if(!data.id||!data.sdp||!data.expiresAt)throw new Error('A conexão não foi confirmada. Tente novamente.');
   if(r.cancelled){releaseLease(data.id);return;}
   lease.current=data.id;await pc.setRemoteDescription({type:'answer',sdp:data.sdp});
   const deadline=Math.min(data.expiresAt,Date.now()+300000);setLeft(Math.max(0,Math.ceil((deadline-Date.now())/1000)));
   r.timer=setInterval(()=>{const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));setLeft(remaining);if(!remaining){stop();setMessage('Conversa encerrada após 5 minutos. Você pode iniciar outra.');}},1000);
  }catch(e){if(r.cancelled)return;stop();const name=e instanceof DOMException?e.name:'';setError(name==='NotAllowedError'?'Permita o microfone no navegador para conversar. Ele fica desligado ao encerrar.':name==='NotFoundError'?'Nenhum microfone foi encontrado neste dispositivo.':e instanceof Error?e.message:'Não foi possível iniciar a voz.');}
 }
 async function confirmExpense(){
  const pending=pendingRef.current,r=resources.current,id=lease.current;if(!pending||!r||!id||savingRef.current)return;
  savingRef.current=true;setSavingExpense(true);setExpenseNotice('');
  try{const response=await fetch(bankPath(pending.financial?'/api/assistant/financial':'/api/assistant/expense'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,confirmation:pending.confirmation}),signal:AbortSignal.timeout(15000)}),result=await response.json() as {saved?:boolean;error?:string;row?:AdminEntry;destination?:string;message?:string};
   if(!response.ok||!result.saved||!result.row)throw new Error(result.error||'Não foi possível confirmar. Confira o histórico antes de repetir.');
   pendingRef.current=null;setPendingExpense(null);const message=pending.financial?result.message||'Registro salvo.':`Lançado: ${currency(Number(result.row.amount_cents))} — ${result.row.description}.`;setExpenseNotice(message);window.dispatchEvent(new Event('icom-bank-ledger-changed'));router.refresh();
   if(!r.cancelled&&r.channel?.readyState==='open'){r.channel.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'Resultado do servidor após minha confirmação no botão: '+JSON.stringify(pending.financial?{saved:true,destination:result.destination}:{saved:true,description:result.row.description,amount:currency(Number(result.row.amount_cents)),category:result.row.category,scope:result.row.scope})+'. Diga apenas: Pronto, está salvo na área retornada pelo servidor. Não repita o valor ou o pedido. Não crie outro lançamento.'}]}}));if(!responding)r.channel.send(JSON.stringify({type:'response.create'}));}
  }catch(e){setExpenseNotice(e instanceof Error?e.message:'Confira o histórico antes de repetir.');}finally{savingRef.current=false;setSavingExpense(false);}
 }
 function pause(){const stream=resources.current?.stream;if(!stream)return;muted.current=!muted.current;stream.getAudioTracks().forEach(t=>{t.enabled=!muted.current;});setStatus(muted.current?'paused':'listening');setMessage(muted.current?'Microfone pausado.':'Pode continuar sua pergunta.');}
 function toggleSound(){const next=audioBlocked?false:!soundMuted;setSoundMuted(next);resources.current?.setSpeakerMuted(next);if(audio.current)audio.current.muted=next;if(!next&&audio.current?.srcObject)void audio.current.play().then(()=>{setAudioBlocked(false);setError('');}).catch(()=>{setAudioBlocked(true);setError('Não foi possível reproduzir o áudio. Confira o som do dispositivo e toque em Ativar áudio.');});}
 const topicQuestions=setup?.topics.filter(t=>role==='OWNER'?['pagar','receber','caixa'].includes(t.id):['clientes','contratos','comprovantes','parcelas'].includes(t.id)).slice(0,3)||[];
 return <>
  <span id="bank-ai-activation-hint" hidden>Ao clicar, a conversa por voz começa com o áudio ligado e solicita acesso ao microfone. Você pode silenciar o áudio, pausar o microfone ou encerrar.</span>
  <button ref={button} className={'bank-voice-launch'+(busy?' is-active':'')} aria-label="Conversar com a ICOM IA por áudio" aria-describedby="bank-ai-activation-hint" aria-haspopup="dialog" aria-expanded={open&&!minimized} onClick={()=>{setOpen(true);setMinimized(false);if(!dialog.current?.open)dialog.current?.show();void start();}}>
   <IntelligenceOrb/><span className="bank-ai-label"><strong>ICOM <b>IA</b></strong><small>{busy?'Conversa em andamento':'Toque para conversar'}</small></span>
  </button>
  <button className="bank-ai-report-open" aria-haspopup="dialog" onClick={()=>{setOpen(true);setMinimized(false);if(!dialog.current?.open)dialog.current?.show();}}>Consultar sem microfone</button>
  <dialog ref={dialog} className="bank-voice-dialog" aria-modal="false" aria-labelledby="bank-voice-title" onCancel={e=>{e.preventDefault();close();}}>
   <div className="bank-voice-panel">
    <header><div><span className="bank-voice-eyebrow">INTELIGÊNCIA ARTIFICIAL DO SISTEMA</span><h2 id="bank-voice-title">ICOM IA</h2></div><div className="bank-voice-window-controls"><button aria-label="Minimizar IA e continuar conversa" onClick={()=>{setMinimized(true);dialog.current?.close();button.current?.focus();}}><Minus size={19}/></button><button aria-label="Fechar ajuda e desligar microfone" onClick={close}><X size={19}/></button></div></header>
    <p className="bank-voice-working-hint">Pode continuar usando o sistema enquanto conversamos. Minimizar mantém a conversa; fechar desliga o microfone.</p>
    <div className={'bank-voice-stage '+status}>
     <div className="bank-voice-halo" aria-hidden="true"><IntelligenceOrb/></div>
     <strong>{status==='connecting'?'Conectando…':status==='paused'?'Microfone pausado':status==='speaking'?'Explicando para você':status==='listening'?'Estou ouvindo':setup&&!setup.configured?'Voz aguardando ativação':'Vamos resolver sua dúvida?'}</strong>
     <p>{message||(role==='OWNER'?'Pergunte sobre lucro das vendas, despesas pessoais, investidores e os números do sistema.':'Pergunte sobre os dados e as telas disponíveis para o seu perfil.')}</p>
    </div>
    {pendingExpense?.payload&&<section className="bank-panel" aria-label="Confirmar despesa por voz"><h3>Conferir lançamento</h3><p><strong>{currency(pendingExpense.payload.amount_cents||0)}</strong> · {pendingExpense.payload.description}</p><p>{pendingExpense.payload.scope==='PESSOAL'?'Pessoal':'Loja'} · {pendingExpense.payload.category} · {pendingExpense.payload.entry_date.split('-').reverse().join('/')}{pendingExpense.payload.details.plate?' · '+pendingExpense.payload.details.plate:''}</p>{pendingExpense.payload.scope==='PESSOAL'&&<p>{audienceLabel(pendingExpense.payload.details.expense_audience)} · {natureLabel(pendingExpense.payload.details.expense_nature)}{pendingExpense.payload.details.trip_name?' · '+pendingExpense.payload.details.trip_name:''}</p>}<small>Ainda não foi salvo. Confira antes de confirmar.</small><div className="bank-voice-controls"><button disabled={savingExpense} onClick={()=>void confirmExpense()}>{savingExpense?'Salvando…':'Confirmar lançamento'}</button><button disabled={savingExpense} onClick={()=>{pendingRef.current=null;setPendingExpense(null);setExpenseNotice('Despesa cancelada. Nada foi lançado.');}}>Cancelar</button></div></section>}
    {pendingExpense?.financial&&<section className="bank-panel" aria-label="Confirmar registro financeiro por voz"><h3>Conferir lançamento · {pendingExpense.destination}</h3><dl>{pendingExpense.summary?.map((item,index)=><div key={index} style={{padding:'6px 0'}}><dt style={{fontWeight:600}}>{item.label}</dt><dd style={{margin:0}}>{item.label==='Comprovante'&&/^[a-f0-9-]{36}$/i.test(item.value)?<a href={bankPath('/comprovantes/'+item.value)} target="_blank" rel="noopener noreferrer">Conferir comprovante e dados da parcela ↗</a>:item.value}</dd></div>)}</dl><p>Ainda não foi salvo. Confira todos os dados antes de confirmar.</p><div className="bank-voice-controls"><button disabled={savingExpense} onClick={()=>void confirmExpense()}>{savingExpense?'Salvando…':'Confirmar lançamento'}</button><button disabled={savingExpense} onClick={()=>{pendingRef.current=null;setPendingExpense(null);setExpenseNotice('Cancelado. Nada foi lançado.');}}>Cancelar</button></div></section>}
    {pendingExpense?.payload?.details.plate&&<p className="bank-voice-working-hint">{pendingExpense.payload.details.stock_id?'Este custo será somado aos custos do veículo cadastrado.':'O custo ficará na loja, identificado pela placa. Não há veículo disponível no estoque para vincular.'} Confira a placa antes de confirmar.</p>}
    {expenseNotice&&<p role="status">{expenseNotice}</p>}
    {error&&<p className="bank-error" role="alert">{error}</p>}
    {setup&&!setup.configured&&<p className="bank-voice-activation">A conversa por voz precisa ser ativada pelo administrador. Enquanto isso, consulte as orientações rápidas abaixo.</p>}
    {!setup&&!error&&<p role="status">Carregando a ajuda…</p>}
    {busy?<div className="bank-voice-controls"><button onClick={pause} disabled={status==='connecting'} aria-label={status==='paused'?'Retomar microfone':'Pausar microfone'}>{status==='paused'?<MicOff size={17}/>:<Mic size={17}/>} {status==='paused'?'Retomar':'Pausar'}</button><button className="bank-voice-end" onClick={()=>{stop();setMessage('Conversa encerrada. Microfone desligado.');}}><Square size={15}/> Encerrar</button><small>{Math.floor(left/60)}:{String(left%60).padStart(2,'0')}</small></div>:<button className="bank-voice-start" disabled={!setup?.configured} onClick={()=>void start()}><Sparkles size={18}/> Conversar com a IA</button>}
    <audio ref={audio} autoPlay playsInline muted={soundMuted} hidden/>
    {!busy&&role==='OWNER'&&setup?.configured&&<button className="bank-voice-audio" onClick={()=>void start(true)}><Volume2 size={15}/> Ouvir consultas com microfone pausado</button>}
    {busy&&<button className="bank-voice-audio" aria-pressed={soundMuted} onClick={toggleSound}>{soundMuted||audioBlocked?<VolumeX size={15}/>:<Volume2 size={15}/>} {soundMuted||audioBlocked?'Ativar áudio':'Silenciar áudio'}</button>}
    <p className="bank-voice-privacy">Ao iniciar, seu áudio e os resultados das consultas autorizadas serão enviados à OpenAI para responder por voz. {role==='OWNER'?'A IA consulta todas as áreas permitidas e prepara registros financeiros, salvos somente após sua confirmação no botão. Retiradas e transferências continuam manuais.':'A IA consulta os dados permitidos para sua conta, sem alterar registros.'} Ao fechar, o microfone é desligado.</p>
    {role==='OWNER'&&<section className="bank-voice-guide" aria-label="Consultas rápidas"><h3>Consultas rápidas</h3><p>{busy?'Toque para ouvir a resposta ou faça sua pergunta por voz.':'Pergunte por voz ou confira estes números sem ligar o microfone.'}</p><div className="bank-voice-controls">{(['investidores','vendedores','caixa'] as const).map(topic=><button key={topic} disabled={quickLoading||busy&&(status==='connecting'||responding)} onClick={()=>void quick(topic)}>{topic==='investidores'?'Investidores':topic==='vendedores'?'Vendedores':'Saldo do caixa'}</button>)}</div>{(quickLoading||quickText)&&<p role="status" data-query-ms={quickElapsed??undefined}>{quickLoading?'Consultando…':quickText}</p>}</section>}
    <BankAssistantReport key={JSON.stringify(report?.input||{})+'-'+(report?.result.consultado_em||'')} role={role} report={report} onReport={setReport}/>
    {transcript&&<div className="bank-voice-transcript" data-first-voice-ms={answerLatency??undefined} data-voice-query-ms={readLatency??undefined}><small>RESPOSTA DO ASSISTENTE</small><p>{transcript}</p></div>}
    {setup&&<section className="bank-voice-guide" aria-label="Orientações rápidas"><h3>Orientações rápidas</h3><p>Você também pode consultar estes passos sem ligar o microfone.</p>{topicQuestions.map(t=><details key={t.id}><summary>{t.question}<ChevronDown size={15}/></summary><p>{t.text}</p></details>)}<details><summary>Ver todos os tópicos <ChevronDown size={15}/></summary>{setup.topics.map(t=><details key={t.id}><summary>{t.title}</summary><p>{t.text}</p></details>)}</details></section>}
   </div>
  </dialog>
 </>;
}
