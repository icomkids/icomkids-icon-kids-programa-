// Local-only visual fixture. No credentials, API calls or authentication bypass in production.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('../adhonep/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const card = `<article class="member-business-card"><div class="member-business-logo"><img src="assets/empresarios/polar-ar-condicionado/logo-polar-ar-condicionado.png" alt="Logo de exemplo para teste de layout"></div><small>Climatização e ar-condicionado • Taubaté</small><h3>Empresa de demonstração</h3><p>Exemplo local de apresentação de produtos e serviços para conferir o tamanho dos textos e das imagens.</p><div><a href="empresas.html">Conhecer e indicar →</a></div></article>`;
const script = `
import { showMemberView } from './member-navigation.js?v=1';
document.querySelector('#member-title').textContent = 'Olá, wandercarvalho31.';
document.querySelector('.member-avatar b').textContent = 'Membro de demonstração';
document.querySelector('.member-avatar > span').textContent = 'MD';
document.querySelector('#member-role-label').textContent = 'Prévia local • sem dados reais';
const role = new URL(location.href).searchParams.get('role') || 'super_admin';
document.querySelectorAll('button.business-only').forEach(button => button.hidden = role === 'member');
document.querySelector('#member-admin-link').hidden = role !== 'super_admin';
document.querySelector('#member-referral-link').textContent = 'https://example.test/empresas.html?ref=demonstracao';
document.querySelector('#business-list').innerHTML = ${JSON.stringify(card.repeat(3))};
document.querySelector('#member-referrals-list').innerHTML = '<div class="member-empty"><span>◇</span><b>Nenhuma indicação registrada</b><p>Encontre uma empresa e compartilhe seu link para começar.</p></div>';
document.querySelector('#affiliate-offers').innerHTML = '<article class="affiliate-card"><small>Empresa de demonstração</small><h3>Exemplo de oferta</h3><p>Conteúdo ilustrativo para conferir a organização do cartão. Não é uma oferta publicada.</p><strong>Comissão de demonstração</strong><button type="button" disabled>Somente prévia</button></article>';
document.querySelector('#affiliate-memberships').innerHTML = '<div class="member-empty"><b>Você ainda não se afiliou</b><p>As condições e os links de cada afiliação aparecem aqui.</p></div>';
document.querySelector('#member-company-list').innerHTML = '<div class="member-empty"><b>Perfil empresarial de demonstração</b><p>Esta prévia não altera cadastros reais.</p></div>';
document.querySelector('#member-contacts-list').innerHTML = '<div class="member-empty"><b>Nenhum contato recebido</b><p>Os contatos aparecem aqui quando uma pessoa procura sua empresa.</p></div>';
document.querySelector('#member-feedback-list').innerHTML = '<div class="member-empty"><b>Você ainda não avaliou</b><p>Suas avaliações aparecem nesta área.</p></div>';
document.querySelectorAll('#feedback-business, #offer-business').forEach(select => select.innerHTML = '<option>Empresa de demonstração</option>');
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
document.querySelector('#member-exit').addEventListener('click', () => { document.querySelector('#member-dashboard').hidden = true; document.querySelector('#member-login').hidden = false; document.querySelector('.members-top').hidden = false; });
document.querySelector('#member-refresh').addEventListener('click', () => { const status = document.querySelector('#member-status'); status.hidden = false; status.textContent = 'Prévia local: nenhum dado real foi consultado ou alterado.'; });
showMemberView('overview');
`;
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/__member-preview') {
      let html = await readFile(resolve(root, 'membros.html'), 'utf8');
      html = html.replace(/<script type="module" src="portal-entry[^>]+><\/script>/, '')
        .replace('<header class="members-top">', '<header class="members-top" hidden>')
        .replace('id="member-login">', 'id="member-login" hidden>')
        .replace('data-view="overview" hidden>', 'data-view="overview">')
        .replace('</body>', `<script type="module">${script}</script></body>`);
      res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' }); res.end(html); return;
    }
    const file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error('Outside fixture root');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(8766, '127.0.0.1', () => console.log('Local member fixture: http://127.0.0.1:8766/__member-preview'));
