import {bankPath} from '@/lib/icom-bank/model';

export default function BankFinancialNavigation({active}:{active?:'payables'|'receivables'|'cash'|'accounts'}){
 const agendas=[{id:'payables' as const,path:'contas-a-pagar',title:'Contas a pagar',description:'Saídas da loja e contas pessoais',action:'Ver agenda de pagamentos',icon:'M7 7h10v10M17 7 7 17'},{id:'receivables' as const,path:'contas-a-receber',title:'Contas a receber',description:'Entradas de clientes, bancos e cartões',action:'Ver agenda de recebimentos',icon:'M17 17H7V7M7 17 17 7'}];
 return <nav className="bank-financial-navigation" aria-label="Agendas financeiras">{[...agendas,{id:'accounts' as const,path:'contas-bancarias',title:'Contas bancárias',description:'Saldos por banco · loja e pessoal',action:'Cadastrar contas e consultar saldos',icon:'M3 10h18M4 10v10h16V10M3 7l9-4 9 4M8 13v4M16 13v4'},{id:'cash' as const,path:'conferencia-diaria',title:'Caixa do dia',description:'Conferência do saldo e retiradas / Pix',action:'Conferir caixa e registrar saída',icon:'M4 12h16M12 4v16'}].map(a=><a key={a.id} className={'bank-financial-card '+a.id} href={bankPath('/administrativo/'+a.path)} aria-current={active===a.id?'page':undefined}>
  <span className="bank-financial-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon}/></svg></span>
  <span className="bank-financial-copy"><strong>{a.title}</strong><span>{a.description}</span><small>{active===a.id?'Você está aqui':a.action+' →'}</small></span>
 </a>)}</nav>;
}
