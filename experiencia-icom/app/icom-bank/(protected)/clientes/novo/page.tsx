import BankNewCustomer from '@/components/icom-bank/BankNewCustomer';
import {bankPage} from '@/lib/icom-bank/server';
export default async function Page(){await bankPage('clientes');return <BankNewCustomer/>;}
