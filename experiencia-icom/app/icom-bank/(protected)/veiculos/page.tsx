import {bankPage,bankData,bankAll,bankCashEntries,bankAdminSellers} from '@/lib/icom-bank/server';
import BankPortfolio from '@/components/icom-bank/BankPortfolio';
import BankStock from '@/components/icom-bank/BankStock';
import type {StockRow} from '@/lib/icom-bank/stock';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
export default async function Page(){const {token,profile}=await bankPage('veiculos');const data=await bankData(token,profile.role);if(profile.role!=='OWNER')return <BankPortfolio section="veiculos" data={data}/>;const [stock,entries,sellers]=await Promise.all([bankAll(token,'icom_bank_stock_vehicles?select=*&order=entry_date.desc,id'),bankCashEntries(token),bankAdminSellers(token)]);return <BankStock initial={stock as StockRow[]} initialEntries={entries as AdminEntry[]} sellers={sellers} data={data}/>;}
