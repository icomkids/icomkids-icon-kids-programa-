import {bankPage} from '@/lib/icom-bank/server';
import {accountData} from '@/lib/icom-bank/accounts-server';
import BankAccounts from '@/components/icom-bank/BankAccounts';
export default async function Page(){const {token}=await bankPage('administrativo');return <BankAccounts initial={await accountData(token)}/>;}
