import BankDashboard from '@/components/icom-bank/BankDashboard';
import {bankPage,bankData,bankCashEntries} from '@/lib/icom-bank/server';
import {bankWealth} from '@/lib/icom-bank/wealth-server';
import BankOwnerOverview from '@/components/icom-bank/BankOwnerOverview';
export default async function Page(){const {token,profile}=await bankPage();const owner=profile.role==='OWNER';const [data,entries,wealth]=await Promise.all([bankData(token,profile.role),owner?bankCashEntries(token):Promise.resolve(null),owner?bankWealth(token):Promise.resolve(null)]);return <>{entries&&wealth&&<BankOwnerOverview initial={entries} personal={wealth}/>}<BankDashboard data={data}/></>;}
