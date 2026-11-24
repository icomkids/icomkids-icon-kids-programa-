import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError } from './domain.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const normalize=value=>String(value||'').trim().toLowerCase();
function passwordHash(password,salt){return scryptSync(password,salt,64).toString('hex');}
function validatePassword(value){if(typeof value!=='string'||value.length<12||value.length>128)throw new AppError('Use uma senha de 12 a 128 caracteres.');return value;}
export function createAuth(db,initial={}) {
  db.exec(`CREATE TABLE IF NOT EXISTS owner_account(id INTEGER PRIMARY KEY CHECK(id=1),username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,must_change INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS owner_sessions(token_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS owner_setup(id INTEGER PRIMARY KEY CHECK(id=1),token_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);`);
  const get=()=>db.prepare('SELECT * FROM owner_account WHERE id=1').get();
  function provision(username,password,mustChange=true){
    if(get())throw new AppError('O acesso da proprietária já foi configurado.',409);
    username=normalize(username);if(!/^[a-z0-9._-]{3,80}$/.test(username))throw new AppError('Use um usuário com 3 a 80 letras, números, ponto ou traço.');
    validatePassword(password);const salt=token();
    db.prepare('INSERT INTO owner_account VALUES(1,?,?,?,?,?)').run(username,salt,passwordHash(password,salt),mustChange?1:0,new Date().toISOString());
    db.prepare('DELETE FROM owner_setup').run();
  }
  if(!get()&&initial.password)provision(initial.username||'proprietaria',initial.password,initial.mustChange??false);
  let bootstrapToken=null;
  if(!get()){
    bootstrapToken=token();db.prepare('INSERT OR REPLACE INTO owner_setup VALUES(1,?,?)').run(digest(bootstrapToken),Date.now()+1800000);
  }
  const dummySalt=token(),dummyHash=passwordHash(token(),dummySalt);
  function verify(username,password){const account=get(),supplied=passwordHash(String(password||'').slice(0,128),account?.salt||dummySalt);return Boolean(account&&normalize(username)===account.username&&typeof password==='string'&&password.length<=128&&timingSafeEqual(Buffer.from(supplied,'hex'),Buffer.from(account?.password_hash||dummyHash,'hex')));}
  function issue(){const value=token();db.prepare('DELETE FROM owner_sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO owner_sessions VALUES(?,?)').run(digest(value),Date.now()+28800000);return value;}
  function readToken(req){return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ap_owner='))?.slice(9)||'';}
  function session(req){const value=readToken(req);if(!/^[A-Za-z0-9_-]{43}$/.test(value))return null;const session=db.prepare('SELECT expires_at FROM owner_sessions WHERE token_hash=?').get(digest(value));return session&&session.expires_at>Date.now()?get():null;}
  function owner(req,allowChange=false){const account=session(req);if(!account)throw new AppError('Entre com o usuário e a senha da proprietária.',401);if(account.must_change&&!allowChange){const e=new AppError('Defina sua senha pessoal para acessar o painel.',403);e.code='PASSWORD_CHANGE_REQUIRED';throw e;}return account;}
  function login(input){if(!get())throw new AppError('O acesso da proprietária está sendo configurado.',503);if(!verify(input.username,input.password))throw new AppError('Usuário ou senha incorretos.',401);return {token:issue(),mustChange:Boolean(get().must_change)};}
  function setup(input,bearer){const setup=db.prepare('SELECT * FROM owner_setup WHERE id=1').get();if(get())throw new AppError('Acesso já configurado.',409);if(!setup||setup.expires_at<Date.now()||!bearer||!timingSafeEqual(Buffer.from(digest(bearer),'hex'),Buffer.from(setup.token_hash,'hex')))throw new AppError('Configuração inicial não autorizada.',401);provision(input.username,input.password,true);}
  function change(req,input){const account=owner(req,true);if(!verify(account.username,input.currentPassword))throw new AppError('A senha atual está incorreta.',401);validatePassword(input.newPassword);if(input.currentPassword===input.newPassword)throw new AppError('Escolha uma senha diferente da senha inicial.');const salt=token();db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE owner_account SET salt=?,password_hash=?,must_change=0 WHERE id=1').run(salt,passwordHash(input.newPassword,salt));db.prepare('DELETE FROM owner_sessions').run();db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return issue();}
  function logout(req){const value=readToken(req);if(value)db.prepare('DELETE FROM owner_sessions WHERE token_hash=?').run(digest(value));}
  return {bootstrapToken,session,owner,login,setup,change,logout,configured:()=>Boolean(get())};
}
