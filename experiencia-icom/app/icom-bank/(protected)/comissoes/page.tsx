import {bankPage} from '@/lib/icom-bank/server';
import BankCommissions from '@/components/icom-bank/BankCommissions';
export default async function Page(){await bankPage('comissoes');return <BankCommissions/>;}
