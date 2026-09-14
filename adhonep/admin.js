const access = document.querySelector('#admin-access');
const shell = document.querySelector('#admin-shell');

document.querySelector('#admin-login').addEventListener('submit', (event) => {
  event.preventDefault();
  const chapterMode = document.querySelector('#admin-role').value === 'chapter';
  document.querySelector('#admin-scope').textContent = chapterMode
    ? 'ADMINISTRAÇÃO DO CAPÍTULO • TAUBATÉ'
    : 'ADMINISTRAÇÃO GERAL • TODOS OS CAPÍTULOS';
  document.querySelector('#admin-greeting').textContent = chapterMode
    ? 'Bom dia, líder do capítulo.'
    : 'Bom dia, administrador geral.';
  document.querySelector('#admin-description').textContent = chapterMode
    ? 'Você visualiza somente empresários, atividades e avaliações privadas do seu capítulo.'
    : 'Você pode administrar capítulos, gestores, empresários e conteúdos de toda a rede.';
  document.querySelectorAll('.general-only').forEach((item) => {
    item.hidden = chapterMode;
  });
  access.hidden = true;
  shell.hidden = false;
});

document.querySelector('#admin-exit').addEventListener('click', () => {
  shell.hidden = true;
  access.hidden = false;
});
