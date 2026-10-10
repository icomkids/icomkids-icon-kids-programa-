import {bankAuthorize,bankError,bankOrigin,BankError,bankQuery} from '@/lib/icom-bank/server';
import {userPreferences} from '@/lib/icom-bank/preferences-server';
import {preferencesPatch,readPreferences} from '@/lib/icom-bank/preferences';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export async function GET(){try{const {token,profile}=await bankAuthorize();return Response.json(await userPreferences(token,profile.user_id),{headers});}catch(e){return bankError(e);}}
export async function PATCH(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize();
 if(!req.headers.get('content-type')?.startsWith('application/json')||Number(req.headers.get('content-length'))>50000)throw new BankError('Preferências inválidas.',400);
 const text=await req.text();if(text.length>50000)throw new BankError('Preferências inválidas.',413);
 let patch;try{patch=preferencesPatch(JSON.parse(text));}catch(e){throw new BankError(e instanceof Error?e.message:'Preferências inválidas.',400);}
 const result=await bankQuery(token,'rpc/icom_bank_save_preferences','POST',{p_patch:patch},AbortSignal.timeout(10000));
 return Response.json(readPreferences(result),{headers});
 }catch(e){return bankError(e);}}
