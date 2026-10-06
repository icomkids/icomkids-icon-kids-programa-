import {validId} from './contracts.ts';
import type {AdminEntry} from './administrative.ts';
export type BankInvestor={id:string;name:string;email:string;phone:string;notes:string;active:boolean;created_at:string;updated_at:string};
export function investorInput(raw:Record<string,unknown>){
 const text=(key:string,max:number)=>{if(raw[key]!==undefined&&raw[key]!==null&&typeof raw[key]!=='string')throw new Error('Confira os dados do investidor.');const v=String(raw[key]||'').trim();if(v.length>max)throw new Error('Confira os dados do investidor.');return v;};
 const id=text('id',36),name=text('name',160).replace(/\s+/g,' '),email=text('email',254),phone=text('phone',30),notes=text('notes',2000),expected=text('expected_updated_at',40);
 if(!validId(id)||name.length<2||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||expected&&Number.isNaN(Date.parse(expected)))throw new Error('Informe nome e contatos válidos.');
 return {id,name,email,phone,notes,expected_updated_at:expected||null};
}
export function investorMatches(investor:BankInvestor,details:AdminEntry['details'],trade=false){
 const id=trade?details.trade_investor_id:details.investor_id;
 const name=trade?details.trade_investor_name:details.investor_name;
 return id?id===investor.id:!!name&&name.trim().toLocaleLowerCase('pt-BR')===investor.name.trim().toLocaleLowerCase('pt-BR');
}
