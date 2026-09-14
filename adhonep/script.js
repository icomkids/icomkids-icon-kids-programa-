const dialog = document.querySelector('#form-dialog');
const title = document.querySelector('#dialog-title');
const videoDialog = document.querySelector('#video-dialog');

const titles = {
  lead: 'Quero conhecer a ADHONEP',
  event: 'Quero participar do próximo encontro',
  partner: 'Quero divulgar minha empresa',
};

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', () => {
    title.textContent = titles[button.dataset.open];
    dialog.showModal();
  });
});

dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelector('[data-video]').addEventListener('click', () => videoDialog.showModal());
videoDialog.querySelector('.close').addEventListener('click', () => videoDialog.close());
videoDialog.addEventListener('click', (event) => {
  if (event.target === videoDialog) videoDialog.close();
});

document.querySelectorAll('.filters button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.filters .active')?.classList.remove('active');
    button.classList.add('active');
  });
});
