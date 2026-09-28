// Shared by the browser and the Edge Function. No browser or database dependencies.
export const SECTORS = ['Agronegócio', 'Alimentação', 'Arquitetura', 'Automotivo', 'Beleza e Estética', 'Comércio', 'Comunicação', 'Construção Civil', 'Consultoria', 'Contabilidade', 'Educação', 'Engenharia', 'Eventos', 'Finanças', 'Imobiliário', 'Indústria', 'Jurídico', 'Logística', 'Marketing', 'Moda', 'Saúde', 'Seguros', 'Serviços', 'Tecnologia', 'Turismo', 'Varejo', 'Outro'];
export const TICKETS = { up_to_100: 'Até R$ 100', '101_500': 'R$ 101 a R$ 500', '501_2000': 'R$ 501 a R$ 2.000', '2001_10000': 'R$ 2.001 a R$ 10.000', over_10000: 'Acima de R$ 10.000' };
export const GOALS = ['Fazer parcerias', 'Gerar mais vendas', 'Encontrar fornecedores', 'Aprender com outros empresários', 'Expandir minha rede de contatos'];
export const CONNECTIONS = ['Clientes', 'Parceiros', 'Fornecedores', 'Investidores', 'Mentores / conselheiros'];
export const STATUSES = { new: 'Novo', contacted: 'Em contato', qualified: 'Qualificado', closed: 'Concluído' };
const DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export function normalizePhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  return digits;
}
export function formatPhone(value) {
  const digits = normalizePhone(value).slice(0, 11);
  if (digits.length < 3) return digits ? `(${digits}` : '';
  const rest = digits.slice(2); const split = rest.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? '-' + rest.slice(split) : ''}`;
}
export function normalizeInstagram(value) {
  return String(value ?? '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/$/, '').toLowerCase();
}
export function validateExpansion(input) {
  const errors = {}; const data = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { data, errors: { form: 'Confira os dados do cadastro.' } };
  for (const [key, max, min] of [['full_name', 120, 3], ['company_name', 160, 2], ['job_title', 100, 2], ['city', 100, 2], ['main_product_service', 500, 3], ['business_description', 1500, 0], ['email', 254, 3]]) {
    data[key] = typeof input[key] === 'string' ? input[key].trim() : '';
    if (data[key].length < min || data[key].length > max) errors[key] = `Preencha entre ${min} e ${max} caracteres.`;
  }
  data.email = data.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Informe um e-mail válido para confirmar seu acesso.';
  data.business_sector = input.business_sector;
  if (!SECTORS.includes(data.business_sector)) errors.business_sector = 'Selecione o ramo de atuação.';
  data.business_sector_other = data.business_sector === 'Outro' && typeof input.business_sector_other === 'string' ? input.business_sector_other.trim() : '';
  if (data.business_sector === 'Outro' && (data.business_sector_other.length < 2 || data.business_sector_other.length > 100)) errors.business_sector_other = 'Informe o ramo com 2 a 100 caracteres.';
  data.whatsapp_normalized = normalizePhone(input.whatsapp);
  if (!DDDS.has(data.whatsapp_normalized.slice(0, 2)) || !/^[1-9]{2}(?:9\d{8}|[2-5]\d{7})$/.test(data.whatsapp_normalized)) errors.whatsapp = 'Informe um telefone brasileiro válido, com DDD.';
  data.whatsapp = formatPhone(data.whatsapp_normalized);
  data.instagram = normalizeInstagram(input.instagram);
  if (data.instagram && !/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(data.instagram)) errors.instagram = 'Informe apenas o @usuário ou o link do perfil do Instagram.';
  data.average_ticket = input.average_ticket;
  if (!Object.hasOwn(TICKETS, data.average_ticket || '')) errors.average_ticket = 'Selecione a faixa de ticket médio.';
  for (const [key, allowed] of [['networking_goals', GOALS], ['desired_connections', CONNECTIONS]]) {
    data[key] = Array.isArray(input[key]) ? [...new Set(input[key])] : [];
    if (!data[key].length || data[key].some(value => !allowed.includes(value))) errors[key] = 'Selecione pelo menos uma opção válida.';
  }
  data.marketing_opt_in = input.marketing_opt_in;
  if (typeof data.marketing_opt_in !== 'boolean') errors.marketing_opt_in = 'Escolha Sim ou Não.';
  return { data, errors };
}
