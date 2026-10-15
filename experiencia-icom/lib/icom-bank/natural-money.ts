// Exact cent values from Brazilian numeric or spoken amounts. No model-supplied arithmetic.
const units:Record<string,number>={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,duzentas:200,trezentos:300,trezentas:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};
export const naturalFold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
function integer(s:string):number|null{
 if(/^\d+$/.test(s))return Number(s);
 let total=0,group=0,seen=false;for(const word of s.split(/\s+/)){if(word==='e')continue;if(word in units){group+=units[word];seen=true;}else if(word==='mil'){total+=(group||1)*1000;group=0;seen=true;}else if(['milhao','milhoes'].includes(word)){total+=(group||1)*1000000;group=0;seen=true;}else return null;}return seen?total+group:null;
}
export function naturalMoney(text:string):number|null{
 let s=naturalFold(text).replace(/^r\$\s*/,'').replace(/[.!?]$/,'').trim();
 if(/^(?:\d{1,9}|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s)){const [a,b='']=s.replaceAll('.','').split(',');const n=Number(a)*100+Number(b.padEnd(2,'0'));return Number.isSafeInteger(n)&&n<=1000000000?n:null;}
 s=s.replace(/\b(?:reais|real)\b/g,'reais');let cents=0;
 const onlyCents=s.match(/^(.+?)\s+centavos?$/);if(onlyCents&&!/reais/.test(s)){const n=integer(onlyCents[1]);if(n!==null&&n>=0&&n<100)return n;}
 const c=s.match(/^(.+?)\s+reais(?:\s+e)?\s+(.+?)\s+centavos?$/);
 if(c){let a=c[1].replace(/\s+reais$/,'').trim();const b=c[2];if(!a){a='zero';}const n=integer(a),f=integer(b);if(n===null||f===null||f>=100)return null;return n*100+f;}
 const compact=s.match(/^(\d+(?:,\d+)?)\s*(mil|milhao|milhoes)(?:\s+reais)?$/);if(compact){cents=Number(compact[1].replace(',','.'))*(compact[2]==='mil'?1000:1000000)*100;return Number.isSafeInteger(cents)&&cents<=1000000000?cents:null;}
 s=s.replace(/\s+reais$/,'');const n=integer(s);return n!==null&&Number.isSafeInteger(n*100)&&n*100<=1000000000?n*100:null;
}
export function assertMoneyEvidence(value:number,excerpt:string,source:string){
 if(!naturalFold(source).includes(naturalFold(excerpt)))throw Error('Confirme apenas o valor informado.');
 const folded=naturalFold(source),markers=[...folded.matchAll(/,\s*nao[, ]+|quer dizer[,:]?|na verdade[,:]?|corrigindo[,:]?/g)];
 if(markers.length&&folded.lastIndexOf(naturalFold(excerpt))<(markers.at(-1)!.index||0))throw Error('Qual é o valor corrigido?');
 const actual=naturalMoney(excerpt);if(actual===null||actual!==value)throw Error('Qual é o valor correto em reais?');
}
export function writeIntentGuard(source:string){
 const s=naturalFold(source);
 if(/^(?:(?:e |mas )?se |acho que |talvez |sera que )/.test(s)||/\b(?:se eu|se a gente|caso eu|quanto (?:sobra|sobraria)|vou (?:comprar|gastar)|pretendo comprar)\b/.test(s))throw Error('Isso é uma hipótese ou projeção; nenhum lançamento foi criado.');
 if(/\b(?:nao (?:recebi|paguei|comprei|gastei|lance|lanca|anote|registre)|ainda nao (?:recebi|paguei))\b/.test(s))throw Error('Nenhum pagamento ou recebimento foi registrado.');
 if(/^(?:como |onde |ja (?:foi|salvou|lancou|registrou)|o .+ ja pagou|quanto |qual |quais |tem |tenho contas|o que vence)/.test(s))throw Error('Esta mensagem é uma consulta, não um lançamento.');
}
