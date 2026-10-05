import {bankPage,bankData} from '@/lib/icom-bank/server';
import BankReceipts from '@/components/icom-bank/BankReceipts';
export default async function Page(){const {token,profile}=await bankPage('pagamentos');return <BankReceipts data={await bankData(token,profile.role)} section="pagamentos"/>;}
