import {bankAuthorize,bankOrigin,bankQuery,bankAll,bankError,BankError,bankAdminSellers} from '@/lib/icom-bank/server';
import {adminInput,adminArchiveInput,adminYear,adminSaleSettlement,saleCost,saleProfit,returnNet,returnStore,type AdminEntry,type AdminReference} from '@/lib/icom-bank/administrative';
import {csv} from '@/lib/icom-bank/management';

export async function GET(req:Request){try{
 const {token}=await bankAuthorize('administrativo'),q=new URL(req.url).searchParams;
 let year:number;try{year=adminYear(q.get('year'));}catch(e){throw new BankError(e instanceof Error?e.message:'Confira o ano.',400);}
 const rows=await bankAll(token,`icom_bank_admin_entries?select=*&entry_date=gte.${year}-01-01&entry_date=lt.${year+1}-01-01&order=entry_date.desc,id.asc`) as AdminEntry[];
 if(q.get('format')==='csv'){
  const month=q.get('month')||'all';if(month!=='all'&&!/^(0[1-9]|1[0-2])$/.test(month))throw new BankError('Confira o mês.',400);
  const list=rows.filter(e=>e.active&&(month==='all'||e.entry_date.startsWith(`${year}-${month}`)));
  const output:unknown[][]=[['ICOM BANK - ADMINISTRATIVO'],['Ano',year,'Mês',month==='all'?'Todos':month],['Área','Escopo','Data','Descrição','Categoria','Situação','Valor / recebido em R$','Carro','Placa','Vendedor','Compra','Custo veículo','Comissão','Custo real','Venda','Lucro calculado','Banco','Retorno','Financiado','Imposto','Líquido retorno','Repasse gerente','Repasse vendedor','Loja retorno','Valor pago troca','Débito troca','Documentação','Pago CC','Desconto','Divisão manual','Lucro por pessoa manual','Dia vencimento','Observações','Troca recebida','Modelo troca','Placa troca','Ano troca','Valor bruto troca','Tem débitos','IPVA troca','Multas troca','Tem quitação','Quitação troca','Banco quitação','Débitos totais troca','Crédito líquido troca','Restante a pagar','Forma pagamento','Banco financiamento']];
  const money=(n:number|undefined|null)=>n===undefined||n===null?'':(n/100).toFixed(2).replace('.',',');
  for(const e of list){const d=e.details;output.push([e.kind,e.scope,e.entry_date,e.description,e.category,e.status,money(e.amount_cents),d.vehicle,d.plate,d.seller,money(d.purchase_cents),money(d.vehicle_cost_cents),money(d.commission_cents),e.kind==='VENDA'?money(saleCost(e)):'',money(d.sale_cents),e.kind==='VENDA'?money(saleProfit(e)):'',d.bank,d.return_level,money(d.financed_cents),money(d.tax_cents),e.kind==='RETORNO'?money(returnNet(e)):'',money(d.manager_cents),money(d.seller_cents),e.kind==='RETORNO'?money(returnStore(e)):'',money(d.paid_cents),money(d.debt_cents),money(d.document_cents),money(d.cc_cents),money(d.discount_cents),money(d.division_cents),money(d.profit_share_cents),d.due_day,d.notes,d.trade_in===undefined?'':d.trade_in?'Sim':'Não',d.trade_vehicle,d.trade_plate,d.trade_year,money(d.trade_value_cents),d.trade_has_debts===undefined?'':d.trade_has_debts?'Sim':'Não',money(d.trade_ipva_cents),money(d.trade_fines_cents),d.trade_has_payoff===undefined?'':d.trade_has_payoff?'Sim':'Não',money(d.trade_payoff_cents),d.trade_payoff_bank==='OUTRO'?d.trade_payoff_bank_other:d.trade_payoff_bank,e.kind==='VENDA'?money(adminSaleSettlement(Number(d.sale_cents),d).debt):'',e.kind==='VENDA'?money(adminSaleSettlement(Number(d.sale_cents),d).credit):'',e.kind==='VENDA'?money(adminSaleSettlement(Number(d.sale_cents),d).remaining):'',d.payment_method,d.payment_bank==='OUTRO'?d.payment_bank_other:d.payment_bank]);}
  return new Response(csv(output),{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="icom-administrativo-${year}-${month}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const [reference]=await bankQuery<{content:AdminReference}[]>(token,'icom_bank_admin_references?id=eq.1&select=content');
 return Response.json({rows,reference:reference?.content||null,sellers:await bankAdminSellers(token)},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){return bankError(e);}}

export async function POST(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>8000)throw new BankError('Lançamento acima do tamanho permitido.',400);
 let input;try{input=adminInput(JSON.parse(raw));}catch(e){throw new BankError(e instanceof Error?e.message:'Confira o lançamento.',400);}
 const {expected_updated_at,...payload}=input;
 const row=await bankQuery<AdminEntry>(token,'rpc/icom_bank_save_admin_entry','POST',{p_payload:payload,p_expected:expected_updated_at});
 return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}

export async function PATCH(req:Request){try{
 bankOrigin(req);const {token}=await bankAuthorize('administrativo');const raw=await req.text();if(raw.length>500)throw new BankError('Solicitação acima do limite.',400);
 let input;try{input=adminArchiveInput(JSON.parse(raw));}catch(e){throw new BankError(e instanceof Error?e.message:'Confira o lançamento.',400);}
 const row=await bankQuery<AdminEntry>(token,'rpc/icom_bank_archive_admin_entry','POST',{p_id:input.id,p_active:input.active,p_expected:input.expected_updated_at});
 return Response.json({row},{headers:{'Cache-Control':'no-store'}});
}catch(e){return bankError(e);}}
