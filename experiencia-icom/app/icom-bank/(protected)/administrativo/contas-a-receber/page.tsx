import {bankPage,bankAll,bankCashEntries} from '@/lib/icom-bank/server';
import type {Receivable,Receipt} from '@/lib/icom-bank/receivables';
import type {AdminEntry} from '@/lib/icom-bank/administrative';
import BankReceivables from '@/components/icom-bank/BankReceivables';
export default async function Page(){
 const {token}=await bankPage('administrativo');
 const [rows,receipts,entries]=await Promise.all([bankAll(token,'icom_bank_receivables?select=*&order=created_at.desc,id.asc'),bankAll(token,'icom_bank_receipts?select=*&order=created_at.desc,id.asc'),bankCashEntries(token)]);
 return <BankReceivables initial={{rows:rows as Receivable[],receipts:receipts as Receipt[],entries:entries as AdminEntry[]}}/>;
}
