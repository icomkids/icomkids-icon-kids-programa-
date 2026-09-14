const login = document.querySelector('#member-login');
const dashboard = document.querySelector('#member-dashboard');

document.querySelector('#member-access').addEventListener('submit', (event) => {
  event.preventDefault();
  const isBusiness = document.querySelector('#member-role').value === 'business';
  document.querySelectorAll('.business-only').forEach((item) => { item.hidden = !isBusiness; });
  document.querySelector('#member-label').textContent = isBusiness ? 'PAINEL DO EMPRESÁRIO • PERFIL ATIVO' : 'PAINEL DO MEMBRO INDICADOR';
  document.querySelector('#member-title').textContent = isBusiness ? 'Olá, empresário.' : 'Olá, André.';
  document.querySelector('#member-copy').textContent = isBusiness
    ? 'Acompanhe contatos, acessos ao seu perfil e a qualidade percebida do seu negócio.'
    : 'Acompanhe as pessoas e oportunidades que chegaram através das suas indicações.';
  login.hidden = true;
  dashboard.hidden = false;
});

document.querySelector('#member-exit').addEventListener('click', () => {
  dashboard.hidden = true;
  login.hidden = false;
});

document.querySelector('[data-copy]').addEventListener('click', (event) => {
  event.currentTarget.textContent = 'Link copiado ✓';
});
