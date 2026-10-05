import {bankPage} from '@/lib/icom-bank/server';
import BankAdministrative from '@/components/icom-bank/BankAdministrative';

export default async function Page(){
  await bankPage('administrativo');
  return <BankAdministrative/>;
}
