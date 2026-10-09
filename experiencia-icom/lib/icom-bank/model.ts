import {parseRiskProfile,type RiskProfile} from './risk.ts';
import type {VehicleSpec} from './vehicle-catalog.ts';
export type BankRole='OWNER'|'ADMIN'|'GERENTE'|'FINANCEIRO'|'VENDEDOR';
export type BankProfile={user_id:string;name:string;role:BankRole;active:boolean};
export const bankMenu=[['dashboard','Visão Geral'],['clientes','Nova venda'],['contratos','Contratos'],['administrativo','Administrativo'],['parcelas','Parcelas'],['pagamentos','Pagamentos'],['comprovantes','Comprovantes'],['inadimplencia','Inadimplência'],['veiculos','Veículos'],['relatorios','Relatórios'],['funcionarios','Funcionários'],['configuracoes','Configurações']] as const;
const permissions:Record<BankRole,string[]>={OWNER:bankMenu.map(([key])=>key),ADMIN:bankMenu.filter(([key])=>key!=='administrativo').map(([key])=>key),GERENTE:['dashboard','clientes','contratos','parcelas','pagamentos','comprovantes','inadimplencia','veiculos','relatorios'],FINANCEIRO:['dashboard','parcelas','pagamentos','comprovantes','inadimplencia'],VENDEDOR:['dashboard','clientes','contratos']};
export const canBank=(role:BankRole,section:string)=>permissions[role]?.includes(section)||false;
export const bankPath=(path='')=>'/experiencia-icom/icom-bank'+path;
export const currency=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function brazilDay(now=new Date()){const parts=new Intl.DateTimeFormat('en',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');}
export const maskCpf=(cpf:string)=>'***.'+cpf.slice(3,6)+'.***-'+cpf.slice(-2);
export function validCpf(cpf:string){if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;for(let size=9;size<=10;size++){let sum=0;for(let i=0;i<size;i++)sum+=Number(cpf[i])*(size+1-i);const digit=(sum*10)%11;if((digit===10?0:digit)!==Number(cpf[size]))return false;}return true;}
export function customerInput(body:Record<string,unknown>){const name=String(body.name||'').trim(),cpf=String(body.cpf||'').replace(/\D/g,''),phone=String(body.phone||'').trim(),email=String(body.email||'').trim();if(name.length<2||name.length>160||!validCpf(cpf)||phone.length>30||email.length>254||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Confira nome, CPF válido, telefone e e-mail.');return {name,cpf,phone,email,risk_profile:parseRiskProfile(body.risk_profile)};}
export type BankCustomer={id:string;name:string;cpf:string;phone:string;email:string;status:string;assigned_to:string|null;created_at:string;updated_at?:string;risk_profile?:RiskProfile|null;vehicles?:{brand:string;model:string;plate:string}[];contracts?:{id:string;number:string;status:string;installments:{due_date:string;status:string}[]}[]};
export type BankContract={id:string;customer_id:string;vehicle_id:string;number:string;status:string;principal_cents:number;total_cents:number;sale_date:string};
export type BankInstallment={id:string;contract_id:string;number:number;due_date:string;original_cents:number;updated_cents:number;paid_cents:number;paid_at:string|null;status:string};
export type BankPayment={id:string;installment_id:string;amount_cents:number;paid_at:string;created_at:string;status?:'CONFIRMADO'|'ESTORNADO';reversed_at?:string|null;reversal_reason?:string|null};
export type BankProof={id:string;installment_id:string;informed_cents:number;status:string;created_at:string};
export type BankData={customers:BankCustomer[];contracts:BankContract[];installments:BankInstallment[];payments:BankPayment[];proofs:BankProof[];vehicles:{id:string;customer_id:string;brand:string;model:string;plate:string;details?:{version?:string;model_year?:number;catalog?:VehicleSpec}}[];settings:{company_name:string;pix_key:string|null;pix_type:string|null}|null};
export function installmentStatus(row:BankInstallment,today=brazilDay()){if(['PAGO','CANCELADO','RENEGOCIADO','COMPROVANTE_ENVIADO'].includes(row.status))return row.status;return row.due_date<today?'ATRASADO':row.due_date===today?'VENCE_HOJE':'A_VENCER';}
export function dashboard(data:BankData,today=brazilDay()){
 const month=today.slice(0,7),contracts=data.contracts.filter(c=>c.status==='ATIVO'),active=new Set(contracts.map(c=>c.id));
 const items=data.installments.filter(i=>active.has(i.contract_id)&&!['PAGO','CANCELADO','RENEGOCIADO'].includes(i.status));
 const balance=(i:BankInstallment)=>Math.max(0,Number(i.updated_cents)-Number(i.paid_cents));
 const overdue=items.filter(i=>i.due_date<today),pending=data.proofs.filter(p=>p.status==='COMPROVANTE_ENVIADO');
 return {active:items.reduce((n,i)=>n+balance(i),0),received:data.payments.filter(p=>p.status!=='ESTORNADO'&&p.paid_at.slice(0,7)===month).reduce((n,p)=>n+Number(p.amount_cents),0),due:items.filter(i=>i.due_date.slice(0,7)===month).reduce((n,i)=>n+balance(i),0),overdue:overdue.reduce((n,i)=>n+balance(i),0),customers:new Set(contracts.map(c=>c.customer_id)).size,contracts:contracts.length,pending:pending.length,pendingValue:pending.reduce((n,p)=>n+Number(p.informed_cents),0),today:items.filter(i=>i.due_date===today),pendingProofs:pending,bands:[[1,5],[6,15],[16,30],[31,Infinity]].map(([min,max])=>{const list=overdue.filter(i=>{const days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(i.due_date+'T12:00:00Z'))/86400000);return days>=min&&days<=max;});return {customers:new Set(list.map(i=>data.contracts.find(c=>c.id===i.contract_id)?.customer_id)).size,value:list.reduce((n,i)=>n+balance(i),0)};})};
}

export function customerSearch(query:string){const clean=query.replace(/[^\p{L}\p{N} @.-]/gu,'').slice(0,100);return clean?`&or=(name.ilike.*${encodeURIComponent(clean.replace(/\./g,''))}*,cpf.ilike.*${clean.replace(/\D/g,'')||'none'}*)`:'';}
