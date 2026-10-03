import BankCustomers from '@/components/icom-bank/BankCustomers';
import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import {customerSearch,maskCpf,type BankCustomer} from '@/lib/icom-bank/model';
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){const {token}=await bankPage('clientes'),{q=''}=await searchParams;const rows=await bankQuery<BankCustomer[]>(token,'icom_bank_customers?select=id,name,cpf,phone,email,status,assigned_to,created_at,vehicles:icom_bank_vehicles(brand,model,plate),contracts:icom_bank_contracts(id,number,status,installments:icom_bank_installments(due_date,status))&order=created_at.desc&limit=200'+customerSearch(q));return <BankCustomers initial={rows.map(r=>({...r,cpf:maskCpf(r.cpf)}))} initialQuery={q}/>;}
