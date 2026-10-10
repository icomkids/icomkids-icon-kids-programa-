import {redirect} from 'next/navigation';
import {bankAuthorize} from '@/lib/icom-bank/server';
import BankShell from '@/components/icom-bank/BankShell';
import {platformEnabled} from '@/lib/icom-bank/platform-server';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const access=await bankAuthorize().catch(()=>null);if(!access)redirect('/icom-bank/login');const platformOwner=access.profile.role==='OWNER'&&await platformEnabled(access.token);return <BankShell profile={access.profile} platformOwner={platformOwner}>{children}</BankShell>;}
