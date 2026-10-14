import {bankQuery,BankError} from './server';
import {validId} from './contracts';
import {saleContractSeed} from './sale-contract';
import type {AdminEntry} from './administrative';
export async function bankSaleContract(token:string,id:string){
 if(!validId(id))throw new BankError('Venda inválida.',400);
 const [sale]=await bankQuery<AdminEntry[]>(token,'icom_bank_admin_entries?id=eq.'+id+'&kind=eq.VENDA&select=*');
 if(!sale||sale.details.payment_method!=='BOLETO_PROPRIO')throw new BankError('Escolha Boleto próprio na venda antes de criar o contrato.',400);
 const [link]=await bankQuery<{contract_id:string}[]>(token,'icom_bank_sale_contracts?sale_id=eq.'+id+'&select=contract_id');
 if(link)return {sale,contract_id:link.contract_id,seed:null};
 const [r]=await bankQuery<{received_cents:number}[]>(token,'icom_bank_receivables?source_entry_id=eq.'+id+'&active=eq.true&select=received_cents');
 try{return {sale,contract_id:null,seed:saleContractSeed(sale,Number(r?.received_cents||0))};}catch(e){throw new BankError(e instanceof Error?e.message:'Confira a venda.',400);}
}
