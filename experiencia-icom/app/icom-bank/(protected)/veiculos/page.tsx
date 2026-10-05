import {bankPage,bankData,bankAll,bankAdminSellers} from '@/lib/icom-bank/server';
import BankPortfolio from '@/components/icom-bank/BankPortfolio';
import BankStock from '@/components/icom-bank/BankStock';
import type {StockRow} from '@/lib/icom-bank/stock';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
export default async function Page(){const {token,profile}=await bankPage('veiculos');const data=await bankData(token,profile.role);if(profile.role!=='OWNER')return <BankPortfolio section="veiculos" data={data}/>;const [stock,entries,sellers]=await Promise.all([bankAll(token,'icom_bank_stock_vehicles?select=*&order=entry_date.desc,id'),bankAll(token,'icom_bank_admin_entries?select=*&order=entry_date.desc,id'),bankAdminSellers(token)]);return <BankStock initial={stock as StockRow[]} initialEntries={entries as AdminEntry[]} sellers={sellers} data={data}/>;}
