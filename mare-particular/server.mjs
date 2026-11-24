import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, defaults, quote, guestDetails, settings, daysBetween } from './domain.mjs';
import { pricingRule, paymentEntry, paymentState } from './admin-domain.mjs';
import { createAuth } from './auth.mjs';
import { createGuestAccess } from './guest-access.mjs';
import { createPayments } from './payments.mjs';

export function createApp(options={}) {
  const demo=options.demo ?? process.env.DEMO_MODE!=='false';
  const dataDir=resolve(options.dataDir||process.env.DATA_DIR||'./data');
  mkdirSync(dataDir,{recursive:true});
  const db=new DatabaseSync(resolve(dataDir,'mare.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS reservations(id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, note TEXT NOT NULL, checkin TEXT NOT NULL, checkout TEXT NOT NULL, guests INTEGER NOT NULL, nights INTEGER NOT NULL, subtotal INTEGER NOT NULL, cleaning INTEGER NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','confirmed','cancelled','expired')), created_at TEXT NOT NULL, expires_at TEXT, snapshot TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY, start TEXT NOT NULL, end TEXT NOT NULL, reason TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS occupancy(day TEXT PRIMARY KEY, reservation_id TEXT REFERENCES reservations(id), block_id TEXT REFERENCES blocks(id), CHECK((reservation_id IS NULL)!=(block_id IS NULL)));
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, record_id TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pricing_rules(id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,weekday INTEGER NOT NULL,weekend INTEGER NOT NULL,min_nights INTEGER NOT NULL,priority INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS payment_entries(id TEXT PRIMARY KEY,reservation_id TEXT NOT NULL REFERENCES reservations(id),type TEXT NOT NULL CHECK(type IN ('payment','refund')),amount INTEGER NOT NULL CHECK(amount>0),method TEXT NOT NULL,occurred_on TEXT NOT NULL,reference TEXT NOT NULL,note TEXT NOT NULL,request_key TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS payment_reservation ON payment_entries(reservation_id);
  `);
  db.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(1,?)').run(JSON.stringify(defaults));
  const auth=createAuth(db,{username:options.username||process.env.ADMIN_USERNAME,password:options.password??process.env.ADMIN_PASSWORD,mustChange:options.mustChange});
  const rates=new Map();
  const publicDir=resolve(fileURLToPath(new URL('./public/',import.meta.url)));
  const config=()=>JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
  const busy=()=>db.prepare('SELECT day FROM occupancy ORDER BY day').all().map(x=>x.day);
  const pricingRules=()=>db.prepare('SELECT * FROM pricing_rules ORDER BY start,priority DESC').all();
  const paymentEntries=()=>db.prepare('SELECT * FROM payment_entries ORDER BY occurred_on DESC,created_at DESC').all();
  const audit=(action,id='')=>db.prepare('INSERT INTO audit(action,record_id,created_at) VALUES(?,?,?)').run(action,id,new Date().toISOString());
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
  const guestAccess=createGuestAccess(db);
  const paymentConfig=options.payments||{enabled:process.env.AP_PAYMENTS_ENABLED==='true',mode:process.env.AP_ASAAS_MODE,apiKey:process.env.AP_ASAAS_API_KEY,webhookToken:process.env.AP_ASAAS_WEBHOOK_TOKEN,publicUrl:process.env.AP_PUBLIC_URL};
  const payments=createPayments({db,transaction,audit,fetchImpl:options.paymentFetch||fetch,config:{...paymentConfig,enabled:paymentConfig.enabled===true&&(!demo||paymentConfig.mode==='sandbox')}});
  function expire(){transaction(()=>{const ids=db.prepare("SELECT id FROM reservations WHERE status='pending' AND expires_at<?").all(new Date().toISOString());for(const {id} of ids){db.prepare('DELETE FROM occupancy WHERE reservation_id=?').run(id);db.prepare("UPDATE reservations SET status='expired' WHERE id=?").run(id);audit('reservation.expired',id);}});}
  const owner=req=>auth.owner(req);
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>20000)throw new AppError('Solicitação muito grande.',413);}try{return JSON.parse(raw||'{}');}catch{throw new AppError('Solicitação inválida.');}}
  function rate(req,key,max){const id=`${req.socket.remoteAddress}:${key}`,now=Date.now();if(rates.size>5000)for(const [k,v]of rates)if(v.until<now)rates.delete(k);const current=rates.get(id);if(!current||current.until<now){rates.set(id,{count:1,until:now+600000});return;}if(++current.count>max)throw new AppError('Muitas tentativas. Aguarde alguns minutos.',429);}
  function cookie(res,value,age=28800){res.setHeader('Set-Cookie',`ap_owner=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.SECURE_COOKIES==='true'?'; Secure':''}`);}
  const server=http.createServer(async(req,res)=>{
    try{
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
      res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(!['GET','HEAD','POST','PATCH','DELETE'].includes(req.method))throw new AppError('Método não permitido.',405);
      if(['POST','PATCH','DELETE'].includes(req.method)){
        if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin).host;}catch{throw new AppError('Origem inválida.',403);}if(origin!==req.headers.host)throw new AppError('Origem inválida.',403);}
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new AppError('Use JSON nesta solicitação.',415);
      }
      if(path==='/api/health')return send(res,200,{ok:true,application:'mare-particular',mode:demo?'demo':'live',storage:'sqlite'});
      if(path==='/api/public'&&req.method==='GET'){expire();return send(res,200,{config:config(),busy:busy(),pricingRules:pricingRules(),demo,paymentsEnabled:payments.enabled,paymentsMode:payments.mode});}
      if(path==='/api/quote'&&req.method==='POST'){expire();const input=await body(req);return send(res,200,quote(input,config(),busy(),pricingRules()));}
      if(path==='/api/reservations'&&req.method==='POST'){
        rate(req,'reservation',30);expire();const input=await body(req),guest=guestDetails(input);
        if(typeof input.requestKey!=='string'||!/^[a-zA-Z0-9-]{16,100}$/.test(input.requestKey))throw new AppError('Atualize a página e tente novamente.');
        const result=transaction(()=>{
          const existing=db.prepare('SELECT * FROM reservations WHERE request_key=?').get(input.requestKey);
          if(existing){if(existing.email!==guest.email||existing.checkin!==input.checkin||existing.checkout!==input.checkout||existing.guests!==Number(input.guests))throw new AppError('Solicitação já utilizada. Atualize a página.',409);return existing;}
          const cfg=config(),q=quote(input,cfg,busy(),pricingRules()),id=randomUUID(),code=`MP-${randomBytes(4).toString('hex').toUpperCase()}`,created=new Date().toISOString(),expires=new Date(Date.now()+(payments.enabled?1800000:86400000)).toISOString();
          if(input.expectedTotal!==undefined&&(!Number.isSafeInteger(input.expectedTotal)||input.expectedTotal!==q.total))throw new AppError('O valor deste período mudou. Consulte novamente e confira o novo total antes de solicitar a reserva.',409);
          db.prepare('INSERT INTO reservations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,code,guest.name,guest.email,guest.phone,guest.note,q.checkin,q.checkout,q.guests,q.nights,q.subtotal,q.cleaning,q.total,'pending',created,expires,JSON.stringify({rules:cfg.rules,cancellation:cfg.cancellation,quote:q,acceptedAt:created,demo}),input.requestKey);
          for(const day of q.items.map(x=>x.day))db.prepare('INSERT INTO occupancy(day,reservation_id) VALUES(?,?)').run(day,id);
          audit('reservation.requested',id);return db.prepare('SELECT * FROM reservations WHERE id=?').get(id);
        });
        return send(res,201,{code:result.code,status:result.status,checkin:result.checkin,checkout:result.checkout,total:result.total,expiresAt:result.expires_at,guestToken:guestAccess.token(result),paymentsEnabled:payments.enabled,demo,message:payments.enabled?'Reserva iniciada. Conclua o pagamento para confirmar suas datas.':'Solicitação registrada. A confirmação depende da aprovação da proprietária. Nenhuma cobrança foi realizada.'});
      }
      if(path==='/api/booking'&&req.method==='POST'){rate(req,'booking-status',100);expire();const input=await body(req),r=guestAccess.read(input.token);return send(res,200,payments.publicStatus(r.id));}
      if(path==='/api/checkout'&&req.method==='POST'){rate(req,'checkout',30);expire();const input=await body(req),r=guestAccess.read(input.token);return send(res,200,await payments.checkout(r.id));}
      if(path==='/api/payments/asaas/webhook'&&req.method==='POST'){return send(res,200,payments.accept(req.headers,await body(req)));}
      if(path==='/api/auth/setup'&&req.method==='POST'){rate(req,'setup',10);auth.setup(await body(req),String(req.headers.authorization||'').replace(/^Bearer /,''));audit('owner.created');return send(res,201,{ok:true});}
      if(path==='/api/auth/session'&&req.method==='GET'){const account=auth.session(req);return send(res,200,{authenticated:Boolean(account),mustChange:Boolean(account?.must_change),username:account?.username||null});}
      if(path==='/api/login'&&req.method==='POST'){rate(req,'login',12);const result=auth.login(await body(req));cookie(res,result.token);return send(res,200,{ok:true,mustChange:result.mustChange});}
      if(path==='/api/auth/password'&&req.method==='POST'){rate(req,'password',10);const value=auth.change(req,await body(req));cookie(res,value);audit('owner.password_changed');return send(res,200,{ok:true});}
      if(path==='/api/logout'&&req.method==='POST'){auth.logout(req);cookie(res,'',0);return send(res,200,{ok:true});}
      if(path.startsWith('/api/owner')){
        owner(req);expire();
        if(path==='/api/owner'&&req.method==='GET'){
          const entries=paymentEntries();
          return send(res,200,{config:config(),reservations:db.prepare('SELECT * FROM reservations ORDER BY created_at DESC').all().map(({snapshot,request_key,...r})=>({...r,payment:paymentState(r,entries)})),payments:entries.map(({request_key,...e})=>e),pricingRules:pricingRules(),blocks:db.prepare('SELECT * FROM blocks ORDER BY start').all(),busy:busy(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 50').all(),paymentIntegration:payments.metadata(),paymentReviews:db.prepare("SELECT reservation_id,review FROM checkout_orders WHERE status='review'").all(),demo});
        }
        if(path==='/api/owner/settings'&&req.method==='PATCH'){const next=settings(await body(req),config());transaction(()=>{if(pricingRules().some(r=>r.min_nights>next.maxNights))throw new AppError('Há períodos com estadia mínima superior ao novo máximo. Ajuste esses períodos primeiro.',409);db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(next));audit('settings.updated');});return send(res,200,{config:next});}
        const ruleMatch=path.match(/^\/api\/owner\/pricing-rules(?:\/([a-f0-9-]{36}))?$/);
        if(ruleMatch&&['POST','PATCH','DELETE'].includes(req.method)){
          const id=ruleMatch[1],input=await body(req);
          if((req.method==='POST'&&id)||(req.method!=='POST'&&!id))throw new AppError('Endereço inválido.',404);
          transaction(()=>{
            if(id&&!db.prepare('SELECT id FROM pricing_rules WHERE id=?').get(id))throw new AppError('Período não encontrado.',404);
            if(req.method==='DELETE'){db.prepare('DELETE FROM pricing_rules WHERE id=?').run(id);audit('pricing.removed',id);return;}
            const rules=pricingRules();if(!id&&rules.length>=200)throw new AppError('Limite de 200 períodos atingido. Remova períodos antigos.');
            const r=pricingRule(input,rules.filter(r=>r.id!==id),config().maxNights),key=id||randomUUID();
            if(id)db.prepare('UPDATE pricing_rules SET title=?,category=?,start=?,end=?,weekday=?,weekend=?,min_nights=?,priority=? WHERE id=?').run(r.title,r.category,r.start,r.end,r.weekday,r.weekend,r.min_nights,r.priority,id);
            else db.prepare('INSERT INTO pricing_rules VALUES(?,?,?,?,?,?,?,?,?,?)').run(key,r.title,r.category,r.start,r.end,r.weekday,r.weekend,r.min_nights,r.priority,new Date().toISOString());
            audit(id?'pricing.updated':'pricing.created',key);
          });return send(res,200,{ok:true});
        }
        const paymentMatch=path.match(/^\/api\/owner\/reservations\/([a-f0-9-]{36})\/payments$/);
        if(paymentMatch&&req.method==='POST'){
          const input=await body(req),reservationId=paymentMatch[1];
          const result=transaction(()=>{
            const reservation=db.prepare('SELECT * FROM reservations WHERE id=?').get(reservationId);if(!reservation)throw new AppError('Reserva não encontrada.',404);
            const existing=db.prepare('SELECT * FROM payment_entries WHERE request_key=?').get(String(input.requestKey||''));
            if(existing){if(existing.reservation_id!==reservationId||existing.type!==input.type||existing.amount!==Number(input.amount)||existing.method!==input.method||existing.occurred_on!==input.occurred_on||existing.reference!==String(input.reference||'').trim()||existing.note!==String(input.note||'').trim())throw new AppError('Este identificador já foi utilizado em outro registro.',409);return existing.id;}
            payments.assertManual(reservationId,input);const e=paymentEntry(input,reservation,paymentEntries()),id=randomUUID();
            db.prepare('INSERT INTO payment_entries(id,reservation_id,type,amount,method,occurred_on,reference,note,request_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,reservationId,e.type,e.amount,e.method,e.occurred_on,e.reference,e.note,e.request_key,new Date().toISOString());audit(e.type==='payment'?'payment.recorded':'refund.recorded',reservationId);return id;
          });return send(res,201,{ok:true,id:result});
        }
        const match=path.match(/^\/api\/owner\/reservations\/([a-f0-9-]{36})$/);
        if(match&&req.method==='PATCH'){
          const input=await body(req);if(!['confirmed','cancelled'].includes(input.status))throw new AppError('Situação inválida.');
          transaction(()=>{const r=db.prepare('SELECT * FROM reservations WHERE id=?').get(match[1]);if(!r)throw new AppError('Reserva não encontrada.',404);if(!['pending','confirmed'].includes(r.status))throw new AppError('Esta reserva já foi encerrada.',409);if(input.status==='cancelled')db.prepare('DELETE FROM occupancy WHERE reservation_id=?').run(r.id);db.prepare('UPDATE reservations SET status=?, expires_at=NULL WHERE id=?').run(input.status,r.id);audit(`reservation.${input.status}`,r.id);});
          return send(res,200,{ok:true});
        }
        if(path==='/api/owner/blocks'&&req.method==='POST'){
          const input=await body(req),nights=daysBetween(input.start,input.end),reason=String(input.reason||'Uso da proprietária').trim();if(reason.length>200)throw new AppError('Motivo muito longo.');
          transaction(()=>{if(busy().some(d=>nights.includes(d)))throw new AppError('Há uma reserva ou bloqueio nesse período.',409);const id=randomUUID();db.prepare('INSERT INTO blocks VALUES(?,?,?,?)').run(id,input.start,input.end,reason);for(const day of nights)db.prepare('INSERT INTO occupancy(day,block_id) VALUES(?,?)').run(day,id);audit('block.created',id);});
          return send(res,201,{ok:true});
        }
        const block=path.match(/^\/api\/owner\/blocks\/([a-f0-9-]{36})$/);
        if(block&&req.method==='DELETE'){transaction(()=>{const found=db.prepare('SELECT id FROM blocks WHERE id=?').get(block[1]);if(!found)throw new AppError('Bloqueio não encontrado.',404);db.prepare('DELETE FROM occupancy WHERE block_id=?').run(block[1]);db.prepare('DELETE FROM blocks WHERE id=?').run(block[1]);audit('block.removed',block[1]);});return send(res,200,{ok:true});}
        throw new AppError('Recurso não encontrado.',404);
      }
      if(path.startsWith('/api/'))throw new AppError('Recurso não encontrado.',404);
      let decoded;try{decoded=decodeURIComponent(path);}catch{throw new AppError('Endereço inválido.');}
      const page=['/','/reservar','/proprietaria','/administrador','/pagamento'].includes(decoded)?'/index.html':decoded;
      const file=resolve(publicDir,`.${page}`);
      if(!file.startsWith(`${publicDir}${sep}`)||!existsSync(file))throw new AppError('Página não encontrada.',404);
      const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png'}[extname(file)];
      if(!mime)throw new AppError('Página não encontrada.',404);
      res.writeHead(200,{'Content-Type':mime,'Cache-Control':['.html','.css','.js'].includes(extname(file))?'no-cache':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:readFileSync(file));
    }catch(error){if(res.headersSent){res.end();return;}send(res,error instanceof AppError?error.status:500,{error:error instanceof AppError?error.message:'Não foi possível concluir. Tente novamente.',...(error.code==='PASSWORD_CHANGE_REQUIRED'?{code:error.code}:{})});if(!(error instanceof AppError))console.error('Request failure:',error.code||error.message);}
  });
  return {server,db,bootstrapToken:auth.bootstrapToken,payments,close:async()=>{await payments.close();return new Promise(resolve=>{server.close(()=>{db.close();resolve();});server.closeIdleConnections();});}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createApp();if(app.bootstrapToken)console.log('AP_OWNER_SETUP_TOKEN='+app.bootstrapToken);app.server.listen(Number(process.env.PORT||4317),process.env.HOST||'127.0.0.1',()=>console.log(`Maré Particular: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||4317}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
