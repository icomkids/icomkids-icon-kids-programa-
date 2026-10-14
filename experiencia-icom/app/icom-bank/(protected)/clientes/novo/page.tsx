import BankNewCustomer from '@/components/icom-bank/BankNewCustomer';
import {redirect,notFound} from 'next/navigation';
import {bankSaleContract} from '@/lib/icom-bank/sale-contract-server';
import {bankPath} from '@/lib/icom-bank/model';
import BankSales from '@/components/icom-bank/BankSales';
import {bankPage,bankCashEntries,bankAdminSellers,BankError} from '@/lib/icom-bank/server';
export default async function Page({searchParams}:{searchParams:Promise<{venda?:string;contrato?:string;origem?:string}>}){
 const {token,profile}=await bankPage('clientes'),params=await searchParams;
 if(params.origem){
  if(profile.role!=='OWNER')notFound();
  let linked;try{linked=await bankSaleContract(token,params.origem);}catch(e){if(!(e instanceof BankError))throw e;return <section className="bank-panel"><h1>Contrato da venda</h1><p>{e.message}</p><a href={bankPath('/clientes')}>Voltar às vendas</a></section>;}
  if(linked.contract_id)redirect('/icom-bank/contratos/'+linked.contract_id);return <BankNewCustomer startSale sale={linked.seed!}/>;
 }
 if(profile.role==='OWNER'&&params.venda==='1'&&params.contrato!=='1'){const [rows,sellers]=await Promise.all([bankCashEntries(token),bankAdminSellers(token)]);return <BankSales initial={rows} sellers={sellers} startSale/>;}
 return <BankNewCustomer startSale={params.venda==='1'}/>;
}
