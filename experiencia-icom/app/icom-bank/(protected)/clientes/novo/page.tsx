import BankNewCustomer from '@/components/icom-bank/BankNewCustomer';
import {bankPage} from '@/lib/icom-bank/server';
export default async function Page({searchParams}:{searchParams:Promise<{venda?:string}>}){await bankPage('clientes');const params=await searchParams;return <BankNewCustomer startSale={params.venda==='1'}/>;}
