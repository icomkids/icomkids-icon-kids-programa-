import {bankQuery,BankError} from './server';
import {deletionPassword,type DeleteOperation} from './deletion';
export async function deletionQuery<T>(token:string,operation:DeleteOperation,id:string,path:string,args:unknown,password:unknown):Promise<T>{
 let secret;try{secret=deletionPassword(password);}catch(e){throw new BankError(e instanceof Error?e.message:'Informe a senha de exclusão.',403);}
 const result=await bankQuery<{approval?:string;error?:string}>(token,'rpc/icom_bank_authorize_deletion','POST',{p_password:secret,p_operation:operation,p_id:id});
 if(!result.approval){const messages:Record<string,string>={NOT_CONFIGURED:'Cadastre a senha de exclusão em Configurações antes de cancelar.',LOCKED:'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.',INVALID:'Senha de exclusão incorreta.',FORBIDDEN:'Sua conta não pode executar esta ação.'};throw new BankError(messages[result.error||'']||'Não foi possível autorizar a exclusão.',result.error==='LOCKED'?429:403);}
 return bankQuery<T>(token,path,'POST',args,undefined,{'x-bank-delete-approval':result.approval});
}
