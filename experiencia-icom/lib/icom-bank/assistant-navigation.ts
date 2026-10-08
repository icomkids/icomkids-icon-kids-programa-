// No record identifiers, form values or DOM text enter the voice context.
import {manualView,manualViews,type ManualView} from './assistant-manual.ts';
import type {BankRole} from './model.ts';
import type {VoiceResources} from './assistant-client.ts';
export function syncManualView(r:VoiceResources,value:unknown,role:BankRole){
 const view=manualView(value,role),channel=r.channel;
 if(r.cancelled||!channel||channel.readyState!=='open'||r.manualView===view)return false;
 channel.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'CONTEXTO DE NAVEGAÇÃO DO PAINEL: '+JSON.stringify({view,label:manualViews[view][1]})+'. Atualize apenas a tela atual. Isto não é uma pergunta nem confirmação de preenchimento ou salvamento. Não responda espontaneamente. No próximo pedido de ajuda, consulte consultar_manual_icom e continue a partir desta tela.'}]}}));
 r.manualView=view as ManualView;return true;
}
