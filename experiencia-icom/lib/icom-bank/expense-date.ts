import {realDate} from './contracts.ts';
import {expenseFold} from './personal-expenses.ts';

// Calendar dates come from literal user words, never from an inferred model year.
export function expenseDate(transcript:string,excerpt:string|null|undefined,today:string){
 if(!excerpt){if(/\b(?:ontem|anteontem|\d{1,2}[/-]\d{1,2}|\d{1,2} de (?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))\b/i.test(transcript))throw new Error('Confirme a data do pagamento, por exemplo 07/10/2026.');return today;}
 if(typeof excerpt!=='string'||excerpt.length>80||!expenseFold(transcript).includes(expenseFold(excerpt)))throw new Error('Confirme a data do pagamento.');
 const word=expenseFold(excerpt);let date='';
 if(['hoje','agora'].includes(word))return today;
 if(['ontem','anteontem'].includes(word)){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(word==='ontem'?1:2));return d.toISOString().slice(0,10);}
 const iso=word.match(/^\d{4}-\d{2}-\d{2}$/),br=word.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/),written=word.match(/^(?:dia )?(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de (\d{4}))?$/);
 if(iso)date=word;
 else if(br)date=`${br[3]||today.slice(0,4)}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
 else if(written){const month=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].indexOf(written[2])+1;date=`${written[3]||today.slice(0,4)}-${String(month).padStart(2,'0')}-${written[1].padStart(2,'0')}`;}
 if(!date||!realDate(date)||date<'2000-01-01'||date>today)throw new Error('Confira a data: informe um pagamento já realizado, com dia, mês e ano.');
 return date;
}
