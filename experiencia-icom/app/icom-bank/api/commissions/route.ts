import {bankAuthorize,bankQuery,bankCashEntries,bankAll,bankError} from '@/lib/icom-bank/server';
import type {Staff} from '@/lib/icom-bank/management';
import type {RepasseRecord} from '@/lib/icom-bank/repasse';
import type {Payable} from '@/lib/icom-bank/payables';
export async function GET(req:Request){try{
 const {token}=await bankAuthorize('comissoes');const staff=await bankQuery<Staff[]>(token,'rpc/icom_bank_list_staff','POST',{});
 const managers=staff.filter(s=>s.active&&s.role==='GERENTE').map(s=>({user_id:s.user_id,name:s.name}));
 if(new URL(req.url).searchParams.get('managers')==='1')return Response.json({managers},{headers:{'Cache-Control':'private, no-store'}});
 const [repasses,entries,payables]=await Promise.all([bankAll(token,'icom_bank_repasse_details?select=*&order=updated_at.desc') as Promise<RepasseRecord[]>,bankCashEntries(token),bankAll(token,'icom_bank_payables?select=*&order=created_at.desc,id') as Promise<Payable[]>]);
 const bySale=new Map(entries.map(e=>[e.id,e])),byPayable=new Map(payables.map(p=>[p.id,p]));
 const rows=repasses.filter(r=>Number(r.manager_cents)>0&&bySale.has(r.sale_id)).map(r=>({repasse:r,sale:bySale.get(r.sale_id)!,payable:r.payable_id?byPayable.get(r.payable_id)||null:null}));
 return Response.json({rows,managers},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return bankError(e);}}
