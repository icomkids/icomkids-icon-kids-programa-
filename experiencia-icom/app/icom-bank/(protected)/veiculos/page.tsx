import {bankPage,bankData} from '@/lib/icom-bank/server';
import BankPortfolio from '@/components/icom-bank/BankPortfolio';
export default async function Page(){const {token,profile}=await bankPage('veiculos');return <BankPortfolio section="veiculos" data={await bankData(token,profile.role)}/>;}
