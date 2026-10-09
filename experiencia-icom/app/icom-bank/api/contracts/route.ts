import {deletionQuery} from '@/lib/icom-bank/deletion-server';
import {validId,type VehicleRow} from '@/lib/icom-bank/contracts';
import {bankAuthorize,bankOrigin,bankQuery,bankError,BankError} from '@/lib/icom-bank/server';
import {resolveVehicleSpec} from '@/lib/icom-bank/fipe-server';
import type {VehicleSpec} from '@/lib/icom-bank/vehicle-catalog';
import {contractInput} from '@/lib/icom-bank/contracts';
export async function POST(req:Request){try{bankOrigin(req);const {token,profile}=await bankAuthorize('contratos');if(profile.role==='FINANCEIRO')throw new BankError('Sem permissão para cadastrar contratos.');const text=await req.text();if(text.length>20000)throw new BankError('Solicitação acima do limite.',400);let input;try{input=contractInput(JSON.parse(text));}catch(error){throw new BankError(error instanceof Error?error.message:'Confira os dados.',400);}if(input.vehicle.catalog){const [existing]=await bankQuery<{vehicle_id:string}[]>(token,'icom_bank_contracts?id=eq.'+input.request_id+'&select=vehicle_id');const [previous]=existing?await bankQuery<{details:{catalog?:VehicleSpec}}[]>(token,'icom_bank_vehicles?id=eq.'+existing.vehicle_id+'&select=details'):[];const spec=await resolveVehicleSpec(input.vehicle.catalog,previous?.details.catalog);Object.assign(input.vehicle,{catalog:spec,brand:spec.brand,model:spec.model,version:spec.version,model_year:spec.year,fuel:spec.fipe?.fuel||input.vehicle.fuel});}const result=await bankQuery<{id:string;number:string}>(token,'rpc/icom_bank_create_contract','POST',{p_customer:input.customer_id,p_request:input.request_id,p_vehicle:input.vehicle,p_finance:input.finance});return Response.json(result,{status:201,headers:{'Cache-Control':'no-store'}});}catch(error){return bankError(error);}}

export async function PATCH(req:Request){try{
 bankOrigin(req);const {token,profile}=await bankAuthorize('contratos');const raw=await req.text();if(raw.length>20000)throw new BankError('Solicitação acima do limite.',413);const b=JSON.parse(raw);
 if(typeof b.id!=='string'||!validId(b.id)||typeof b.expected_updated_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(b.expected_updated_at)||!Number.isFinite(Date.parse(b.expected_updated_at)))throw new BankError('Reabra o pedido antes de continuar.',400);
 let result;if(b.action==='cancel'){
 if(!['OWNER','ADMIN'].includes(profile.role))throw new BankError('Somente administrador pode cancelar vendas.');if(typeof b.reason!=='string'||b.reason.trim().length<3||b.reason.length>1000)throw new BankError('Informe o motivo do cancelamento.',400);
 result=await deletionQuery(token,'cancel_contract',b.id,'rpc/icom_bank_cancel_contract',{p_id:b.id,p_expected:b.expected_updated_at,p_reason:b.reason.trim()},b.deletion_password);
 }else if(b.action==='edit'){
 const input=contractInput({...b,request_id:b.id});if(input.vehicle.catalog){const [c]=await bankQuery<{vehicle_id:string}[]>(token,'icom_bank_contracts?id=eq.'+b.id+'&select=vehicle_id');const [v]=c?await bankQuery<VehicleRow[]>(token,'icom_bank_vehicles?id=eq.'+c.vehicle_id+'&select=*'):[];const spec=await resolveVehicleSpec(input.vehicle.catalog,v?.details.catalog);Object.assign(input.vehicle,{catalog:spec,brand:spec.brand,model:spec.model,version:spec.version,model_year:spec.year,fuel:spec.fipe?.fuel||input.vehicle.fuel});}
 result=await bankQuery(token,'rpc/icom_bank_update_contract','POST',{p_id:b.id,p_expected:b.expected_updated_at,p_vehicle:input.vehicle,p_finance:input.finance});
 }else throw new BankError('Ação inválida.',400);
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
