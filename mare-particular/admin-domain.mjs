import { AppError, date, today } from './domain.mjs';
import { ratePriorities } from './public/rates.js';

export function pricingRule(input, existing, maxNights) {
  const title=String(input.title||'').trim(),category=input.category;
  if(title.length<2||title.length>100)throw new AppError('Dê um nome ao período (2 a 100 caracteres).');
  if(!Object.hasOwn(ratePriorities,category))throw new AppError('Escolha um tipo de período válido.');
  date(input.start);date(input.end);
  if(input.end<input.start||(date(input.end)-date(input.start))/86400000>365)throw new AppError('Escolha um período de até 366 noites, com fim após o início.');
  const weekday=Number(input.weekday),weekend=Number(input.weekend),min_nights=Number(input.min_nights);
  if(![weekday,weekend].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=100000000))throw new AppError('Informe diárias válidas em centavos.');
  if(!Number.isSafeInteger(min_nights)||min_nights<1||min_nights>maxNights)throw new AppError(`A estadia mínima deve estar entre 1 e ${maxNights} noites.`);
  const priority=ratePriorities[category];
  if(existing.some(r=>r.priority===priority&&r.start<=input.end&&r.end>=input.start))throw new AppError('Já existe uma tarifa de mesma prioridade nessas datas. Edite o período existente ou ajuste as datas.',409);
  return {title,category,start:input.start,end:input.end,weekday,weekend,min_nights,priority};
}

export function paymentState(reservation, entries) {
  let paid=0,refunded=0;
  for(const e of entries){if(e.reservation_id!==reservation.id)continue;if(e.type==='payment')paid+=e.amount;else refunded+=e.amount;}
  const net=paid-refunded,inactive=['cancelled','expired'].includes(reservation.status);
  return {paid,refunded,net,balance:inactive?0:Math.max(0,reservation.total-net),refundDue:inactive?net:0,status:inactive?(net>0?'refund_pending':paid>0?'refunded':'unpaid'):net>=reservation.total?'paid':net>0?'partial':'unpaid'};
}

export function paymentEntry(input,reservation,entries) {
  const type=input.type,amount=Number(input.amount),method=input.method;
  if(!['payment','refund'].includes(type))throw new AppError('Escolha recebimento ou reembolso.');
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000000)throw new AppError('Informe um valor positivo em centavos.');
  if(!['pix','card','transfer','cash','other'].includes(method))throw new AppError('Escolha a forma de pagamento.');
  date(input.occurred_on);
  if(input.occurred_on>today()||input.occurred_on<'1900-01-01')throw new AppError('A data do registro não pode estar no futuro.');
  const reference=String(input.reference||'').trim(),note=String(input.note||'').trim();
  if(reference.length>150||note.length>500)throw new AppError('A referência ou observação está muito longa.');
  if(typeof input.requestKey!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(input.requestKey))throw new AppError('Atualize o formulário e tente novamente.');
  const state=paymentState(reservation,entries);
  if(type==='payment'&&reservation.status!=='confirmed')throw new AppError('Aprove a reserva antes de registrar um recebimento.',409);
  if(type==='payment'&&amount>state.balance)throw new AppError('O valor supera o saldo a receber desta reserva.',409);
  if(type==='refund'&&amount>state.net)throw new AppError('O reembolso supera o valor recebido disponível.',409);
  if(type==='refund'){
    const timeline=[...entries.filter(e=>e.reservation_id===reservation.id),{type,amount,occurred_on:input.occurred_on}];
    for(const day of new Set(timeline.map(e=>e.occurred_on))){const net=timeline.filter(e=>e.occurred_on<=day).reduce((s,e)=>s+(e.type==='payment'?e.amount:-e.amount),0);if(net<0)throw new AppError('A data do reembolso não pode anteceder o recebimento disponível.',409);}
  }
  return {type,amount,method,occurred_on:input.occurred_on,reference,note,request_key:input.requestKey};
}
