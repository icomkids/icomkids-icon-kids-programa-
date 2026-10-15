import {naturalFold} from './natural-money.ts';
export type ConversationScope='PESSOAL'|'LOJA';
export type CompanyContext={id:string;name:string;aliases:string[]};
export type ConversationContext={scope:ConversationScope;company:string|null;selected_at:number};
export type ConversationMemory={active?:ConversationContext;recent?:ConversationContext;last_query?:Record<string,unknown>;query_at?:number;pending_source?:string;pending_at?:number};
export const contextTtl=2*60*60*1000,recentTtl=15*60*1000;
export function validMemory(raw:unknown,now=Date.now()):ConversationMemory{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
 const m=raw as ConversationMemory,out:ConversationMemory={};
 for(const k of ['active','recent'] as const){const v=m[k];if(v&&['PESSOAL','LOJA'].includes(v.scope)&&Number.isSafeInteger(v.selected_at)&&v.selected_at<=now&&now-v.selected_at<(k==='active'?contextTtl:recentTtl)&&((v.scope==='PESSOAL'&&v.company===null)||(v.scope==='LOJA'&&typeof v.company==='string'&&v.company.length<=100)))out[k]=v;}
 if(m.last_query&&typeof m.last_query==='object'&&!Array.isArray(m.last_query)&&JSON.stringify(m.last_query).length<2000&&m.query_at&&now>=m.query_at&&now-m.query_at<recentTtl){out.last_query=m.last_query;out.query_at=m.query_at;}
 if(typeof m.pending_source==='string'&&m.pending_source.length<=8000&&m.pending_at&&now>=m.pending_at&&now-m.pending_at<recentTtl){out.pending_source=m.pending_source;out.pending_at=m.pending_at;}
 return out;
}
export function explicitScope(source:string):ConversationScope|null{
 const s=naturalFold(source),pf=/\b(?:pessoal|pessoais|cpf|minha conta fisica)\b/.test(s),pj=/\b(?:empresa|loja|cnpj|profissional|conta juridica)\b/.test(s);
 if(pf&&pj)return null;if(pj)return 'LOJA';if(pf||/\b(?:familia|minha filha|meu filho|minha casa)\b/.test(s))return 'PESSOAL';return null;
}
export function companyMatch(name:string,companies:CompanyContext[]):CompanyContext|null{
 const n=naturalFold(name),matches=companies.filter(c=>[c.name,...c.aliases].some(a=>naturalFold(a)===n));return matches.length===1?matches[0]:null;
}
export function resolveConversationContext(input:{source:string;scope:'HERDAR'|ConversationScope;scope_evidence:string;company:string|null;change:boolean;reference_scope?:ConversationScope;event?:boolean},memory:ConversationMemory,companies:CompanyContext[],now=Date.now()){
 const m=validMemory(memory,now),explicit=explicitScope(input.source),point=/\b(?:so ess[ea]|apenas ess[ea]|esse proximo|essa proxima)\b/.test(naturalFold(input.source));
 if(input.company&&!companyMatch(input.company,companies))throw Error('Essa empresa não está disponível neste ambiente. Qual empresa cadastrada você quer usar?');
 const named=input.company?companyMatch(input.company,companies):null;
 const evidence=input.scope_evidence&&naturalFold(input.source).includes(naturalFold(input.scope_evidence));
 // Literal named companies are authoritative only when resolved against server-owned registrations.
 if(named&&!naturalFold(input.source).includes(naturalFold(input.company!)))throw Error('Qual empresa você quer consultar?');
 let scope=explicit||(named?'LOJA':null)||input.reference_scope;
 if(!scope&&input.scope!=='HERDAR'&&evidence&&explicitScope(input.scope_evidence)===input.scope)scope=input.scope;
 const inherited=m.active||m.recent;if(!scope&&inherited)scope=inherited.scope;
 if(!scope&&input.event)scope='PESSOAL';
 if(!scope)throw Error(companies.length===1?'É pessoal ou da empresa '+companies[0].name+'?':'É pessoal ou de qual empresa?');
 let company:CompanyContext|null=null;
 if(scope==='LOJA'){
  company=named||(inherited?.scope==='LOJA'?companies.find(c=>c.id===inherited.company):null)||null;
  if(!company&&companies.length===1)company=companies[0];
  if(!company)throw Error('Qual empresa cadastrada você quer usar?');
 }
 const context:ConversationContext={scope,company:company?.id||null,selected_at:now};
 const switchWords=/\b(?:agora|muda|mude|troca|troque|vamos cuidar|vamos tratar|a partir de agora|contexto ativo)\b/.test(naturalFold(input.source));
 return {context,label:scope==='PESSOAL'?'Pessoal':company!.name,memory:{...m,...input.change&&!point&&switchWords?{active:context}:{},...point?{}:{recent:context}}};
}
export function contextLabel(context:ConversationContext,companies:CompanyContext[]){return context.scope==='PESSOAL'?'Pessoal':companies.find(c=>c.id===context.company)?.name||'Empresa';}
