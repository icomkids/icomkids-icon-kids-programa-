import {redirect} from 'next/navigation';
import {bankAuthorize} from '@/lib/icom-bank/server';
import {bankPath} from '@/lib/icom-bank/model';
import BankShell from '@/components/icom-bank/BankShell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const access=await bankAuthorize().catch(()=>null);if(!access)redirect(bankPath('/login'));return <BankShell profile={access.profile}>{children}</BankShell>;}
