import { AppError } from './domain.mjs';

export class SupabaseStore {
  constructor({url,key,fetchImpl=fetch}) {
    const endpoint=new URL(url);
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='swsfwthjxtqtkloexyjs.supabase.co')throw new Error('Use o projeto Supabase da Icom Kids configurado para o Maré Particular.');
    if(!key)throw new Error('A chave privada do Supabase deve estar configurada no servidor.');
    this.endpoint=`${endpoint.origin}/rest/v1/rpc/mp_dispatch`;
    this.key=key;this.fetch=fetchImpl;this.type='supabase';
  }
  async call(operation,data={}) {
    let res;
    try{res=await this.fetch(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:this.key,...(this.key.startsWith('sb_secret_')?{}:{Authorization:`Bearer ${this.key}`})},body:JSON.stringify({p_operation:operation,p_data:data}),signal:AbortSignal.timeout(15000)});}catch{throw new AppError('O banco está temporariamente indisponível. Tente novamente.',503);}
    let result;try{result=await res.json();}catch{throw new AppError('Resposta inválida do banco de dados.',503);}
    if(!res.ok){
      if(result.code==='23505')throw new AppError('As datas foram ocupadas por outro pedido. Escolha outro período.',409);
      if(result.code==='P0001'&&typeof result.message==='string')throw new AppError(result.message,result.message.includes('encontrad')?404:result.message.includes('ocupad')||result.message.includes('encerrad')?409:400);
      throw new AppError('Não foi possível acessar o banco de dados. Tente novamente.',503);
    }
    return result;
  }
  initialize(config,snapshot=null){return this.call('bootstrap',{config,snapshot});}
  publicState(){return this.call('public');}
  ownerState(){return this.call('owner');}
  create(input,demo){return this.call('create',{...input,demo});}
  saveSettings(config){return this.call('settings',{config});}
  transition(id,status){return this.call('transition',{id,status});}
  block(input){return this.call('block',input);}
  unblock(id){return this.call('unblock',{id});}
  health(){return this.call('health');}
}
