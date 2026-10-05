import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import type {Staff} from '@/lib/icom-bank/management';
import BankStaff from '@/components/icom-bank/BankStaff';
export default async function Page(){const {token,profile}=await bankPage('funcionarios');return <BankStaff initial={await bankQuery<Staff[]>(token,'rpc/icom_bank_list_staff','POST',{})} profile={profile}/>;}
