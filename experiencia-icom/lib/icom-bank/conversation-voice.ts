import {interpretConversation} from './conversation-interpreter.ts';
import {prepareConversation} from './conversation-execution.ts';
import type {CompanyContext,ConversationMemory} from './conversation-context.ts';
import type {BankRole} from './model.ts';
import type {AssistantReader} from './assistant-data.ts';
import {signFinancial} from './assistant-financial.ts';
export const conversationVoiceTool={type:'function' as const,name:'interpretar_pedido_icom',description:'Entende pedido literal completo com contexto: consultas, troca de área, despesas e agenda. Envie exatamente o que o usuário falou, incluindo não, correções e respostas curtas. Usa dados reais, separa pessoal/empresa e não salva antes da confirmação. Não inventa operações bancárias.',parameters:{type:'object',additionalProperties:false,properties:{transcript:{type:'string'}},required:['transcript']}};
export async function prepareVoiceConversation(input:{text:string;today:string;key:string;companies:CompanyContext[];memory:ConversationMemory;role:BankRole;user:string;reader:AssistantReader}){
 const t=performance.now();const interpreted=await interpretConversation(input.text,input.today,input.key,input.companies,input.memory,input.role);
 const prepared=await prepareConversation(interpreted.plan,input.text,input.today,input.companies,input.memory,input.role,input.reader,async path=>await input.reader.rows(path) as Record<string,unknown>[],undefined,undefined,'VOICE');
 return {memory:prepared.memory,reply:prepared.results.filter(r=>!r.pending).map(r=>r.reply).join('\n\n'),pending:prepared.results.filter(r=>r.pending).map(r=>({summary:r.pending!.summary,destination:r.pending!.destination,confirmation:signFinancial(r.pending!,input.user,input.key)})),timing:{model_calls:interpreted.model_calls,interpret_ms:Math.round(interpreted.duration_ms),total_ms:Math.round(performance.now()-t)}};
}
