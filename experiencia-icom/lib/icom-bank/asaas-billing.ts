import {timingSafeEqual} from 'node:crypto';

export function validWebhookToken(expected:string|undefined,actual:string|null){if(!expected||expected.length<32||expected.length>255||/\s/.test(expected)||!actual)return false;const a=Buffer.from(actual),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
function cents(v:unknown){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000||Math.abs(v*100-Math.round(v*100))>.0001)throw new Error('PAYMENT_VALUE_INVALID');return Math.round(v*100);}
function date(v:unknown){if(v==null)return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)throw new Error('PAYMENT_DATE_INVALID');return v;}
export function normalizeAsaasPayment(p:Record<string,unknown>,expectedId:string,today:string){
 if(p.id!==expectedId||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{3,120}$/.test(p.id)||typeof p.subscription!=='string'||!/^[a-zA-Z0-9_-]{3,120}$/.test(p.subscription)||p.billingType!=='CREDIT_CARD')throw new Error('PAYMENT_NOT_SUBSCRIPTION_CARD');
 const amount=cents(p.value);if(!amount)throw new Error('PAYMENT_VALUE_INVALID');const net=p.netValue==null?null:cents(p.netValue);if(net!==null&&net>amount)throw new Error('PAYMENT_NET_INVALID');
 const due=date(p.dueDate);if(!due)throw new Error('PAYMENT_DATE_INVALID');const paid=date(p.paymentDate),credit=date(p.creditDate);let status='PENDENTE',received:string|null=null,refunded=0,refundedAt:string|null=null;
 if(p.status==='CONFIRMED'){status='CONFIRMADO';if(!paid)throw new Error('PAYMENT_DATE_MISSING');}
 else if(p.status==='RECEIVED'){status='RECEBIDO';received=credit;if(!paid||!received||received>today||paid>today||received<paid)throw new Error('PAYMENT_DATE_MISSING');}
 else if(['REFUNDED','REFUND_REQUESTED','REFUND_IN_PROGRESS','CHARGEBACK_REQUESTED','CHARGEBACK_DISPUTE','AWAITING_CHARGEBACK_REVERSAL'].includes(String(p.status))){
  // Refund/chargeback reconciliation needs a verified settlement date and fees.
  // Preserve the event as review; never infer available cash from a notification.
  status='REVISAO';received=paid&&credit&&credit<=today?credit:null;
 }else if(p.deleted===true){status='CANCELADO';}
 else if(!['PENDING','OVERDUE','AWAITING_RISK_ANALYSIS','AUTHORIZED'].includes(String(p.status)))throw new Error('PAYMENT_STATUS_UNSUPPORTED');
 if(Array.isArray(p.refunds)&&p.refunds.length){const done=p.refunds.filter((r:unknown)=>r&&typeof r==='object'&&(r as Record<string,unknown>).status==='DONE') as Record<string,unknown>[];for(const r of done){refunded+=cents(r.value);const d=date(typeof r.dateCreated==='string'?r.dateCreated.slice(0,10):null);if(!d||d>today)throw new Error('PAYMENT_REFUND_DATE_MISSING');if(!refundedAt||d>refundedAt)refundedAt=d;}if(refunded>amount)throw new Error('PAYMENT_REFUND_INVALID');if(refunded>0){status='REVISAO';received=paid&&credit&&credit<=today?credit:null;}}
 if(status==='REVISAO'&&p.status==='REFUNDED'&&refunded===amount&&paid&&received){status='ESTORNADO';}
 return {id:p.id,subscription:p.subscription,amount_cents:amount,fee_cents:net===null?null:amount-net,due_date:due,status,paid_at:['CONFIRMADO','RECEBIDO','ESTORNADO','REVISAO'].includes(status)?paid:null,received_at:received,refunded_cents:refunded,refunded_at:refundedAt};
}
