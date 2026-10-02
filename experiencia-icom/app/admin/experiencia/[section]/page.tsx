import Admin from '@/components/Admin';
import {notFound} from 'next/navigation';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['avaliacoes','alertas','clientes','vendedores','veiculos','lideranca','relatorios','garantia','configuracoes'].includes(section))notFound();return <Admin section={section}/>}
