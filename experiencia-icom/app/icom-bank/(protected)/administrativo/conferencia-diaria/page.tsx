import BankDailyCash from '@/components/icom-bank/BankDailyCash';
import {bankPage} from '@/lib/icom-bank/server';
import {dailyCashData} from '@/lib/icom-bank/daily-cash-server';
import {brazilDay} from '@/lib/icom-bank/model';
export default async function Page(){const {token}=await bankPage('administrativo');return <BankDailyCash initial={await dailyCashData(token,brazilDay())}/>;}
