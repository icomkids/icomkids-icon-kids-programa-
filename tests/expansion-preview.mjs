// Isolated visual/interaction fixture. No requests to Supabase, no emails.
// This server and its synthetic client are never copied into adhonep/.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../adhonep/', import.meta.url));
const client = `
const user={id:'fixture-user',email:'teste@example.invalid',email_confirmed_at:'2026-09-28T12:00:00Z'};
const record={id:'fixture-contact',user_id:user.id,name:'Membro de demonstração',company:'Empresa de demonstração',job_title:'Diretor',email:user.email,city:'Taubaté',whatsapp:'(12) 99999-1234',whatsapp_normalized:'12999991234',instagram:'demonstracao',business_sector:'Tecnologia',average_ticket:'501_2000',main_product_service:'Serviços de tecnologia — dados fictícios para QA.',networking_goals:['Fazer parcerias'],desired_connections:['Parceiros'],marketing_opt_in:false,business_description:'Somente teste visual. Não é um cadastro real.',status:'new',origin:'ADHONEP Expansão Taubaté',created_at:'2026-09-28T12:00:00Z',updated_at:'2026-09-28T12:00:00Z'};
let session=new URLSearchParams(location.search).has('anonymous')?null:{user};
function query(table){let single=false;let changed=null;const q=new Proxy({}, {get(_,key){if(key==='then')return(resolve)=>{let rows=table==='adh_profiles'?[{id:user.id,full_name:'Admin de demonstração',role:'super_admin'}]:table==='adh_leads'?[record]:table==='adh_chapters'?[{id:'fixture-chapter',name:'Capítulo de teste',city:'Taubaté'}]:[];if(table==='adh_leads'&&location.pathname.includes('expansao'))rows=[];if(changed)Object.assign(record,changed);resolve({data:single?rows[0]||null:rows,error:null});};return(value)=>{if(['single','maybeSingle'].includes(key))single=true;if(key==='update')changed=value;return q;};}});return q;}
export const supabase={from:query,auth:{getSession:async()=>({data:{session}}),signOut:async()=>{session=null;return{};},signInWithPassword:async()=>({data:{user}}),signInWithOtp:async()=>({error:null}),resetPasswordForEmail:async()=>({error:null})},functions:{invoke:async()=>{await new Promise(resolve=>setTimeout(resolve,350));return new URLSearchParams(location.search).has('failure')?{data:{error:'Falha simulada: tente novamente sem perder os dados.'}}:{data:{ok:true,id:'fixture-contact'}};}}};
export function showMessage(element,message,kind='info'){element.textContent=message;element.dataset.kind=kind;element.hidden=!message;}
`;
http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://127.0.0.1').pathname;
    if (path === '/supabase-client.js') { res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' }); res.end(client); return; }
    const file = resolve(root, '.' + (path === '/expansao' ? '/expansao.html' : path));
    if (!file.startsWith(resolve(root) + sep)) throw Error('Outside fixture root');
    let content = await readFile(file);
    if (extname(file) === '.html') content = Buffer.from(content.toString().replace('<body', '<body data-fixture="synthetic"').replace('</body>', '<aside style="position:fixed;bottom:0;left:0;background:#fff1c9;color:#533b12;padding:6px 12px;z-index:10000;font:12px Arial">PRÉVIA DE TESTE · DADOS FICTÍCIOS · NENHUM E-MAIL ENVIADO</aside></body>'));
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Local-QA': 'synthetic' }); res.end(content);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8770, '127.0.0.1', () => console.log('Synthetic expansion QA: http://127.0.0.1:8770/expansao.html'));
