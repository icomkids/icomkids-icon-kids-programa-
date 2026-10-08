import {bankPage} from '@/lib/icom-bank/server';
import {bankWealth} from '@/lib/icom-bank/wealth-server';
import BankPersonalWealth from '@/components/icom-bank/BankPersonalWealth';
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string}>}){const {token}=await bankPage('administrativo');const params=await searchParams;return <BankPersonalWealth initial={await bankWealth(token)} initialTab={params.tab}/>;}
