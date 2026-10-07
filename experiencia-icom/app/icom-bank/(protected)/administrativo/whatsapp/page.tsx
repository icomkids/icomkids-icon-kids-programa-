import {bankPage} from '@/lib/icom-bank/server';
import BankWhatsappExpenses from '@/components/icom-bank/BankWhatsappExpenses';
export default async function Page(){await bankPage('administrativo');return <BankWhatsappExpenses/>;}
