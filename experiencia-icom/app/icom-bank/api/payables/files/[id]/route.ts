import {config} from '@/lib/server';
import {bankAuthorize,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {validId} from '@/lib/icom-bank/contracts';
import type {PayableFile} from '@/lib/icom-bank/payables';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{
 const {token}=await bankAuthorize('administrativo'),{id}=await params;if(!validId(id))throw new BankError('Arquivo inválido.',400);
 const [file]=await bankQuery<PayableFile[]>(token,`icom_bank_payable_files?id=eq.${id}&status=eq.ANEXADO&select=*`);if(!file)throw new BankError('Comprovante não encontrado.',404);
 const {url,key}=config(),path=file.object_path.split('/').map(encodeURIComponent).join('/');
 const response=await fetch(`${url}/storage/v1/object/authenticated/icom-bank-documents/${path}`,{headers:{apikey:key,Authorization:`Bearer ${token}`},cache:'no-store'});
 if(!response.ok)throw new BankError('Não foi possível abrir o comprovante.',400);
 const bytes=await response.arrayBuffer();if(bytes.byteLength!==Number(file.size_bytes)||bytes.byteLength>10485760)throw new BankError('Arquivo inconsistente.',400);
 const ext=file.mime_type==='application/pdf'?'pdf':file.mime_type==='image/png'?'png':'jpg';
 return new Response(bytes,{headers:{'Content-Type':file.mime_type,'Content-Disposition':`attachment; filename="comprovante-${id}.${ext}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return bankError(e);}}
