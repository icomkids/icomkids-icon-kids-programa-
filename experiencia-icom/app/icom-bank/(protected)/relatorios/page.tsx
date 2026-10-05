import {bankPage,bankData} from '@/lib/icom-bank/server';
import {reportPeriod} from '@/lib/icom-bank/management';
import BankReports from '@/components/icom-bank/BankReports';
export default async function Page({searchParams}:{searchParams:Promise<{from?:string;to?:string}>}){const {token,profile}=await bankPage('relatorios');let period,error;try{period=reportPeriod(await searchParams);}catch(e){period=reportPeriod({});error=e instanceof Error?e.message:'Confira as datas.';}return <BankReports data={await bankData(token,profile.role)} {...period} error={error}/>;}
