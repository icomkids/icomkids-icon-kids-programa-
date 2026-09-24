// Display a usable error even when the authentication SDK cannot be downloaded.
import { incomingAuthLink } from './auth-link.js';
const mode = document.body.classList.contains('admin-page') ? 'admin' : 'members';
const form = document.querySelector(mode === 'admin' ? '#admin-login' : '#member-access');
const message = document.querySelector(mode === 'admin' ? '#admin-message' : '#member-message');
document.documentElement.dataset.authLinkType = incomingAuthLink.type || '';
const report = () => {
  message.hidden = false; message.dataset.kind = 'error';
  message.textContent = 'Não foi possível carregar o acesso. Verifique sua conexão e recarregue esta página.';
};
const timer = setTimeout(report, 12000);
import(mode === 'admin' ? './admin.js?v=13' : './members.js?v=11')
  .then(() => { clearTimeout(timer); })
  .catch(() => { clearTimeout(timer); report(); form.querySelector('[type="submit"]').disabled = true; });
