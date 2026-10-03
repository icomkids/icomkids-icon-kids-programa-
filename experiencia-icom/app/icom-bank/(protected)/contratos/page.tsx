import {bankPage,bankData} from '@/lib/icom-bank/server';
import BankPortfolio from '@/components/icom-bank/BankPortfolio';
export default async function Page(){const {token,profile}=await bankPage('contratos');return <BankPortfolio section="contratos" data={await bankData(token,profile.role)}/>;}
