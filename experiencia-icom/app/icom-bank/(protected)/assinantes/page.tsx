import {redirect} from 'next/navigation';
import {platformAuthorize,platformData} from '@/lib/icom-bank/platform-server';
import {BankError} from '@/lib/icom-bank/server';
import BankSubscribers from '@/components/icom-bank/BankSubscribers';
export const dynamic='force-dynamic';
export default async function Page(){let access;try{access=await platformAuthorize();}catch(e){redirect(e instanceof BankError&&e.status===403?'/icom-bank/dashboard?denied=1':'/icom-bank/login');}return <BankSubscribers initial={await platformData(access.token)}/>;}
