// Vehicle financing products checked against official institution pages on 2026-10-05.
export const vehicleBanks = [
 {name:'Banco do Brasil',url:'https://www.bb.com.br/site/pra-voce/financiamentos/financiamento-de-carro/'},
 {name:'Bradesco',url:'https://banco.bradesco/html/classic/produtos-servicos/emprestimo-e-financiamento/veiculos/'},
 {name:'BV',url:'https://www.bv.com.br/pt/web/portal/financiamento'},
 {name:'C6 Bank',url:'https://www.c6bank.com.br/financiamento-de-veiculos/'},
 {name:'Caixa',url:'https://www.caixa.gov.br/voce/credito-financiamento/financiamentos/credito-auto-caixa/Paginas/default.aspx'},
 {name:'Cresol',url:'https://blog.cresol.com.br/financiamento-de-veiculos-o-que-e-e-como-fazer/'},
 {name:'Itaú',url:'https://www.itau.com.br/emprestimos-financiamentos/veiculos'},
 {name:'Pan',url:'https://www.bancopan.com.br/produtos/financiamento-de-veiculos/'},
 {name:'Porto Bank',url:'https://www.portoseguro.com.br/sites/institucional/financiamento/'},
 {name:'Safra',url:'https://www.safra.com.br/safra-financeira/financiamento-veiculo.htm'},
 {name:'Santander',url:'https://www.santander.com.br/hotsite/santanderfinanciamentos/index.html'},
 {name:'Sicoob',url:'https://www.sicoob.com.br/web/sicoobinova/financiamento-de-veiculos'},
 {name:'Sicredi',url:'https://www.sicredi.com.br/site/credito/para-voce/financiamento-de-veiculos/'},
] as const;
export const validVehicleBank=(value:string)=>value==='OUTRO'||vehicleBanks.some(b=>b.name===value);
