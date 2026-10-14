import {bankPage,bankCashEntries} from '@/lib/icom-bank/server';
import {bankProlabore} from '@/lib/icom-bank/prolabore-server';
import BankCompanyCash from '@/components/icom-bank/BankCompanyCash';
export default async function Page(){const {token}=await bankPage('administrativo');const [entries,prolabore]=await Promise.all([bankCashEntries(token),bankProlabore(token)]);return <BankCompanyCash initial={entries} prolabore={prolabore}/>;}
