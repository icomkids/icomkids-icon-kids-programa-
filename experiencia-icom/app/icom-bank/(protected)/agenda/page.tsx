import {bankPage} from '@/lib/icom-bank/server';
import {bankAgenda} from '@/lib/icom-bank/agenda-server';
import BankAgenda from '@/components/icom-bank/BankAgenda';
export default async function Page(){const {token}=await bankPage('agenda');return <BankAgenda initial={await bankAgenda(token)}/>;}
