import {naturalFold} from './natural-money.ts';
export function conversationPeriod(source:string,today:string){
 const s=naturalFold(source),d=new Date(today+'T12:00:00Z'),shift=(n:number)=>{const t=new Date(d);t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
 if(/\b(?:mes passado|mes anterior)\b/.test(s))return {period:'mes_anterior'};
 if(/\b(?:este mes|nesse mes|neste mes|mes atual)\b/.test(s))return {period:'mes_atual'};
 if(/\b(?:semana passada|semana anterior|essa semana|esta semana|nesta semana|semana que vem|proxima semana)\b/.test(s)){const base=-((d.getUTCDay()+6)%7),delta=/passada|anterior/.test(s)?-7:/vem|proxima/.test(s)?7:0;return {period:'personalizado',from:shift(base+delta),to:shift(base+delta+6)};}
 if(/\b(?:proximos|proximas) (?:30|trinta) dias\b/.test(s))return {period:'personalizado',from:today,to:shift(30)};
 if(/\b(?:este ano|nesse ano|neste ano|ano atual)\b/.test(s))return {period:'personalizado',from:today.slice(0,4)+'-01-01',to:today.slice(0,4)+'-12-31'};
 if(/\b(?:ano passado|ano anterior)\b/.test(s)){const y=Number(today.slice(0,4))-1;return {period:'personalizado',from:y+'-01-01',to:y+'-12-31'};}
 if(/\banteontem\b/.test(s))return {period:'personalizado',from:shift(-2),to:shift(-2)};
 if(/\bontem\b/.test(s))return {period:'personalizado',from:shift(-1),to:shift(-1)};
 if(/\bamanha\b/.test(s))return {period:'personalizado',from:shift(1),to:shift(1)};
 if(/\bhoje\b/.test(s))return {period:'personalizado',from:today,to:today};
 return null;
}
