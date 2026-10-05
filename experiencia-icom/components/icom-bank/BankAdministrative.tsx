'use client';

import {useState} from 'react';

const areas=[
  {id:'entradas',label:'Entradas',scope:'LOJA',description:'Receitas e valores que entram na loja.',columns:['Data','Descrição','Categoria','Forma de recebimento','Valor']},
  {id:'custos',label:'Custos',scope:'LOJA',description:'Custos ligados às operações e aos veículos da loja.',columns:['Data','Descrição','Veículo / referência','Categoria','Valor']},
  {id:'despesas',label:'Despesas',scope:'LOJA',description:'Saídas e despesas da operação da loja.',columns:['Data','Descrição','Categoria','Forma de pagamento','Valor']},
  {id:'mensais',label:'Custos mensais',scope:'LOJA',description:'Compromissos recorrentes para acompanhar mês a mês.',columns:['Mês','Descrição','Vencimento','Situação','Valor']},
  {id:'pessoais',label:'Despesas pessoais',scope:'PESSOAL',description:'Sua organização financeira pessoal, em uma área própria.',columns:['Data','Descrição','Categoria','Forma de pagamento','Valor']},
] as const;

export default function BankAdministrative(){
  const [selected,setSelected]=useState<(typeof areas)[number]['id']>('entradas');
  const area=areas.find(item=>item.id===selected)!;
  return <>
    <div className="bank-heading">
      <div><p className="bank-eyebrow">ORGANIZAÇÃO FINANCEIRA</p><h1>Administrativo</h1><p>Entradas, custos e despesas organizados por assunto.</p></div>
      <span className="bank-pill gold">Acesso do proprietário</span>
    </div>
    <section className="bank-panel bank-admin-intro">
      <div><h2>Seu controle, em formato de planilha</h2><p>O espaço está preparado para receber seu modelo. As colunas e os lançamentos serão ajustados a partir dos prints que você enviar.</p></div>
      <span className="bank-pill">Preparação</span>
    </section>
    <nav className="bank-admin-areas" aria-label="Áreas administrativas">
      {areas.map(item=><button key={item.id} type="button" aria-pressed={selected===item.id} onClick={()=>setSelected(item.id)}><small>{item.scope}</small><strong>{item.label}</strong></button>)}
    </nav>
    <section className="bank-panel" aria-labelledby="bank-admin-title">
      <div className="bank-panel-title"><div><h2 id="bank-admin-title">{area.label}</h2><p>{area.description}</p></div><span className="bank-pill">Modelo inicial</span></div>
      <div className="bank-table bank-admin-sheet"><table>
        <caption className="bank-admin-caption">Prévia da organização · colunas a confirmar com seu modelo</caption>
        <thead><tr><th scope="col">#</th>{area.columns.map(column=><th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={area.columns.length+1}><div className="bank-empty"><strong>Aguardando seu modelo de {area.label.toLocaleLowerCase('pt-BR')}</strong><p>Assim que você enviar os prints, vamos montar os campos, cálculos e lançamentos desta parte.</p></div></td></tr></tbody>
      </table></div>
      <p className="bank-note">Esta primeira etapa é a estrutura da área. O cadastro e o salvamento de lançamentos serão disponibilizados após definirmos o modelo.</p>
    </section>
  </>;
}
