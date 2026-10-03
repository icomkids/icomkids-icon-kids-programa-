import BankDashboard from '@/components/icom-bank/BankDashboard';
import {bankPage,bankData} from '@/lib/icom-bank/server';
export default async function Page(){const {token,profile}=await bankPage();return <BankDashboard data={await bankData(token,profile.role)}/>;}
