import Admin from '@/components/Admin';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['avaliacoes','alertas','clientes','vendedores','lideranca','relatorios','configuracoes'].includes(section))notFound();return <Admin section={section}/>}
