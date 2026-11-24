// Run once after deployment. The setup capability comes from the private service log.
// Neither the setup token nor the generated password is printed or committed.
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const [tokenFile,accessFile]=process.argv.slice(2);
if(!tokenFile||!accessFile)throw new Error('Informe os caminhos locais do token inicial e do arquivo de acesso.');
const base='https://icom-mare-particular.pqaykh.easypanel.host';
const token=(await readFile(tokenFile,'utf8')).trim(),username='proprietaria',password=randomBytes(24).toString('base64url');
await mkdir(dirname(resolve(accessFile)),{recursive:true});
function contents(confirmed){return `AP HOUSE SELECT — ACESSO DA PROPRIETÁRIA\n\n${confirmed?'ACESSO CRIADO E VERIFICADO':'CRIAÇÃO AINDA NÃO CONFIRMADA'}\n\nEndereço: ${base}/administrador\nUsuário: ${username}\nSenha inicial: ${password}\n\nNo primeiro acesso, será obrigatório definir uma senha pessoal de pelo menos 12 caracteres.\nO acesso é exclusivo da proprietária. Guarde este arquivo em local privado.\nPix e cartão só serão liberados após conectar e validar a conta de recebimento.\n`;}
await writeFile(accessFile,contents(false),{encoding:'utf8',mode:0o600,flag:'wx'});
const created=await fetch(base+'/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(15000)});
if(created.status!==201)throw new Error('A criação do acesso não foi confirmada. HTTP '+created.status+'. O arquivo local está identificado como pendente.');
const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(15000)});
const result=await login.json();if(!login.ok||result.mustChange!==true)throw new Error('Acesso criado, mas a verificação de login requer conferência.');
const cookie=login.headers.get('set-cookie')?.split(';')[0];
await fetch(base+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{}',signal:AbortSignal.timeout(15000)});
await writeFile(accessFile,contents(true),{encoding:'utf8',mode:0o600});
await unlink(tokenFile);
console.log(JSON.stringify({created:true,loginVerified:true,mustChange:true,credentialFile:resolve(accessFile)}));
