import {interpretConversation} from './conversation-interpreter.ts';
import {prepareConversation} from './conversation-execution.ts';
import {validMemory,type CompanyContext,type ConversationMemory} from './conversation-context.ts';
import {sortWhatsAppRows} from './whatsapp-consultations.ts';
import type {AssistantReader} from './assistant-data.ts';
import type {FinancialPending} from './assistant-financial.ts';
import {agendaChoice} from './whatsapp-agenda-confirmation.ts';
import {sharedAssistantCache} from './assistant-cache.ts';
type Row=Record<string,unknown>;
type Message={id:string;claim_id:string};
type Rpc=<T>(path:string,body?:unknown)=>Promise<T>;
type Draft={id:string;version:string;source:string;status:string;summary:string;actions:FinancialPending[]};
export type ConversationEnvelope={memory:ConversationMemory;companies:CompanyContext[];pending:Draft|null};
export async function conversationWhatsApp(m:Message,text:string,today:string,key:string,rpc:Rpc){
 const started=performance.now(),timings:Record<string,number>={};let stage=performance.now();
 const args={p_id:m.id,p_claim:m.claim_id},context=await rpc<ConversationEnvelope>('rpc/icom_bank_conversation_context',args);timings.context_ms=performance.now()-stage;
 const pending=context.pending,choice=agendaChoice(text);
 if(pending&&choice){
  if(choice==='CONFIRMAR'){
   if(pending.status==='EDITANDO')return {reply:'Envie a correção para eu preparar um novo resumo.',status:'RESOLVIDO'};
   await rpc('rpc/icom_bank_conversation_confirm',{...args,p_draft:pending.id,p_version:pending.version,p_auto:false});sharedAssistantCache().clear();return {committed:true};
  }
  await rpc('rpc/icom_bank_conversation_edit',{...args,p_draft:pending.id,p_version:pending.version,p_cancel:choice==='CANCELAR'});
  return {reply:choice==='CANCELAR'?'Rascunho cancelado. Nada foi registrado.':'Escreva só o que quer mudar. Vou mostrar o resumo corrigido antes de salvar.',status:'RESOLVIDO'};
 }
 if(!pending&&choice)return {reply:'Não há resumo aguardando confirmação. Envie o que deseja registrar.',status:'RESOLVIDO'};
 if(pending&&/^(?:j[aá] (?:salvou|lan[çc]ou|foi)|foi (?:salvo|lan[çc]ado)|est[aá] salvo)/i.test(text))return {reply:'Ainda não foi salvo. Confira o resumo e responda 1 para confirmar ou 2 para editar.',status:'RESOLVIDO'};
 const memory=validMemory(context.memory);
 if(pending&&(pending.status==='EDITANDO'||/^(?:na verdade|mude|altere|troque|corrija|2[ —:-])/i.test(text))){memory.pending_source=pending.source;memory.pending_at=Date.now();}
 stage=performance.now();const interpreted=await interpretConversation(text,today,key,context.companies,memory);timings.interpret_ms=performance.now()-stage;timings.model_calls=interpreted.model_calls;
 const memo=new Map<string,Promise<unknown[]>>();const rows=(table:string)=>{let p=memo.get(table);if(!p){p=rpc<unknown[]>('rpc/icom_bank_whatsapp_read_rows',{...args,p_table:table});memo.set(table,p);}return p;};
 const reader:AssistantReader={rows:async path=>{const table=/^(icom_bank_[a-z_]+)\?/.exec(path)?.[1];if(!table)throw Error('Consulta indisponível.');return sortWhatsAppRows(await rows(table==='icom_bank_admin_entries'?'ledger':table),path);},ledger:async()=>await rows('ledger') as import('./cash').CashEntry[],staff:()=>rows('icom_bank_user_access')};
 stage=performance.now();const prepared=await prepareConversation(interpreted.plan,text,today,context.companies,memory,'OWNER',reader,async p=>await reader.rows(p) as Row[]);timings.prepare_ms=performance.now()-stage;
 await rpc('rpc/icom_bank_conversation_remember',{...args,p_memory:prepared.memory});
 const writes=prepared.results.filter(r=>r.pending).map(r=>r.pending!),other=prepared.results.filter(r=>!r.pending).map(r=>r.reply);
 let reply=other.join('\n\n');
 if(writes.length){
  const preview=writes.map((p,i)=>(i+1)+'. '+p.destination+'\n'+p.summary.filter(s=>!['Conferência','Situação','Registro'].includes(s.label)).slice(0,8).map(s=>s.label+': '+s.value).join(' · ')).join('\n\n');
  const auto=prepared.results.length===1&&writes.every(p=>p.operation==='LANCAMENTO'&&['PESSOAL','CUSTO'].includes(String((p.args.p_payload as Row)?.kind)));
  const summary=[reply,preview,auto?'':'1 — Confirmar registros acima\n2 — Editar\nCancelar — descartar rascunho'].filter(Boolean).join('\n\n');
  stage=performance.now();const draft=await rpc<Draft>('rpc/icom_bank_conversation_prepare',{...args,p_actions:writes,p_source:interpreted.plan.continues_previous&&memory.pending_source?memory.pending_source+'\n'+text:text,p_summary:summary});
  if(auto){await rpc('rpc/icom_bank_conversation_confirm',{...args,p_draft:draft.id,p_version:draft.version,p_auto:true});sharedAssistantCache().clear();timings.commit_ms=performance.now()-stage;timings.total_ms=performance.now()-started;console.info('ia_bank_conversation',JSON.stringify(timings));return {committed:true};}
  reply=summary;
 }
 timings.table_reads=memo.size;timings.total_ms=performance.now()-started;console.info('ia_bank_conversation',JSON.stringify(timings));
 return {reply:reply||'Não houve alteração. Informe o que deseja consultar ou registrar.',status:prepared.results.some(r=>r.kind==='QUESTION')&&!writes.length?'ESCLARECER':'RESOLVIDO'};
}
