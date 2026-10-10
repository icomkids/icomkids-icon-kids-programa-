import {bankMenu,canBank,type BankRole} from './model.ts';

export type BankPreferences={assistant_name:string;menu_order:string[];layout_orders:Record<string,string[]>};
export const defaultPreferences:BankPreferences={assistant_name:'IA Bank',menu_order:[],layout_orders:{}};
export function assistantName(value:unknown){
 if(typeof value!=='string')throw new Error('Informe um nome para a IA.');
 const name=value.trim().replace(/ +/g,' ');
 if(!/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,39}$/u.test(name))throw new Error('Use até 40 caracteres: letras, números, espaços, ponto ou hífen.');
 return name;
}
function order(value:unknown,max:number){if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!x||x.length>120)||new Set(value).size!==value.length)throw new Error('Organização inválida.');return value as string[];}
export function preferencesPatch(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Preferências inválidas.');
 const b=value as Record<string,unknown>,keys=Object.keys(b),patch:Partial<BankPreferences>={};
 if(!keys.length||keys.some(k=>!['assistant_name','menu_order','layout_orders'].includes(k)))throw new Error('Preferências inválidas.');
 if('assistant_name' in b)patch.assistant_name=assistantName(b.assistant_name);
 if('menu_order' in b){const v=order(b.menu_order,bankMenu.length);if(v.some(k=>!bankMenu.some(([id])=>id===k)))throw new Error('Menu inválido.');patch.menu_order=v;}
 if('layout_orders' in b){const v=b.layout_orders;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length>100)throw new Error('Organização inválida.');patch.layout_orders={};for(const [k,a] of Object.entries(v)){if(!/^[a-zA-Z0-9/_?=.#:-]{1,180}$/.test(k))throw new Error('Organização inválida.');patch.layout_orders[k]=order(a,60);}}
 return patch;
}
export function reconcileOrder(saved:readonly string[],available:readonly string[]){const set=new Set(available);return [...saved.filter((id,i)=>set.has(id)&&saved.indexOf(id)===i),...available.filter(id=>!saved.includes(id))];}
export function orderedMenu(role:BankRole,saved:readonly string[]=[]){const items=bankMenu.filter(([key])=>canBank(role,key));return reconcileOrder(saved,items.map(([key])=>key)).map(key=>items.find(([id])=>id===key)!);}
export function moveItem(items:readonly string[],from:string,to:string){const a=[...items],start=a.indexOf(from),end=a.indexOf(to);if(start<0||end<0||start===end)return a;a.splice(start,1);a.splice(end,0,from);return a;}
export function mergePreferences(current:BankPreferences,patch:Partial<BankPreferences>):BankPreferences{return {...current,...patch,layout_orders:{...current.layout_orders,...patch.layout_orders}};}
export function readPreferences(value:unknown):BankPreferences{try{const b=value as BankPreferences;return {...defaultPreferences,...preferencesPatch({assistant_name:b.assistant_name,menu_order:b.menu_order,layout_orders:b.layout_orders})};}catch{return {...defaultPreferences};}}
export function addressAssistant(text:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return text.replace(new RegExp('^\\s*(?:(?:oi|olá|ola|ei|hey)\\s*[,!.:]?\\s*)?'+escaped+'(?:\\s*[,!:.]\\s*|\\s+|$)','iu'),'').trim()||text;}
