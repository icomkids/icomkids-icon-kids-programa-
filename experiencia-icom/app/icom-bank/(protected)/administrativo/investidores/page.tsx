import {bankPage,bankQuery,bankCashEntries} from '@/lib/icom-bank/server';
import BankInvestors from '@/components/icom-bank/BankInvestors';
import type {BankInvestor} from '@/lib/icom-bank/investors';
export default async function Page(){const {token}=await bankPage('administrativo');const [investors,entries]=await Promise.all([bankQuery<BankInvestor[]>(token,'icom_bank_investors?select=*&order=name.asc'),bankCashEntries(token)]);return <BankInvestors initial={investors} entries={entries}/>;}
