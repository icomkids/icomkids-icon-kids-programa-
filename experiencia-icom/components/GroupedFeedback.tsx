'use client';
import {useState} from 'react';
import {feedbackSummary} from '@/lib/feedback';
import type {Experience} from '@/lib/experience';

type Entity={id:string;name:string};
const number=(v:number|null)=>v===null?'—':v.toLocaleString('pt-BR',{maximumFractionDigits:1});
const percent=(v:number|null)=>v===null?'—':`${v}%`;
const tabs=['Resumo','Notas por item','Histórico mensal','Feedback'] as const;
export default function GroupedFeedback({kind,entities,rows}:{kind:'seller'|'vehicle';entities:Entity[];rows:Experience[]}) {
  const [tab,setTab]=useState<typeof tabs[number]>('Resumo');
  const key=kind==='seller'?'salesperson_id':'vehicle_id';
  const groups=entities.map(entity=>({...entity,rows:rows.filter(r=>r[key]===entity.id)})).filter(entity=>entity.rows.length).sort((a,b)=>b.rows.length-a.rows.length);
  return <section className="grouped-feedback">
    <div className="panel"><h2>{kind==='seller'?'Desempenho por vendedor':'Avaliações por veículo'}</h2><p>Resultados consolidados no período e nos filtros selecionados.</p><small>Notas de 0 a 10. Satisfação = notas de 8 a 10. NPS de −100 a +100; recomendação média de 0 a 10. Cada item usa apenas as respostas disponíveis.</small><div className="feedback-tabs" role="group" aria-label="Tópicos do desempenho">{tabs.map(name=><button key={name} aria-pressed={tab===name} className={tab===name?'primary':''} onClick={()=>setTab(name)}>{name}</button>)}</div></div>
    {!groups.length&&<div className="panel"><p>Nenhuma experiência neste filtro. Os resultados aparecem após cadastrar experiências e receber avaliações.</p></div>}
    <div className="feedback-groups">{groups.map(entity=>{
      const summary=feedbackSummary(entity.rows),stats=summary.stats;
      const main=summary.items.find(item=>item.key===(kind==='seller'?'salesperson_rating':'vehicle_cleanliness_rating'))!;
      const recommendation=summary.completed.flatMap(r=>r.experience_responses).map(r=>r.nps_score);
      return <article className="panel feedback-card" key={entity.id}>
        <div className="panel-heading"><div><p className="eyebrow">{kind==='seller'?'VENDEDOR':'VEÍCULO'}</p><h3>{entity.name}</h3></div><span className="feedback-score">{number(main.mean)} <small>/ 10 · {kind==='seller'?'atendimento':'limpeza'}</small></span></div>
        <div className="feedback-counts"><span><b>{summary.customers}</b> clientes únicos</span><span><b>{summary.experiences}</b> experiências registradas</span><span><b>{summary.responses}</b> avaliações concluídas</span><span><b>{percent(summary.responseRate)}</b> de resposta</span></div>
        {tab==='Resumo'&&<><div className="feedback-metrics">{summary.items.map(item=><div key={item.key}><span>{item.label}</span><strong>{number(item.mean)} <small>/ 10</small></strong><small>{percent(item.satisfaction)} de satisfação · {item.count} avaliações</small></div>)}</div><div className="feedback-counts"><span>NPS <b>{number(stats.nps)}</b></span><span>Recomendação média <b>{number(recommendation.length?recommendation.reduce((a,b)=>a+b,0)/recommendation.length:null)} / 10</b></span><span>Promotores <b>{percent(summary.responses?Math.round(stats.promoters/summary.responses*100):null)}</b></span><span>Detratores <b>{percent(summary.responses?Math.round(stats.detractors/summary.responses*100):null)}</b></span></div>{kind==='vehicle'&&<p className="muted">As notas do veículo mostram limpeza e entrega. Os outros itens descrevem a compra desse veículo.</p>}</>}
        {tab==='Notas por item'&&<div className="table-scroll"><table><thead><tr><th>Item</th><th>Média / 10</th><th>Satisfação</th><th>Avaliações</th>{Array.from({length:11},(_,i)=>i).map(n=><th key={n}>Nota {n}</th>)}</tr></thead><tbody>{summary.items.map(item=><tr key={item.key}><td>{item.label}</td><td>{number(item.mean)}</td><td>{percent(item.satisfaction)}</td><td>{item.count}</td>{item.distribution.map(d=><td key={d.score}>{percent(d.percent)} <small>({d.count})</small></td>)}</tr>)}</tbody></table></div>}
        {tab==='Histórico mensal'&&<div className="table-scroll"><table><thead><tr><th>Mês</th><th>Experiências</th><th>Avaliações</th><th>Resposta</th><th>NPS</th>{summary.items.map(item=><th key={item.key}>{item.label} / 10</th>)}</tr></thead><tbody>{summary.months.map(month=>{const m=feedbackSummary(entity.rows.filter(r=>r.created_at.startsWith(month)));return <tr key={month}><td>{month.slice(5)}/{month.slice(0,4)}</td><td>{m.experiences}</td><td>{m.responses}</td><td>{percent(m.responseRate)}</td><td>{number(m.stats.nps)}</td>{m.items.map(item=><td key={item.key}>{number(item.mean)}</td>)}</tr>})}</tbody></table><small>Notas antigas de 1 a 5 são multiplicadas por 2 na comparação. Histórico por mês de criação da experiência, dentro do período selecionado.</small></div>}
        {tab==='Feedback'&&<div className="feedback-topics">{[['Elogios mais citados',stats.praise],['Melhorias mais citadas',stats.improvements],['Como conheceram a Icom',stats.discovery]].map(([title,entries])=><section key={String(title)}><h4>{String(title)}</h4>{(entries as [string,number][]).length?<ul>{(entries as [string,number][]).slice(0,5).map(([label,count])=><li key={label}><span>{label}</span><b>{percent(summary.responses?Math.round(count/summary.responses*100):null)} <small>({count})</small></b></li>)}</ul>:<p className="muted">Aguardando respostas.</p>}</section>)}<small>Percentuais sobre avaliações concluídas. Nas perguntas com várias escolhas, a soma pode ultrapassar 100%.</small></div>}
      </article>
    })}</div>
  </section>
}
