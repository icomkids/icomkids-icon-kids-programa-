import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './domain.mjs';
export function createGuestAccess(db){
  db.exec('CREATE TABLE IF NOT EXISTS application_private(name TEXT PRIMARY KEY,value TEXT NOT NULL)');
  db.prepare('INSERT OR IGNORE INTO application_private VALUES(?,?)').run('guest_signing_key',randomBytes(32).toString('hex'));
  const key=db.prepare('SELECT value FROM application_private WHERE name=?').get('guest_signing_key').value;
  const sign=r=>createHmac('sha256',key).update(r.id+'|'+r.request_key).digest('base64url');
  return {token:r=>r.id+'.'+sign(r),read:value=>{
    if(typeof value!=='string'||!/^([a-f0-9-]{36})\.([A-Za-z0-9_-]{43})$/.test(value))throw new AppError('Acesso à reserva inválido.',401);
    const [id,signature]=value.split('.'),r=db.prepare('SELECT * FROM reservations WHERE id=?').get(id);
    if(!r||!timingSafeEqual(Buffer.from(sign(r)),Buffer.from(signature)))throw new AppError('Acesso à reserva inválido.',401);
    return r;
  }};
}
