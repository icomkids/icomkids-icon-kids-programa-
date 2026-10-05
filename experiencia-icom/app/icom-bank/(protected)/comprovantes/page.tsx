import {bankPage,bankData} from '@/lib/icom-bank/server';
import BankReceipts from '@/components/icom-bank/BankReceipts';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){const {token,profile}=await bankPage('comprovantes'),{status}=await searchParams;return <BankReceipts data={await bankData(token,profile.role)} section="comprovantes" status={status&&['TODOS','APROVADO','RECUSADO'].includes(status)?status:'COMPROVANTE_ENVIADO'}/>;}
