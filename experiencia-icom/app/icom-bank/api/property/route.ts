import {bankAuthorize,bankOrigin,bankError,bankQuery,bankAll,BankError} from '@/lib/icom-bank/server';
import {propertyInput,rentReceiveInput} from '@/lib/icom-bank/property';
import {brazilDay} from '@/lib/icom-bank/model';
import {sharedAssistantCache} from '@/lib/icom-bank/assistant-cache';
export async function GET(){try{const {token}=await bankAuthorize('administrativo');const [plans,rents]=await Promise.all([bankAll(token,'icom_bank_property_plans?select=*&order=created_at.desc,wealth_id.asc'),bankAll(token,'icom_bank_rent_dues?select=*&order=due_date.asc,id.asc')]);return Response.json({plans,rents},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return bankError(e);}}
export async function POST(req:Request){try{bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>9000)throw new BankError('Cadastro muito extenso.',400);const b=JSON.parse(raw);let row;
 if(b.action==='receive'){row=await bankQuery(token,'rpc/icom_bank_receive_rent','POST',rentReceiveInput(b,brazilDay()));}else{const {wealth,property}=propertyInput(b);const {expected_updated_at,...payload}=wealth;row=await bankQuery(token,'rpc/icom_bank_save_property','POST',{p_payload:payload,p_property:property,p_expected:expected_updated_at});}
 sharedAssistantCache().clear();return Response.json({row},{headers:{'Cache-Control':'no-store'}});}catch(e){return bankError(e instanceof BankError?e:new BankError(e instanceof Error?e.message:'Confira os dados do imóvel.',400));}}
