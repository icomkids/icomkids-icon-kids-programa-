import BankNewCustomer from '@/components/icom-bank/BankNewCustomer';
import BankSales from '@/components/icom-bank/BankSales';
import {bankPage,bankCashEntries,bankAdminSellers} from '@/lib/icom-bank/server';
export default async function Page({searchParams}:{searchParams:Promise<{venda?:string;contrato?:string}>}){const {token,profile}=await bankPage('clientes');const params=await searchParams;if(profile.role==='OWNER'&&params.venda==='1'&&params.contrato!=='1'){const [rows,sellers]=await Promise.all([bankCashEntries(token),bankAdminSellers(token)]);return <BankSales initial={rows} sellers={sellers} startSale/>;}return <BankNewCustomer startSale={params.venda==='1'}/>;}
