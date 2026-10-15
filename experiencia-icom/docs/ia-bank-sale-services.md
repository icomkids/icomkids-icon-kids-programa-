# Documentação e perícia cautelar na venda

Na etapa Condições da venda, cada serviço tem Sim/Não, custo e valor vendido. O resumo mostra o lucro de cada serviço e o resultado total. Use os campos somente para valores cobrados além do preço do carro, evitando repetir serviços já incluídos no preço informado.

## Contrato dos dados

- Os campos documentation_* e inspection_* guardam a composição de cada serviço, em centavos. Valores são manuais e podem ser zero; prejuízo é exibido quando o custo supera o preço.
- sale_cents é o total da operação: carro + serviços vendidos. vehicle_cost_cents inclui preparação + custos dos serviços. Assim, saleCost, saleProfit, caixa, contas a receber e contrato de boleto próprio continuam trabalhando com os totais já consolidados. Não somar os serviços novamente ao consumir esses campos.
- saleFormDetails recupera preço do carro e custo de preparação para editar. adminSaleCalculation consolida os valores uma única vez antes de salvar. Desmarcar um serviço remove seus valores do payload e dos totais.
- A validação de estoque desconta os custos dos serviços ao conferir a preparação registrada. As regras de dono, capital reservado, pagamentos, versão e acesso permanecem vigentes.
- Não são criadas entradas ou saídas adicionais automaticamente: o recebimento segue a confirmação integral/parcial/pendente da venda. Custos pagos vinculados seguem o fluxo existente.
- Registros anteriores sem os novos campos mantêm os mesmos valores. O detalhamento é mostrado no histórico de vendas e na exportação CSV.

Migração: 20261015171043_icom_bank_sale_documentation_inspection.sql
Testes: tests/ia-bank-sale-services.test.ts (lucro, edição repetida, remoção, legado, validação, recebíveis/boleto e capital de investidor).
