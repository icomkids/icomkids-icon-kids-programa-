import type {AdminDetails} from './administrative.ts';
import type {StockRow} from './stock.ts';

const fold=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const digits:Record<string,string>={zero:'0',um:'1',uma:'1',dois:'2',duas:'2',tres:'3',quatro:'4',cinco:'5',seis:'6',sete:'7',oito:'8',nove:'9'};
const letters:Record<string,string>={a:'a',be:'b',ce:'c',de:'d',e:'e',efe:'f',ge:'g',aga:'h',i:'i',jota:'j',ca:'k',ele:'l',eme:'m',ene:'n',o:'o',pe:'p',que:'q',erre:'r',esse:'s',te:'t',u:'u',ve:'v',dabliu:'w',xis:'x',ipsilon:'y',ze:'z'};
const valid=(s:string)=>/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(s);
function characters(raw:string){
 let text=fold(raw).trim().replace(/^placa\s*[:=]?\s*/,'');
 // A phonetic example explains the explicitly spoken letter; it never replaces it.
 text=text.replace(/\b([a-z]|be|ce|de|efe|ge|aga|jota|ca|ele|eme|ene|pe|que|erre|esse|te|ve|dabliu|xis|ipsilon|ze)\s+(?:de|como em)\s+[a-z]+\b/g,(_,letter:string)=>letters[letter]||letter);
 text=text.replace(/\b(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa)\s+e\s+(um|dois|tres|quatro|cinco|seis|sete|oito|nove)\b/g,(_,t:string,u:string)=>String(({vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90} as Record<string,number>)[t]+Number(digits[u])));
 return text.split(/[\s,.;:\-–]+/).filter(Boolean).map(t=>digits[t]||letters[t]||t);
}
export function normalizeSpokenPlate(raw:string){
 const plate=characters(raw).join('').toUpperCase();
 if(!valid(plate))throw new Error('Não entendi os sete caracteres da placa. Diga as três letras e os quatro caracteres seguintes, ou repita letra por letra.');
 return plate;
}
export function spokenPlateCandidates(transcript:string){
 const found=new Set<string>();
 for(const m of transcript.matchAll(/\b[A-Za-z]{3}[\s-]?\d[A-Za-z0-9]\d{2}\b/g))found.add(normalizeSpokenPlate(m[0]));
 for(const m of fold(transcript).matchAll(/\bplaca\s*[:=]?\s*/g)){
  let value='';
  for(const token of characters(transcript.slice((m.index||0)+m[0].length,(m.index||0)+m[0].length+160))){
   if(!/^[a-z0-9]+$/.test(token)||token.length>7)break;
   value+=token;if(value.length>=7){if(valid(value.toUpperCase()))found.add(value.toUpperCase());break;}
  }
 }
 return [...found];
}
export function expensePlate(raw:unknown,transcript:string){
 const candidates=spokenPlateCandidates(transcript);
 if(candidates.length>1)throw new Error('Ouvi mais de uma placa. Informe a placa de um único veículo para este custo.');
 if(raw===null||raw===undefined||raw==='')return candidates[0]||'';
 if(typeof raw!=='string')throw new Error('Confira a placa do custo.');
 let plate:string;
 try{plate=normalizeSpokenPlate(raw);}catch(e){if(!candidates[0])throw e;plate=candidates[0];}
 if(candidates[0]&&candidates[0]!==plate)throw new Error('A placa do resumo ficou diferente da ditada. Confira as letras antes de salvar.');
 if(!candidates[0]&&!fold(transcript).includes(fold(raw)))throw new Error('Diga a placa do veículo deste custo.');
 return plate;
}
export function attachExpenseVehicle(details:AdminDetails,stocks:Pick<StockRow,'id'|'plate'|'active'|'status'|'entry_date'>[],date:string){
 const rows=stocks.filter(s=>s.active&&s.plate.toUpperCase()===details.plate&&s.status!=='VENDIDO');
 if(rows.length>1)throw new Error('Há mais de um veículo com esta placa. Confira o cadastro antes de vincular o custo.');
 const row=rows[0];
 if(row){
  if(row.status==='PREVISTO'||date<row.entry_date)throw new Error('O veículo ainda não entrou no estoque nessa data. Confira a data do custo.');
  details.stock_id=row.id;
  details.notes=(details.notes||'')+' · Custo vinculado ao veículo '+details.plate;
 }
 return row?'Custo vinculado ao veículo no estoque':'Custo da loja identificado pela placa; veículo sem estoque disponível para vínculo';
}
