import {authorize,db,errorResponse,log} from '@/lib/server';
import {assertBrandManager,companyName,LOGO_MAX_BYTES,validateLogo} from '@/lib/branding';
import {appPath} from '@/lib/paths';
export async function POST(req:Request){try{
 const actor=await authorize();assertBrandManager(actor.role);
 const length=Number(req.headers.get('content-length'));if(length>LOGO_MAX_BYTES+16384)throw new Error('A imagem é muito grande. Escolha outra logo.');
 const form=await req.formData(),name=companyName(form.get('company_name')),file=form.get('logo'),patch:Record<string,unknown>={company_name:name,updated_at:new Date().toISOString()};
 if(file instanceof File){if(file.type!=='image/png'||file.size>LOGO_MAX_BYTES)throw new Error('Escolha uma logo PNG válida de até 300 KB.');const bytes=Buffer.from(validateLogo(new Uint8Array(await file.arrayBuffer())));patch.logo_data_url=`data:image/png;base64,${bytes.toString('base64')}`;}
 else if(form.get('remove_logo')==='true')patch.logo_data_url=null;
 const [saved]=await db<{company_name:string;logo_data_url:string|null;updated_at:string}[]>('experience_settings?id=eq.1','PATCH',patch);if(!saved)throw new Error('Não foi possível salvar a marca.');
 await log(actor.id,'branding_updated','1');
 return Response.json({branding:{company_name:saved.company_name,logo_url:saved.logo_data_url?`${appPath('/api/brand/logo')}?v=${encodeURIComponent(saved.updated_at)}`:null}});
}catch(e){return errorResponse(e)}}
