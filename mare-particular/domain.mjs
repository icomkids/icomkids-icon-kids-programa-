export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const defaults = {
  name: 'Maré Particular', title: 'Um tempo só seu, em Ubatuba.',
  description: 'Abra as janelas, desacelere e encontre seu ritmo no litoral norte. Um apartamento inteiro para viver Ubatuba do seu jeito.',
  location: 'Ubatuba, São Paulo', guests: 4, bedrooms: 2, beds: 3, bathrooms: 2,
  weekday: 38000, weekend: 46000, cleaning: 15000, minNights: 2, maxNights: 30,
  checkinTime: '15:00', checkoutTime: '11:00', pets: false,
  amenities: ['Wi-Fi', 'Cozinha equipada', 'Ar-condicionado', 'Vaga de garagem', 'Varanda', 'Roupa de cama'],
  cancellation: 'Condições demonstrativas: solicite o cancelamento à proprietária. Nenhum pagamento é realizado nesta versão.',
  rules: 'Não é permitido fumar ou realizar festas. Respeite o horário de silêncio do condomínio.',
  verified: false
};
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError('Informe datas válidas.');
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== value) throw new AppError('Informe datas válidas.');
  return d;
}
export function daysBetween(start, end) {
  const a = date(start), b = date(end), count = Math.round((b-a)/86400000);
  if (count < 1 || count > 365) throw new AppError('A saída precisa ser depois da entrada, em até 365 dias.');
  return Array.from({length:count}, (_,i)=>new Date(a.getTime()+i*86400000).toISOString().slice(0,10));
}
export function quote(input, config, busy = []) {
  const nights = daysBetween(input.checkin,input.checkout);
  const guests = Number(input.guests);
  if (input.checkin < today()) throw new AppError('Escolha uma data de entrada a partir de hoje.');
  if (!Number.isInteger(guests) || guests<1 || guests>config.guests) throw new AppError(`O apartamento recebe até ${config.guests} hóspedes.`);
  if (nights.length<config.minNights || nights.length>config.maxNights) throw new AppError(`Escolha de ${config.minNights} a ${config.maxNights} noites.`);
  if (busy.some(d=>nights.includes(d))) throw new AppError('Essas datas já estão ocupadas. Escolha outro período.',409);
  const items=nights.map(day=>({day,amount:[5,6].includes(date(day).getUTCDay())?config.weekend:config.weekday}));
  const subtotal=items.reduce((sum,n)=>sum+n.amount,0);
  return {checkin:input.checkin,checkout:input.checkout,guests,nights:nights.length,items,subtotal,cleaning:config.cleaning,total:subtotal+config.cleaning};
}
export function guestDetails(input) {
  const name=String(input.name||'').trim(), email=String(input.email||'').trim().toLowerCase(), phone=String(input.phone||'').trim(), note=String(input.note||'').trim();
  if(name.length<3||name.length>120) throw new AppError('Informe o nome do responsável (3 a 120 caracteres).');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200) throw new AppError('Informe um e-mail válido.');
  if(phone.replace(/\D/g,'').length<10||phone.length>30) throw new AppError('Informe um telefone com DDD.');
  if(note.length>1000) throw new AppError('A mensagem deve ter até 1.000 caracteres.');
  if(input.accepted!==true) throw new AppError('Aceite as regras e condições para continuar.');
  return {name,email,phone,note};
}
export function settings(input, previous) {
  const next={...previous};
  for(const field of ['weekday','weekend','cleaning','guests','bedrooms','beds','bathrooms','minNights','maxNights']) {
    const value=Number(input[field]);
    if(!Number.isSafeInteger(value)||value<(['cleaning','bedrooms','bathrooms'].includes(field)?0:1)||value>(['weekday','weekend','cleaning'].includes(field)?100000000:365)) throw new AppError(`Valor inválido para ${field}.`);
    next[field]=value;
  }
  if(next.minNights>next.maxNights) throw new AppError('A estadia mínima deve ser menor ou igual à máxima.');
  for(const field of ['name','title','description','rules','cancellation']) {
    if(typeof input[field]!=='string'||!input[field].trim()||input[field].length>3000) throw new AppError('Preencha os textos do apartamento.');
    next[field]=input[field].trim();
  }
  for(const field of ['checkinTime','checkoutTime']) {
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input[field]||'')) throw new AppError('Informe horários válidos.');
    next[field]=input[field];
  }
  next.pets=Boolean(input.pets);
  return next;
}
