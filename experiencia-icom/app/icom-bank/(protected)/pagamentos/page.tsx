import {bankPage,bankData} from '@/lib/icom-bank/server';
import BankReceipts from '@/components/icom-bank/BankReceipts';
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){const {token,profile}=await bankPage('pagamentos'),{status}=await searchParams;return <BankReceipts data={await bankData(token,profile.role)} section="pagamentos" status={status&&['ESTORNADO','TODOS'].includes(status)?status:'CONFIRMADO'}/>;}
