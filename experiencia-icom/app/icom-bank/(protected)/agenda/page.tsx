import {bankPage} from '@/lib/icom-bank/server';
import {bankAgenda} from '@/lib/icom-bank/agenda-server';
import BankAgenda from '@/components/icom-bank/BankAgenda';
export default async function Page(){const {token,profile}=await bankPage('agenda');return <BankAgenda readOnly={profile.role!=='OWNER'} initial={await bankAgenda(token,profile.role)}/>;}
