'use client';
import {useState} from 'react';
import {useBankPreferences} from './BankPreferences';
import {assistantName} from '@/lib/icom-bank/preferences';
export default function BankAssistantPersonalization(){
 const {preferences,save,loading}=useBankPreferences(),[name,setName]=useState(preferences.assistant_name),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <details className="bank-ai-personalization"><summary onClick={()=>setName(preferences.assistant_name)}>Personalizar · nome da IA</summary><form onSubmit={async e=>{e.preventDefault();setMessage('');setBusy(true);try{const value=assistantName(name);await save({assistant_name:value});setMessage('Nome salvo. No WhatsApp, pode chamar por esse nome. Na voz, vale na próxima conversa.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}}}><label>Como você quer chamar sua IA?<input aria-label="Nome da IA" placeholder="Ex.: Fernanda" autoComplete="off" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||loading}>{busy?'Salvando…':'Salvar nome'}</button><p>O nome personaliza sua assistente. O microfone continua sendo ativado somente ao clicar.</p>{message&&<p role="status">{message}</p>}</form></details>;
}
