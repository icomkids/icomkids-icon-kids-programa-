import {bankPage,bankQuery,bankAll} from '@/lib/icom-bank/server';
import BankAdministrative from '@/components/icom-bank/BankAdministrative';
import {brazilDay} from '@/lib/icom-bank/model';
import type {AdminEntry,AdminReference} from '@/lib/icom-bank/administrative';

export default async function Page(){
  const {token}=await bankPage('administrativo');const year=Number(brazilDay().slice(0,4));
  const [entries,references]=await Promise.all([bankAll(token,`icom_bank_admin_entries?select=*&entry_date=gte.${year}-01-01&entry_date=lt.${year+1}-01-01&order=entry_date.desc,id.asc`),bankQuery<{content:AdminReference}[]>(token,'icom_bank_admin_references?id=eq.1&select=content')]);
  return <BankAdministrative initial={entries as AdminEntry[]} reference={references[0]?.content||null} initialYear={year}/>;
}
