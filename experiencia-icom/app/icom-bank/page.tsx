import {redirect} from 'next/navigation';
import {bankPath} from '@/lib/icom-bank/model';
export default function Page(){redirect(bankPath('/dashboard'));}
