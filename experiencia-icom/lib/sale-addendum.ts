export const ADDENDUM_NOTICE='O abatimento registra a condição comercial e os itens expressamente descritos neste adendo. A garantia legal do veículo permanece assegurada, inclusive quanto a vícios ocultos, conforme o Código de Defesa do Consumidor. Esta ciência não representa renúncia de direitos nem exclusão automática de peças ou sistemas da garantia.';
export type AddendumTerms={has_discount:boolean;original_price_cents:number|null;final_price_cents:number|null;discount_cents:number;details:string;contract_reference:string};
export type AddendumReceipt={id:string;addendum_id:string;outcome:'agreed'|'questions';acknowledgement_text:string;recorded_at:string};
export type SaleAddendum=AddendumTerms&{id:string;experience_id:string;version:number;created_at:string;notice_text:string;receipt?:AddendumReceipt|null;experience_addendum_receipts?:AddendumReceipt[]|AddendumReceipt|null};
export function moneyCents(value:unknown):number{
 if(typeof value!=='string'||! /^(?:\d{1,9}|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value.trim()))throw Error('Informe um valor em reais, como 106.000,00.');
 const [whole,fraction='']=value.trim().replaceAll('.','').split(',');
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>10000000000)throw Error('Informe um valor maior que zero e até R$ 100 milhões.');
 return cents;
}
export function addendumTerms(value:unknown):AddendumTerms{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Informe se houve desconto antes de gerar o link.');
 const body=value as Record<string,unknown>;
 if(typeof body.has_discount!=='boolean')throw Error('Selecione Sim ou Não em “Teve desconto?”.');
 if(typeof body.details!=='string'||typeof body.contract_reference!=='string')throw Error('Observações do adendo inválidas.');
 const details=body.details.trim(),contract_reference=body.contract_reference.trim();
 if(details.length>4000||contract_reference.length>120)throw Error('Use até 4.000 caracteres nas observações e 120 na referência do contrato.');
 if(!body.has_discount)return {has_discount:false,original_price_cents:null,final_price_cents:null,discount_cents:0,details,contract_reference};
 const original=moneyCents(body.original_price),final=moneyCents(body.final_price);
 if(final>=original)throw Error('O preço final deve ser menor que o preço original para registrar desconto.');
 return {has_discount:true,original_price_cents:original,final_price_cents:final,discount_cents:original-final,details,contract_reference};
}
export function addendumFromForm(form:FormData){return {has_discount:form.get('has_discount')==='yes'?true:form.get('has_discount')==='no'?false:null,original_price:String(form.get('original_price')||''),final_price:String(form.get('final_price')||''),details:String(form.get('addendum_details')||''),contract_reference:String(form.get('contract_reference')||'')};}
export const brl=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export const needsAddendumReceipt=(addendum:SaleAddendum|null|undefined)=>!!addendum&&(addendum.has_discount||!!addendum.details);
export function addendumReceipt(addendum:SaleAddendum):AddendumReceipt|null{const value=addendum.experience_addendum_receipts;return addendum.receipt||(Array.isArray(value)?value[0]:value)||null;}
