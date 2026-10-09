import {validId} from './contracts.ts';
export type DeleteOperation='archive_admin'|'archive_expense'|'archive_receivable'|'archive_wealth'|'archive_account'|'reverse_payable'|'reverse_receipt'|'reverse_payment'|'cancel_contract';
export function deletionTarget(path:string,b:Record<string,unknown>):{operation:DeleteOperation;id:string}|null{
 const route=path.split('?')[0].replace(/^.*\/api\//,'');let operation:DeleteOperation|undefined;
 if(route==='administrative'&&b.active===false)operation='archive_admin';
 if(route==='personal-wealth'&&b.active===false)operation='archive_wealth';
 if(route==='accounts'&&b.active===false&&b.expected_updated_at)operation='archive_account';
 if(route==='payables'&&(b.action==='reverse'||b.action==='archive'&&b.active===false))operation=b.action==='reverse'?'reverse_payable':'archive_expense';
 if(route==='receivables'&&(b.action==='reverse'||b.action==='archive'&&b.active===false))operation=b.action==='reverse'?'reverse_receipt':'archive_receivable';
 if(route==='payments/reverse')operation='reverse_payment';
 if(route==='contracts'&&b.action==='cancel')operation='cancel_contract';
 if(!operation)return null;if(typeof b.id!=='string'||!validId(b.id))throw new Error('Registro inválido para cancelamento.');return {operation,id:b.id};
}
export function deletionPassword(value:unknown){if(typeof value!=='string'||value.length<8||value.length>64)throw new Error('Informe a senha de exclusão (8 a 64 caracteres).');return value;}
