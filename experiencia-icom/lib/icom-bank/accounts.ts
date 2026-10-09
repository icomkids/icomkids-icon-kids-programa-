import {validId,realDate} from './contracts.ts';
import {adminStats,type AdminEntry} from './administrative.ts';
import {cashPosition,type CashEntry} from './cash.ts';
import {brazilDay} from './model.ts';
export type BankAccount={id:string;owner_id:string;name:string;bank:string;scope:'LOJA'|'PESSOAL';active:boolean;created_at:string;updated_at:string};
export type AccountLink={ledger_entry_id:string;account_id:string;owner_id:string;purpose:'MOVIMENTO'|'SALDO_INICIAL'|'RENDA_PESSOAL';wealth_id:string|null;created_at:string};
export type AccountData={accounts:BankAccount[];links:AccountLink[];entries:CashEntry[]};
export const accountBanks=['Santander','Itaú','Bradesco','Banco do Brasil','Caixa','Safra','Sicredi','Sicoob','C6 Bank','Banco PAN','Inter','Nubank','BTG Pactual','Mercado Pago','PicPay','Dinheiro em mãos','Outro'] as const;
export function accountId(value:unknown,required=false){if(value===undefined||value===null||value===''){if(required)throw new Error('Escolha de qual conta sai ou em qual conta entra o dinheiro.');return null;}if(typeof value!=='string'||!validId(value))throw new Error('Escolha uma conta cadastrada.');return value;}
export function accountInput(b:Record<string,unknown>,today=brazilDay()){
 const id=accountId(b.id,true)!,name=typeof b.name==='string'?b.name.trim():'',bank=typeof b.bank==='string'?b.bank.trim():'';
 if(name.length<2||name.length>100||bank.length<2||bank.length>100||!['LOJA','PESSOAL'].includes(String(b.scope))||typeof b.active!=='boolean')throw new Error('Informe nome da conta, banco e se é da loja ou pessoal.');
 const initial=b.initial_cents??0,date=b.initial_date??today;
 if(typeof initial!=='number'||!Number.isSafeInteger(initial)||Math.abs(initial)>1_000_000_000||typeof date!=='string'||!realDate(date)||date<'2000-01-01'||date>today)throw new Error('Confira o saldo inicial e a data até hoje.');
 const expected=b.expected_updated_at===null?null:typeof b.expected_updated_at==='string'&&Number.isFinite(Date.parse(b.expected_updated_at))?b.expected_updated_at:undefined;
 if(expected===undefined)throw new Error('Atualize a conta antes de salvar.');
 return {id,name,bank,scope:b.scope,active:b.active,initial_cents:initial,initial_date:date,expected_updated_at:expected};
}
export function accountSummary(data:AccountData,today=brazilDay()){
 const linkByEntry=new Map(data.links.map(l=>[l.ledger_entry_id,l])),done=data.entries.filter(e=>e.active&&e.status==='REALIZADO'&&e.entry_date<=today);
 const rows=data.accounts.map(a=>{const entries=done.filter(e=>linkByEntry.get(e.id)?.account_id===a.id),s=adminStats(entries,'');return {...a,balance:s.combined,movements:entries.length};});
 const unassigned=done.filter(e=>!linkByEntry.has(e.id)),s=adminStats(unassigned,''),cash=cashPosition(data.entries,today);
 return {rows,unassigned:s.combined,unassignedCount:unassigned.length,gross:cash.gross,available:cash.available,reserved:cash.gross-cash.available};
}
const fold=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function resolveAccount(accounts:BankAccount[],name:unknown,transcript:string){
 const active=accounts.filter(a=>a.active);
 if(!active.length){if(typeof name==='string'&&name.trim())throw new Error('Cadastre essa conta em Contas bancárias antes de usá-la.');return null;}
 if(typeof name!=='string'||!name.trim()||!fold(transcript).includes(fold(name)))throw new Error('De qual conta saiu ou em qual conta entrou o dinheiro? Diga o nome cadastrado.');
 const found=active.filter(a=>fold(a.name)===fold(name)||fold(a.bank)===fold(name));
 if(found.length!==1)throw new Error(found.length?'Há mais de uma conta nesse banco. Diga o nome da conta.':'Não encontrei essa conta. Diga o nome cadastrado em Contas bancárias.');
 return found[0];
}
export function annotateAccounts(entries:CashEntry[],links:AccountLink[]){const map=new Map(links.map(l=>[l.ledger_entry_id,l]));return entries.map(e=>({...e,...(map.has(e.id)?{cash_account_id:map.get(e.id)!.account_id,cash_account_purpose:map.get(e.id)!.purpose}:{})}));}
