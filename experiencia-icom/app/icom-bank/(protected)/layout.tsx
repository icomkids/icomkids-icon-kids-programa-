import {redirect} from 'next/navigation';
import {bankAuthorize} from '@/lib/icom-bank/server';
import BankShell from '@/components/icom-bank/BankShell';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const access=await bankAuthorize().catch(()=>null);if(!access)redirect('/icom-bank/login');return <BankShell profile={access.profile}>{children}</BankShell>;}
