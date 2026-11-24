import { randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError, daysBetween, today } from './domain.mjs';
import { paymentState } from './admin-domain.mjs';
const providerId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,120}$/.test(value);
const cents=value=>{const n=Number(value),amount=Math.round(n*100);if(!Number.isFinite(n)||!Number.isSafeInteger(amount)||amount<0||Math.abs(n*100-amount)>.00001)throw new AppError('Valor inválido retornado pelo provedor.',502);return amount;};
const paidStatuses=new Set(['CONFIRMED','RECEIVED']);
const acceptedEvents=new Set(['CHECKOUT_PAID','CHECKOUT_EXPIRED','CHECKOUT_CANCELED','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE']);

export function createPayments({db,transaction,audit,config={},fetchImpl=fetch}){
  db.exec(`CREATE TABLE IF NOT EXISTS checkout_orders(id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL REFERENCES reservations(id),provider_id TEXT UNIQUE,amount INTEGER NOT NULL,status TEXT NOT NULL,mode TEXT NOT NULL,url TEXT,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,review TEXT);
    CREATE INDEX IF NOT EXISTS checkout_reservation ON checkout_orders(reservation_id);
    CREATE TABLE IF NOT EXISTS payment_webhooks(id TEXT PRIMARY KEY,event TEXT NOT NULL,checkout_id TEXT,payment_id TEXT,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,received_at TEXT NOT NULL,last_error TEXT);
    CREATE TABLE IF NOT EXISTS provider_payments(id TEXT PRIMARY KEY,checkout_id TEXT NOT NULL REFERENCES checkout_orders(id),paid INTEGER NOT NULL DEFAULT 0,refunded INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  const columns=db.prepare('PRAGMA table_info(payment_entries)').all().map(x=>x.name);
  if(!columns.includes('source'))db.exec("ALTER TABLE payment_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  if(!columns.includes('external_id'))db.exec('ALTER TABLE payment_entries ADD COLUMN external_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS provider_ledger_reference ON payment_entries(source,external_id) WHERE external_id IS NOT NULL');
  const mode=['sandbox','production'].includes(config.mode)?config.mode:null;
  let origin=null;try{const u=new URL(config.publicUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/')origin=u.origin;}catch{}
  const configured=Boolean(mode&&origin&&config.apiKey&&typeof config.webhookToken==='string'&&config.webhookToken.length>=32&&config.webhookToken.length<=255&&!/\s/.test(config.webhookToken));
  const enabled=configured&&config.enabled===true;
  const api=mode==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
  const hosted=mode==='production'?'https://asaas.com':'https://sandbox.asaas.com';
  let closed=false,processing=null;
  async function provider(path,payload){
    let res;try{res=await fetchImpl(api+path,{method:payload?'POST':'GET',headers:{access_token:config.apiKey,'Content-Type':'application/json','User-Agent':'AP-House-Select/1.0'},...(payload?{body:JSON.stringify(payload)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)});}catch{throw new AppError('Não foi possível confirmar a comunicação com o pagamento. Aguarde e consulte sua reserva.',503);}
    if(!res.ok){const error=new AppError('O provedor de pagamento está indisponível. Tente novamente mais tarde.',503);error.definiteRejection=[400,401,403,422].includes(res.status);throw error;}
    try{return await res.json();}catch{throw new AppError('Resposta inválida do provedor de pagamento.',502);}
  }
  const entries=id=>db.prepare('SELECT * FROM payment_entries WHERE reservation_id=?').all(id);
  function metadata(){return {provider:'asaas',mode,configured,enabled,queuePending:db.prepare("SELECT COUNT(*) AS count FROM payment_webhooks WHERE status='pending'").get().count,reviews:db.prepare("SELECT COUNT(*) AS count FROM checkout_orders WHERE status='review'").get().count};}
  function assertManual(id,input){
    if(input.type==='payment'&&db.prepare("SELECT id FROM checkout_orders WHERE reservation_id=? AND status IN ('creating','ready','unknown') AND expires_at>?").get(id,new Date().toISOString()))throw new AppError('Há um checkout em aberto. Aguarde a confirmação automática para evitar registrar o mesmo pagamento duas vezes.',409);
    if(input.type==='refund'&&entries(id).some(e=>e.source==='asaas'))throw new AppError('Para pagamentos do checkout, faça a devolução no Asaas. A confirmação será registrada automaticamente aqui.',409);
  }
  async function checkout(reservationId){
    if(!enabled)throw new AppError('O pagamento online ainda está em configuração. Nenhuma cobrança foi gerada.',503);
    const order=transaction(()=>{
      const r=db.prepare('SELECT * FROM reservations WHERE id=?').get(reservationId);
      if(!r||!['pending','confirmed'].includes(r.status))throw new AppError('Esta reserva não está disponível para pagamento. Consulte as datas novamente.',409);
      const p=paymentState(r,entries(r.id));if(p.net>=r.total)return {paid:true};
      if(p.refunded>0)throw new AppError('Esta reserva possui reembolso. Entre em contato com a proprietária antes de efetuar outro pagamento.',409);
      const existing=db.prepare("SELECT * FROM checkout_orders WHERE reservation_id=? AND status IN ('creating','ready','unknown') ORDER BY created_at DESC LIMIT 1").get(r.id);
      if(existing&&existing.expires_at>new Date().toISOString()){
        if(existing.status==='ready')return {ready:true,url:existing.url};
        throw new AppError('O link de pagamento está sendo conferido. Aguarde antes de tentar novamente.',409);
      }
      if(existing)db.prepare("UPDATE checkout_orders SET status='expired' WHERE id=?").run(existing.id);
      const hold=db.prepare('SELECT day FROM occupancy WHERE reservation_id=?').all(r.id);
      if(hold.length!==r.nights)throw new AppError('As datas desta reserva precisam ser verificadas antes do pagamento.',409);
      const created=new Date().toISOString(),expires=new Date(Date.now()+30*60000).toISOString(),id=randomUUID();
      db.prepare('INSERT INTO checkout_orders(id,reservation_id,amount,status,mode,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').run(id,r.id,p.balance,'creating',mode,expires,created);
      if(r.status==='pending')db.prepare('UPDATE reservations SET expires_at=? WHERE id=?').run(expires,r.id);
      return {id,r,amount:p.balance,expires};
    });
    if(order.ready||order.paid)return order;
    try{
      const result=await provider('/checkouts',{billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:30,externalReference:order.id,callback:{successUrl:origin+'/pagamento',cancelUrl:origin+'/pagamento',expiredUrl:origin+'/pagamento'},items:[{name:'Estadia AP House Select',description:`Reserva ${order.r.code}: ${order.r.checkin} a ${order.r.checkout}`,quantity:1,value:order.amount/100}]});
      if(!providerId(result.id))throw new AppError('O provedor não retornou um checkout válido.',502);
      const url=hosted+'/checkoutSession/show?id='+encodeURIComponent(result.id);
      db.prepare("UPDATE checkout_orders SET provider_id=?,url=?,status='ready' WHERE id=?").run(result.id,url,order.id);audit('checkout.created',order.r.id);
      return {url,expiresAt:order.expires};
    }catch(error){db.prepare('UPDATE checkout_orders SET status=? WHERE id=? AND status=?').run(error.definiteRejection?'failed':'unknown',order.id,'creating');throw error;}
  }
  function accept(headers,input){
    if(!configured)throw new AppError('Integração de pagamentos não configurada.',503);
    const given=Buffer.from(String(headers['asaas-access-token']||'')),secret=Buffer.from(config.webhookToken);
    if(given.length!==secret.length||!timingSafeEqual(given,secret))throw new AppError('Notificação de pagamento não autorizada.',401);
    if(typeof input.id!=='string'||input.id.length<1||input.id.length>200||typeof input.event!=='string')throw new AppError('Notificação de pagamento inválida.');
    if(!acceptedEvents.has(input.event))return {ok:true};
    const checkoutId=providerId(input.checkout?.id)?input.checkout.id:null,paymentId=providerId(input.payment?.id)?input.payment.id:null;
    if(!checkoutId&&!paymentId)throw new AppError('Identificador de pagamento inválido.');
    db.prepare('INSERT OR IGNORE INTO payment_webhooks(id,event,checkout_id,payment_id,received_at) VALUES(?,?,?,?,?)').run(input.id,input.event,checkoutId,paymentId,new Date().toISOString());
    setImmediate(()=>{if(!closed)drain().catch(()=>{});});return {ok:true};
  }
  function ledger(order,payment,type,amount,cumulative,date){
    if(amount<=0)return;
    const occurred=/^\d{4}-\d{2}-\d{2}$/.test(String(date||'').slice(0,10))?String(date).slice(0,10):today();
    db.prepare('INSERT INTO payment_entries(id,reservation_id,type,amount,method,occurred_on,reference,note,request_key,created_at,source,external_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),order.reservation_id,type,amount,payment.billingType==='PIX'?'pix':'card',occurred,payment.id,'Confirmado automaticamente pelo Asaas',`asaas-${payment.id}-${type}-${cumulative}`,new Date().toISOString(),'asaas',`${payment.id}:${type}:${cumulative}`);
  }
  function applyPayment(order,payment){
    if(payment.checkoutSession!==order.provider_id||(payment.externalReference&&payment.externalReference!==order.id)||!['PIX','CREDIT_CARD'].includes(payment.billingType))throw new AppError('Vínculo do pagamento divergente.',502);
    const amount=cents(payment.value);if(amount!==order.amount)throw new AppError('Valor do pagamento divergente da reserva.',502);
    const refunds=Array.isArray(payment.refunds)?payment.refunds.filter(r=>r.status==='DONE'):[];
    const refunded=refunds.reduce((sum,r)=>sum+cents(r.value),0);
    if(refunded>amount)throw new AppError('Valor reembolsado inconsistente.',502);
    const paid=paidStatuses.has(payment.status)||refunded>0||payment.status==='REFUNDED';
    transaction(()=>{
      const previous=db.prepare('SELECT * FROM provider_payments WHERE id=?').get(payment.id);
      if(previous&&previous.checkout_id!==order.id)throw new AppError('Pagamento já vinculado a outra reserva.',409);
      if(!previous)db.prepare('INSERT INTO provider_payments VALUES(?,?,0,0,?,?)').run(payment.id,order.id,payment.status,new Date().toISOString());
      const already=previous?.paid||0,returned=previous?.refunded||0;
      const totalRefunded=payment.status==='REFUNDED'?amount:refunded;
      if(paid&&already<amount){ledger(order,payment,'payment',amount-already,amount,payment.confirmedDate||payment.paymentDate||payment.clientPaymentDate);db.prepare('UPDATE provider_payments SET paid=? WHERE id=?').run(amount,payment.id);audit('payment.confirmed',order.reservation_id);}
      if(totalRefunded>returned){ledger(order,payment,'refund',totalRefunded-returned,totalRefunded,refunds.at(-1)?.dateCreated);db.prepare('UPDATE provider_payments SET refunded=? WHERE id=?').run(totalRefunded,payment.id);audit('refund.confirmed',order.reservation_id);}
      db.prepare('UPDATE provider_payments SET status=?,updated_at=? WHERE id=?').run(payment.status,new Date().toISOString(),payment.id);
      if(paid){
        const r=db.prepare('SELECT * FROM reservations WHERE id=?').get(order.reservation_id),p=paymentState(r,entries(r.id));
        let review=null;
        if(r.status==='cancelled')review='Pagamento recebido em reserva cancelada. Conferir devolução.';
        if(totalRefunded>0)review='Reembolso confirmado no provedor. Confira a situação da hospedagem.';
        if(p.net>r.total)review='Mais de um pagamento recebido. Conferir valor excedente.';
        if(!review&&p.net>=r.total){
          const nights=daysBetween(r.checkin,r.checkout),conflict=nights.some(day=>{const o=db.prepare('SELECT reservation_id FROM occupancy WHERE day=?').get(day);return o&&o.reservation_id!==r.id;});
          if(conflict||r.checkin<today())review='Pagamento recebido após liberação das datas. Conferir disponibilidade ou devolução.';
          else{for(const day of nights)db.prepare('INSERT OR IGNORE INTO occupancy(day,reservation_id) VALUES(?,?)').run(day,r.id);if(r.status!=='confirmed'){db.prepare("UPDATE reservations SET status='confirmed',expires_at=NULL WHERE id=?").run(r.id);audit('reservation.confirmed',r.id);}}
        }
        db.prepare('UPDATE checkout_orders SET status=?,review=? WHERE id=?').run(review?'review':totalRefunded===amount?'refunded':'paid',review,order.id);
      }else if(payment.status?.startsWith('CHARGEBACK'))db.prepare("UPDATE checkout_orders SET status='review',review='Contestação de cartão. Confira o pagamento no Asaas.' WHERE id=?").run(order.id);
    });
  }
  async function processEvent(event){
    let list=[];
    if(event.payment_id){list=[await provider('/payments/'+encodeURIComponent(event.payment_id))];}
    else{const result=await provider('/payments?'+new URLSearchParams({checkoutSession:event.checkout_id,limit:'100'}));if(!Array.isArray(result.data)||result.hasMore)throw new AppError('Lista de pagamentos requer conciliação.',502);list=result.data;}
    let matched=false,financial=false;
    for(const payment of list){if(!providerId(payment.id)||!providerId(payment.checkoutSession))continue;const order=db.prepare('SELECT * FROM checkout_orders WHERE provider_id=? AND mode=?').get(payment.checkoutSession,mode);if(!order)continue;matched=true;applyPayment(order,payment);if(paidStatuses.has(payment.status)||payment.status==='REFUNDED')financial=true;}
    if(event.event==='CHECKOUT_PAID'&&!financial&&db.prepare('SELECT id FROM checkout_orders WHERE provider_id=? AND mode=?').get(event.checkout_id,mode))throw new AppError('Confirmação financeira ainda não disponível no provedor.',503);
    if(['CHECKOUT_CANCELED','CHECKOUT_EXPIRED'].includes(event.event)){
      // Expiration releases dates at the hold deadline. A checkout redirect never cancels a reservation.
      db.prepare("UPDATE checkout_orders SET status='expired' WHERE provider_id=? AND mode=? AND status IN ('creating','ready','unknown') AND expires_at<=?").run(event.checkout_id,mode,new Date().toISOString());
    }
  }
  async function run(){
    const pending=db.prepare("SELECT * FROM payment_webhooks WHERE status='pending' AND next_at<=? ORDER BY received_at LIMIT 20").all(Date.now());
    for(const event of pending){if(closed)break;try{await processEvent(event);db.prepare("UPDATE payment_webhooks SET status='processed',last_error=NULL WHERE id=?").run(event.id);}catch{const attempts=event.attempts+1;db.prepare('UPDATE payment_webhooks SET attempts=?,next_at=?,last_error=? WHERE id=?').run(attempts,Date.now()+Math.min(3600000,Math.pow(2,Math.min(attempts,10))*1000),'Aguardando consulta segura ao provedor.',event.id);}}
  }
  function drain(){if(closed||!configured)return Promise.resolve();if(!processing)processing=run().finally(()=>{processing=null;});return processing;}
  const timer=configured?setInterval(()=>{drain().catch(()=>{});},15000):null;timer?.unref();if(configured)setImmediate(()=>{drain().catch(()=>{});});
  function publicStatus(id){const r=db.prepare('SELECT * FROM reservations WHERE id=?').get(id),p=paymentState(r,entries(id)),order=db.prepare('SELECT * FROM checkout_orders WHERE reservation_id=? ORDER BY created_at DESC LIMIT 1').get(id);return {code:r.code,checkin:r.checkin,checkout:r.checkout,total:r.total,status:r.status,paymentStatus:p.status,paid:p.net,balance:p.balance,checkoutStatus:order?.status||null,review:Boolean(order?.review),expiresAt:r.expires_at,paymentsEnabled:enabled,mode};}
  return {enabled,configured,mode,metadata,checkout,accept,drain,assertManual,publicStatus,close:async()=>{closed=true;if(timer)clearInterval(timer);await processing;}};
}
