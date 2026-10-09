import {sharedAssistantCache} from './assistant-cache';
import {BankError} from './server';
import {bankAll,bankQuery,bankCashEntries} from './server';
import {accountId,type BankAccount,type AccountLink,type AccountData} from './accounts';
export async function bankAccounts(token:string){return bankAll(token,'icom_bank_accounts?select=*&order=name.asc,id.asc') as Promise<BankAccount[]>;}
export async function bankAccountLinks(token:string){return bankAll(token,'icom_bank_account_links?select=*&order=created_at.asc,ledger_entry_id.asc') as Promise<AccountLink[]>;}
export async function accountData(token:string):Promise<AccountData>{const [accounts,links,entries]=await Promise.all([bankAccounts(token),bankAccountLinks(token),bankCashEntries(token)]);return {accounts,links,entries};}
export async function accountPost(token:string,operation:string,args:Record<string,unknown>,value:unknown){let id;try{id=accountId(value);}catch(e){throw new BankError(e instanceof Error?e.message:'Confira a conta.',400);}const row=await bankQuery(token,'rpc/icom_bank_account_post','POST',{p_operation:operation,p_args:args,p_account:id});sharedAssistantCache().clear();return row;}
