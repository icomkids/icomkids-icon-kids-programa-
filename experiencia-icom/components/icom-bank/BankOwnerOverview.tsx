'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,ArrowDownRight,UserRound,Wallet,TrendingUp,House,Coins,type LucideIcon} from 'lucide-react';
import {bankPath,brazilDay,currency} from '@/lib/icom-bank/model';
import {ownerSummary} from '@/lib/icom-bank/owner-summary';
import {companyCashPosition,type CashEntry} from '@/lib/icom-bank/cash';
import type {AccountData} from '@/lib/icom-bank/accounts';
import type {WealthRecord} from '@/lib/icom-bank/personal-wealth';
export default function BankOwnerOverview({initial,personal,initialAccounts}:{initial:CashEntry[];personal:WealthRecord[];initialAccounts?:AccountData}){
 const [accounts,setAccounts]=useState(initialAccounts);
 const [rows,setRows]=useState(initial),[wealth,setWealth]=useState(personal),[month,setMonth]=useState(brazilDay().slice(0,7)),[all,setAll]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();const refresh=()=>{void Promise.all([fetch(bankPath('/api/administrative?year='+brazilDay().slice(0,4)),{signal:c.signal,cache:'no-store'}),fetch(bankPath('/api/personal-wealth'),{signal:c.signal,cache:'no-store'})]).then(async([a,b])=>{const x=await a.json() as {rows?:CashEntry[]},y=await b.json() as {rows?:WealthRecord[]};if(!a.ok||!b.ok)throw new Error('Atualize a página para conferir os dados.');const fresh=x.rows;if(Array.isArray(fresh))setRows(old=>[...old.filter(r=>!r.entry_date.startsWith(brazilDay().slice(0,4))),...fresh]);if(Array.isArray(y.rows))setWealth(y.rows);setError('');}).catch(()=>{if(!c.signal.aborted)setError('Não foi possível atualizar os valores. Recarregue a página.');});};window.addEventListener('icom-bank-ledger-changed',refresh);window.addEventListener('icom-bank-wealth-changed',refresh);return()=>{c.abort();window.removeEventListener('icom-bank-ledger-changed',refresh);window.removeEventListener('icom-bank-wealth-changed',refresh);};},[]);
 useEffect(()=>{const c=new AbortController();const refresh=()=>{void fetch(bankPath('/api/accounts'),{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json() as AccountData;if(!r.ok||!Array.isArray(d.accounts))throw new Error();setAccounts(d);}).catch(()=>{if(!c.signal.aborted)setError('Não foi possível atualizar os saldos PF e PJ. Atualize a página.');});};const events=['icom-bank-prolabore-changed','icom-bank-accounts-changed','icom-bank-ledger-changed','icom-bank-wealth-changed'];events.forEach(e=>window.addEventListener(e,refresh));return()=>{c.abort();events.forEach(e=>window.removeEventListener(e,refresh));};},[]);
 const summary=ownerSummary(rows,wealth,accounts?.prolabore||[],accounts?.property_ledger_ids||[],all?'':month),s=summary.original;
 const period=all?'Todo o histórico':new Date(month+'-15T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'});
 const companyCash=companyCashPosition(rows,brazilDay(),accounts?.prolabore||[]);
 type Card={key:string;label:string;value:number;note:string;tone:string;icon:LucideIcon;path:string};
 const cards=(items:Card[])=><div className="ia-priority-grid">{items.map(c=><a key={c.key} data-bank-layout-key={c.key} className={'ia-money-card '+c.tone+(c.value<0?' negative':'')} href={bankPath(c.path)}><div className="ia-card-top"><span className="ia-icon"><c.icon size={24}/></span><ArrowUpRight size={17}/></div><span className="ia-label">{c.label}</span><strong>{currency(c.value)}</strong><small>{c.note}</small></a>)}</div>;
 return <section className="ia-overview" aria-label="Resumo da empresa, pessoal e patrimônio"><div className="bank-heading"><div><p className="bank-eyebrow">IA BANK · SEU DINHEIRO EM PERSPECTIVA</p><h1>Visão geral</h1><p>Empresa, vida pessoal e patrimônio. Cada resultado no seu lugar.</p></div><div className="ia-period"><label>Período<input type="month" min="2000-01" max={brazilDay().slice(0,7)} disabled={all} value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/></label><label className="ia-check"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Acumulado</label></div></div><p className="ia-period-caption"><span className="ia-status-dot"/> {period}</p>{error&&<p className="bank-error" role="alert">{error}</p>}
 <section className="ia-summary-section ia-company-summary" data-bank-layout-key="business-summary" aria-labelledby="ia-business-title"><header><h2 id="ia-business-title">Sua empresa</h2><span>Lucro − gastos = resultado</span></header>{cards([
 {key:'income',label:'Entradas de lucro da empresa',value:s.earnings,note:'Lucro das vendas e outras entradas da loja',tone:'income',icon:ArrowUpRight,path:'/administrativo'},
 {key:'expense',label:'Gastos da empresa',value:s.costs,note:'Sem repetir os custos já descontados nas vendas',tone:'expense',icon:ArrowDownRight,path:'/administrativo'},
 {key:'company',label:'Resultado líquido da empresa',value:s.company,note:'O que ficou após os gastos da empresa',tone:'income',icon:TrendingUp,path:'/administrativo'},
 {key:'company-cash',label:'Caixa da empresa',value:companyCash.available,note:'Acumulado até hoje · capital de terceiros separado',tone:'personal',icon:Wallet,path:'/administrativo/caixa'},
 ])}</section>
 <section className="ia-summary-section" data-bank-layout-key="personal-summary" aria-labelledby="ia-personal-title"><header><h2 id="ia-personal-title">Você e sua família</h2><span>Pró-labore − despesas pessoais = saldo final</span></header>{cards([
 {key:'prolabore',label:'Pró-labore cadastrado',value:summary.prolaboreRegistered,note:'Recebido no período: '+currency(summary.prolaboreReceived),tone:'personal',icon:Wallet,path:'/administrativo/prolabore'},
 {key:'personal',label:'Despesas pessoais',value:summary.personalCosts,note:'Gastos da família; parcelas do patrimônio ficam abaixo',tone:'expense',icon:UserRound,path:'/administrativo#pessoais'},
 {key:'personal-final',label:'Saldo final',value:summary.personalBalance,note:summary.hasPlanned?'Recebido − despesas · previsto após receber: '+currency(summary.personalPlannedBalance):'Pró-labore recebido menos despesas pessoais',tone:'personal',icon:Coins,path:'/administrativo/pessoal'},
 ])}</section>
 <section className="ia-summary-section" data-bank-layout-key="wealth-summary" aria-labelledby="ia-wealth-title"><header><h2 id="ia-wealth-title">Seu patrimônio</h2><a href={bankPath('/administrativo/pessoal?tab=patrimonio')}>Valor líquido dos bens e aplicações: <b>{currency(s.wealth.net)}</b> <ArrowUpRight size={15}/></a></header>{cards([
 {key:'wealth-income',label:'Entradas do patrimônio',value:summary.propertyIncome,note:'Aluguéis e rendimentos efetivamente recebidos',tone:'income',icon:House,path:'/administrativo/pessoal?tab=rendas'},
 {key:'wealth-costs',label:'Custos do patrimônio',value:summary.propertyCosts,note:'Parcelas pagas vinculadas aos imóveis cadastrados',tone:'expense',icon:ArrowDownRight,path:'/administrativo/contas-a-pagar'},
 {key:'wealth-result',label:'Resultado do patrimônio',value:summary.propertyResult,note:'Rendimentos recebidos menos custos pagos',tone:'income',icon:TrendingUp,path:'/administrativo/pessoal?tab=patrimonio'},
 ])}</section>
 {(s.missing>0||s.cash.reviewCount>0||s.unlinked>0)&&<p className="bank-error">Há registros a conferir. <a href={bankPath('/administrativo')}>Conferir no Administrativo</a></p>}
 </section>;
}
