'use client';
import {useState} from 'react';
import {bankPath,canBank,type BankRole} from '@/lib/icom-bank/model';

const labels:Record<string,string>={despesas_loja:'Despesas da loja',despesas_pessoais:'Despesas pessoais',lancamentos:'Lançamentos administrativos',administrativo:'Resultado da loja e vida pessoal',caixa:'Saldo livre do caixa',investidores:'Investidores',clientes:'Clientes',contratos:'Contratos',parcelas:'Parcelas',pagamentos:'Pagamentos',comprovantes:'Comprovantes',inadimplencia:'Inadimplência',veiculos:'Veículos',relatorios:'Relatório da carteira',funcionarios:'Funcionários',vendedores:'Vendedores',configuracoes:'Configurações',contas_pagar:'Contas a pagar',contas_receber:'Contas a receber',carteira:'Carteira',quantidade_a_receber:'Parcelas a receber',saldo_a_receber:'Saldo das parcelas a receber',quantidade_parcelas_a_receber:'Parcelas abertas',total_pago:'Total pago',saldo_livre:'Saldo livre',saldo_registrado:'Saldo antes das reservas',lucro_liquido_loja:'Lucro líquido da loja',nao_classificados_no_periodo:'Gastos sem classificação',registros:'Registros',quantidade:'Quantidade',exibidos:'Exibidos nesta página',lista_limitada:'Há registros em outras páginas',por_situacao:'Por situação',pessoa:'Pessoa',area:'Área',situacao:'Situação',cadastro:'Data do cadastro',somente_leitura:'Somente consulta'};
Object.assign(labels,{resultado_empresa:'Resultado da empresa e vida pessoal',patrimonio_pessoal:'Patrimônio e investimentos pessoais',rendas_pessoais:'Outras rendas pessoais recebidas'});
const admin=['resultado_empresa','patrimonio_pessoal','rendas_pessoais','despesas_loja','despesas_pessoais','lancamentos','administrativo','caixa','investidores','contas_pagar','contas_receber'];
export const reportLabel=(key:string)=>labels[key]||key.replaceAll('_',' ').replace(/^./,c=>c.toLocaleUpperCase('pt-BR'));
export type AssistantReportResult={ok?:boolean;error?:string;consulta?:string;periodo?:string;consultado_em?:string;dados?:unknown};
export type AssistantReport={input:Record<string,unknown>;result:AssistantReportResult};
function value(v:unknown):string{if(v===null||v===undefined)return '—';if(typeof v==='boolean')return v?'Sim':'Não';if(typeof v==='object'){const m=v as {valor?:string};return m.valor||'—';}return String(v);}
function ReportData({data,level=0}:{data:unknown;level?:number}){
 if(data===null||data===undefined)return null;
 if(typeof data!=='object'||'valor' in data)return <span>{value(data)}</span>;
 if(Array.isArray(data)){
  const rows=data.filter(v=>v&&typeof v==='object') as Record<string,unknown>[];
  if(!rows.length)return <p>Nenhum registro neste filtro.</p>;
  const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  return <div style={{overflowX:'auto',maxHeight:320}}><table className="bank-table" style={{width:'100%'}}><thead><tr>{keys.map(k=><th key={k}>{reportLabel(k)}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{keys.map(k=><td key={k}>{value(r[k])}</td>)}</tr>)}</tbody></table></div>;
 }
 const entries=Object.entries(data).filter(([k,v])=>v!==undefined&&!['offset','proxima_pagina','exibidos','lista_limitada'].includes(k));
 return <div>{entries.map(([k,v])=>v&&typeof v==='object'&&!('valor' in v)?<details key={k} open={k==='registros'||level<1}><summary style={{fontWeight:600,padding:'10px 0'}}>{reportLabel(k)}</summary><ReportData data={v} level={level+1}/></details>:<p key={k} style={{margin:'8px 0'}}><strong>{reportLabel(k)}: </strong>{value(v)}</p>)}</div>;
}
function pages(data:unknown):{count:number;next:number|null}{
 if(!data||typeof data!=='object')return {count:0,next:null};
 const r=data as Record<string,unknown>;
 if(Array.isArray(r.registros))return {count:Number(r.quantidade||0),next:typeof r.proxima_pagina==='number'?r.proxima_pagina:null};
 const nested=Object.values(r).map(pages);return {count:Math.max(0,...nested.map(p=>p.count)),next:nested.find(p=>p.next!==null)?.next??null};
}
export default function BankAssistantReport({role,report,onReport}:{role:BankRole;report:AssistantReport|null;onReport:(report:AssistantReport)=>void}){
 const topics=Object.keys(labels).filter(k=>['carteira',...admin,'clientes','contratos','parcelas','pagamentos','comprovantes','inadimplencia','veiculos','relatorios','funcionarios','vendedores','configuracoes'].includes(k)&&canBank(role,admin.includes(k)?'administrativo':k==='carteira'?'dashboard':k==='vendedores'?'funcionarios':k));
 const [topic,setTopic]=useState(String(report?.input.topic||topics[0]||'carteira')),[period,setPeriod]=useState(String(report?.input.period||'total')),[situation,setSituation]=useState(String(report?.input.situation||'TODOS')),[search,setSearch]=useState(String(report?.input.search||'')),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(input:Record<string,unknown>){setBusy(true);setError('');try{
  const params=new URLSearchParams();for(const [k,v] of Object.entries(input))if(v!==undefined)params.set(k,String(v));
  const response=await fetch(bankPath('/api/assistant/data')+'?'+params,{cache:'no-store',signal:AbortSignal.timeout(10000)}),result=await response.json() as AssistantReportResult;
  if(!response.ok||!result.ok)throw new Error(result.error||'Não foi possível consultar.');onReport({input,result});
 }catch(e){setError(e instanceof Error?e.message:'Consulta indisponível.');}finally{setBusy(false);}}
 const page=pages(report?.result.dados),offset=Number(report?.input.offset||0),limit=Number(report?.input.limit||20);
 return <section className="bank-voice-guide" aria-label="Relatórios da ICOM IA"><h3>Consultar qualquer área</h3><p>Você pode pedir por voz ou conferir aqui. Totais incluem todo o filtro; listas têm páginas.</p>
  <div style={{display:'grid',gap:10}}><label>Área<select value={topic} onChange={e=>setTopic(e.target.value)} style={{width:'100%'}}>{topics.map(t=><option key={t} value={t}>{reportLabel(t)}</option>)}</select></label><label>Período<select value={period} onChange={e=>setPeriod(e.target.value)}>{period==='personalizado'&&<option value="personalizado">Período solicitado por voz</option>}<option value="total">Todo o histórico</option><option value="mes_atual">Este mês</option><option value="mes_anterior">Mês anterior</option></select></label>
  {['parcelas','contas_pagar','contas_receber'].includes(topic)&&<label>Situação<select value={situation} onChange={e=>setSituation(e.target.value)}><option value="TODOS">Todas</option><option value="PENDENTES">A pagar / receber</option><option value="PAGOS">Pagas / recebidas</option><option value="VENCIDOS">Em atraso</option></select></label>}
  <label>Buscar nome, descrição, contrato ou placa<input value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}/></label><button disabled={busy} onClick={()=>void load({topic,period,search,situation:['parcelas','contas_pagar','contas_receber'].includes(topic)?situation:'TODOS',offset:0,limit:20})}>{busy?'Consultando…':'Consultar dados'}</button></div>
  {error&&<p role="alert">{error}</p>}{report?.result.ok&&<div style={{marginTop:18}}><h3>{reportLabel(report.result.consulta||'relatorios')}</h3><p>{report.result.periodo}</p><small>Atualizado em {report.result.consultado_em?new Date(report.result.consultado_em).toLocaleString('pt-BR'):'—'}. Registros do sistema.</small><ReportData data={report.result.dados}/>{page.count>0&&<div className="bank-voice-controls"><button disabled={busy||offset===0} onClick={()=>void load({...report.input,offset:Math.max(0,offset-limit)})}>Anterior</button><span>Até {Math.min(offset+limit,page.count)} de {page.count} registros</span><button disabled={busy||page.next===null} onClick={()=>void load({...report.input,offset:page.next})}>Próxima</button></div>}</div>}
 </section>;
}
