import {bankPage,bankQuery,bankCashEntries,bankAdminSellers} from '@/lib/icom-bank/server';
import BankAdministrative from '@/components/icom-bank/BankAdministrative';
import {brazilDay} from '@/lib/icom-bank/model';
import type {AdminEntry,AdminReference} from '@/lib/icom-bank/administrative';

export default async function Page(){
  const {token}=await bankPage('administrativo');const year=Number(brazilDay().slice(0,4));
  const [entries,references,sellers]=await Promise.all([bankCashEntries(token),bankQuery<{content:AdminReference}[]>(token,'icom_bank_admin_references?id=eq.1&select=content'),bankAdminSellers(token)]);
  return <BankAdministrative initial={entries as AdminEntry[]} reference={references[0]?.content||null} sellers={sellers} initialYear={year}/>;
}
