import {notFound} from 'next/navigation';
import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import {validId,type ContractRow,type VehicleRow} from '@/lib/icom-bank/contracts';
import {bankPath,type BankCustomer} from '@/lib/icom-bank/model';
import BankContractForm from '@/components/icom-bank/BankContractForm';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {token,profile}=await bankPage('contratos'),{id}=await params;if(!validId(id))notFound();const [contract]=await bankQuery<ContractRow[]>(token,'icom_bank_contracts?id=eq.'+id+'&select=*');if(!contract)notFound();
 if(!['OWNER','ADMIN','GERENTE','VENDEDOR'].includes(profile.role)||contract.status!=='ATIVO')return <section className="bank-panel"><h1>Pedido encerrado</h1><p>Revise os recebimentos antes de editar esta venda.</p><a href={bankPath('/contratos/'+id)}>Voltar ao pedido</a></section>;
 const [clients,vehicles]=await Promise.all([bankQuery<BankCustomer[]>(token,'icom_bank_customers?id=eq.'+contract.customer_id+'&select=id,name,cpf,risk_profile'),bankQuery<VehicleRow[]>(token,'icom_bank_vehicles?id=eq.'+contract.vehicle_id+'&select=*')]);if(!clients[0]||!vehicles[0])notFound();
 return <BankContractForm customer={clients[0]} existing={{contract,vehicle:vehicles[0]}}/>;
}
