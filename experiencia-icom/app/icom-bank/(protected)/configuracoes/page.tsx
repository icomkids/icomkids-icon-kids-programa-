import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import type {BankSettings} from '@/lib/icom-bank/settings';
import BankSettingsForm from '@/components/icom-bank/BankSettingsForm';
export default async function Page(){const {token}=await bankPage('configuracoes');const [settings]=await bankQuery<BankSettings[]>(token,'icom_bank_system_settings?id=eq.1&select=company_name,pix_type,pix_key,updated_at,account_holder,agency,account_number');return <BankSettingsForm initial={settings}/>;}
