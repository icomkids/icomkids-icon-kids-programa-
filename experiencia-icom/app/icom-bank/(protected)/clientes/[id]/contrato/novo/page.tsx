import {bankSaleContract} from '@/lib/icom-bank/sale-contract-server';
import {notFound,redirect} from 'next/navigation';
import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import {maskCpf,type BankCustomer} from '@/lib/icom-bank/model';
import {validId} from '@/lib/icom-bank/contracts';
import BankContractForm from '@/components/icom-bank/BankContractForm';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{origem?:string}>}){const {token,profile}=await bankPage('contratos'),{id}=await params;if(!validId(id))notFound();const [customer]=await bankQuery<BankCustomer[]>(token,`icom_bank_customers?id=eq.${id}&status=eq.ATIVO&select=id,name,cpf,risk_profile`);if(!customer)notFound();const {origem}=await searchParams;let sale;if(origem){if(profile.role!=='OWNER')notFound();const linked=await bankSaleContract(token,origem);if(linked.contract_id)redirect('/icom-bank/contratos/'+linked.contract_id);sale=linked.seed!;}return <BankContractForm sale={sale} customer={{id:customer.id,name:customer.name,cpf:maskCpf(customer.cpf),risk_profile:customer.risk_profile}}/>;}
