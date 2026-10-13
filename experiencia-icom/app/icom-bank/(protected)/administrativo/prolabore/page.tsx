import {bankPage} from '@/lib/icom-bank/server';
import {bankProlabore} from '@/lib/icom-bank/prolabore-server';
import {accountData} from '@/lib/icom-bank/accounts-server';
import BankProlabore from '@/components/icom-bank/BankProlabore';
export default async function Page(){const {token}=await bankPage('administrativo');const [rows,accounts]=await Promise.all([bankProlabore(token),accountData(token)]);return <BankProlabore initial={rows} initialAccounts={accounts}/>;}
