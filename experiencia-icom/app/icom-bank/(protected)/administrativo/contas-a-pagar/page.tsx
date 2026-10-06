import {bankPage,bankAll,bankCashEntries} from '@/lib/icom-bank/server';
import type {Payable} from '@/lib/icom-bank/payables';
import type {StockRow} from '@/lib/icom-bank/stock';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
import BankPayables from '@/components/icom-bank/BankPayables';
export default async function Page(){
 const {token}=await bankPage('administrativo');
 const [rows,stock,entries]=await Promise.all([bankAll(token,'icom_bank_payables?select=*&order=created_at.desc,id.asc'),bankAll(token,'icom_bank_stock_vehicles?select=*&order=entry_date.desc,id.asc'),bankCashEntries(token)]);
 return <BankPayables initial={{rows:rows as Payable[],stock:stock as StockRow[],entries:entries as AdminEntry[]}}/>;
}
