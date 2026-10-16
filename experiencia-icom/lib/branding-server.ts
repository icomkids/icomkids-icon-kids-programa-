import {cache} from 'react';
import {db} from './server';
import {appPath} from './paths';
import {DEFAULT_BRANDING,type Branding} from './branding';
export const getBranding=cache(async():Promise<Branding>=>{
 const [settings]=await db<{company_name:string;logo_data_url:string|null;updated_at:string}[]>('experience_settings?id=eq.1&select=company_name,logo_data_url,updated_at');
 if(!settings)return DEFAULT_BRANDING;
 return {company_name:settings.company_name||DEFAULT_BRANDING.company_name,logo_url:settings.logo_data_url?`${appPath('/api/brand/logo')}?v=${encodeURIComponent(settings.updated_at)}`:null};
});
export async function initialBranding(){try{return await getBranding()}catch{return DEFAULT_BRANDING}}
