import {db} from '@/lib/server';
import {validateLogo} from '@/lib/branding';
export async function GET(){try{
 const [row]=await db<{logo_data_url:string|null}[]>('experience_settings?id=eq.1&select=logo_data_url');
 if(!row?.logo_data_url?.startsWith('data:image/png;base64,'))return new Response(null,{status:404});
 const bytes=Buffer.from(row.logo_data_url.slice('data:image/png;base64,'.length),'base64');validateLogo(bytes);
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch{return new Response(null,{status:404})}}
