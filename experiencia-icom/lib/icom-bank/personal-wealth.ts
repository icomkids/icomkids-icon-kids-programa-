import {realDate,validId} from './contracts.ts';
import {brazilDay} from './model.ts';

export const wealthKinds={ATIVO:'Patrimônio / investimento',RENDA:'Renda recebida',APORTE:'Dinheiro investido',RESGATE:'Resgate do capital'} as const;
export const wealthCategories=['Imóvel / aluguel','Veículo pessoal','Poupança','Renda fixa / CDB / Tesouro','Fundos de investimento','Ações / dividendos','Empréstimo particular / juros','Salário / serviços','Aposentadoria / pensão','Participação em outros negócios','Royalties / direitos','Outros bens e rendas'] as const;
export type WealthKind=keyof typeof wealthKinds;
export type WealthRecord={id:string;owner_id:string;kind:WealthKind;category:string;name:string;record_date:string;amount_cents:number;debt_cents:number;invested_cents:number;rate_percent:number|null;rate_period:'MENSAL'|'ANUAL';source_id:string|null;notes:string;active:boolean;created_at:string;updated_at:string};
export function wealthInput(body:Record<string,unknown>,today=brazilDay()){
 const str=(key:string,max:number)=>{const v=body[key];if(typeof v!=='string'||v.length>max)throw new Error('Confira os campos do cadastro.');return v.trim();};
 const cents=(key:string)=>{const n=body[key];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0||n>1_000_000_000)throw new Error('Confira os valores em reais.');return n;};
 const id=str('id',36),name=str('name',160),category=str('category',100),kind=str('kind',20) as WealthKind,record_date=str('record_date',10),notes=str('notes',2000);
 const amount_cents=cents('amount_cents'),debt_cents=cents('debt_cents'),invested_cents=cents('invested_cents');
 const source_id=body.source_id===null?null:str('source_id',36),rate_percent=body.rate_percent,rate_period=str('rate_period',10);
 const expected=body.expected_updated_at===null?null:str('expected_updated_at',50);
 if(!validId(id)||name.length<2||!Object.hasOwn(wealthKinds,kind)||!(wealthCategories as readonly string[]).includes(category)||!realDate(record_date)||record_date<'2000-01-01'||record_date>today||source_id&&!validId(source_id)||typeof body.active!=='boolean'||expected!==null&&!Number.isFinite(Date.parse(expected)))throw new Error('Confira nome, tipo, categoria e data até hoje.');
 if(kind!=='ATIVO'&&(amount_cents<=0||debt_cents!==0||invested_cents!==0||rate_percent!==null))throw new Error('Informe o valor recebido ou investido. Juros, dívida e valor investido pertencem ao cadastro do patrimônio.');
 if(kind==='ATIVO'&&source_id!==null||!['MENSAL','ANUAL'].includes(rate_period)||rate_percent!==null&&(typeof rate_percent!=='number'||!Number.isFinite(rate_percent)||rate_percent<0||rate_percent>100||Math.abs(Math.round(rate_percent*10000)-rate_percent*10000)>0.0000001))throw new Error('Confira a taxa de juros, até quatro casas decimais, e a periodicidade.');
 return {id,kind,category,name,record_date,amount_cents,debt_cents,invested_cents,source_id,rate_percent,rate_period,notes,active:body.active,expected_updated_at:expected};
}
export function wealthSummary(rows:WealthRecord[],period:string,today=brazilDay()){
 const active=rows.filter(r=>r.active&&r.record_date<=today),assets=active.filter(r=>r.kind==='ATIVO');
 const sum=(items:WealthRecord[],key:'amount_cents'|'debt_cents'|'invested_cents'='amount_cents')=>items.reduce((n,r)=>n+Number(r[key]),0);
 const flow=active.filter(r=>r.record_date.startsWith(period));
 return {assets:assets.length,gross:sum(assets),debt:sum(assets,'debt_cents'),net:sum(assets)-sum(assets,'debt_cents'),invested:sum(assets,'invested_cents'),income:sum(flow.filter(r=>r.kind==='RENDA')),contributions:sum(flow.filter(r=>r.kind==='APORTE')),redemptions:sum(flow.filter(r=>r.kind==='RESGATE'))};
}
export function monthlyEstimate(asset:WealthRecord){
 if(asset.kind!=='ATIVO'||asset.rate_percent===null)return null;
 // A simple reference for one period, never an automatically realised receipt.
 return Math.round(asset.invested_cents*asset.rate_percent/100/(asset.rate_period==='ANUAL'?12:1));
}
