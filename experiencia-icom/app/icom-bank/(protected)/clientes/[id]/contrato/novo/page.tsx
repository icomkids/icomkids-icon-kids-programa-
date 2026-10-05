import {notFound} from 'next/navigation';
import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import {maskCpf,type BankCustomer} from '@/lib/icom-bank/model';
import {validId} from '@/lib/icom-bank/contracts';
import BankContractForm from '@/components/icom-bank/BankContractForm';
export default async function Page({params}:{params:Promise<{id:string}>}){const {token}=await bankPage('contratos'),{id}=await params;if(!validId(id))notFound();const [customer]=await bankQuery<BankCustomer[]>(token,`icom_bank_customers?id=eq.${id}&status=eq.ATIVO&select=id,name,cpf,risk_profile`);if(!customer)notFound();return <BankContractForm customer={{id:customer.id,name:customer.name,cpf:maskCpf(customer.cpf),risk_profile:customer.risk_profile}}/>;}
