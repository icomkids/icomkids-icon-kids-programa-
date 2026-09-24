// Loopback-only visual fixture. Never copied into adhonep/ or the production image.
// All auth/data are synthetic; no real account, email or database request is used.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../adhonep/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const mock = `
let user = null;
const chapter = {id:'qa-chapter',name:'Capítulo ADHONEP Taubaté',city:'Taubaté',state:'SP',leader_name:'Líder de teste',active:true};
const profile = () => ({id:'qa-user',full_name:'Administrador de teste',role:user?.email.startsWith('member')?'member':user?.email.startsWith('leader')?'chapter_admin':'super_admin',referral_code:'QA',points:0});
const row = {id:'qa-company',name:'Empresa demonstrativa',slug:'empresa-demo',segment:'Serviços',short_description:'Dados fictícios para verificar o layout em telas pequenas.',status:'active',featured:true,adh_chapters:{city:'Taubaté'},logo_url:'assets/logo-adhonep-fundo-branco.png'};
function query(table) {
  let one = false;
  const q = new Proxy({}, { get(_,key) {
    if (key === 'then') return (resolve) => {
      if(user?.email.startsWith('permission') && table === 'adh_profiles') return resolve({error:{message:'permission denied for schema adh_private'}});
      if(table.includes('affiliat')) return resolve({error:{message:'Módulo de teste indisponível'}});
      const data = table==='adh_profiles' ? [profile()] : table==='adh_chapters' ? [chapter] : table==='adh_chapter_admins' ? [{chapter_id:chapter.id}] : table==='adh_businesses' ? [row] : [];
      resolve({data:one?data[0]:data,error:null});
    };
    return () => { if (['insert','update','delete','upsert'].includes(key)) throw new Error('Escrita desativada na prévia de teste'); if(['single','maybeSingle'].includes(key)) one=true; return q; };
  }}); return q;
}
export const supabase = {from:query,auth:{
  getSession:async()=>({data:{session:user?{user}:null}}),
  signInWithPassword:async({email,password})=>{if(password!=='test-only')return{error:{message:'Invalid login credentials'}};user={id:'qa-user',email};return{data:{user}}},
  signOut:async()=>{user=null;return{}},resetPasswordForEmail:async()=>({error:{message:'Envio de e-mail desativado nesta prévia'}})
}};
export function showMessage(el,text,kind='info'){el.textContent=text;el.hidden=!text;el.dataset.kind=kind}
`;
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/supabase-client.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); return res.end(mock); }
    let path = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    if (['admin', 'membros'].includes(path)) path += '.html';
    const file = resolve(root, path); if (!file.startsWith(resolve(root) + sep)) throw new Error('Invalid path');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Local-QA': 'synthetic' }); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8767, '127.0.0.1', () => console.log('Synthetic QA only: http://127.0.0.1:8767/admin'));
