import {bankPage,bankQuery} from '@/lib/icom-bank/server';
import type {BankSettings} from '@/lib/icom-bank/settings';
import BankSettingsForm from '@/components/icom-bank/BankSettingsForm';
export default async function Page(){const {token,profile}=await bankPage('configuracoes');const [settings]=await bankQuery<BankSettings[]>(token,'icom_bank_system_settings?id=eq.1&select=company_name,pix_type,pix_key,updated_at,account_holder,agency,account_number');return <>{profile.role==='OWNER'&&<a className="bank-wa-entry" href="/experiencia-icom/icom-bank/administrativo/whatsapp"><strong>WhatsApp ICOM Bank</strong><span>Conecte o número para lançar despesas por áudio</span><b>Configurar ↗</b></a>}<BankSettingsForm initial={settings}/></>;}
