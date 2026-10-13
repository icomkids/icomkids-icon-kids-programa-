# Pró-labore e contas PF/PJ

Administrativo → Pró-labore, também acessível junto a Rendas extras e na Visão geral. Controle exclusivo do proprietário: valor líquido mensal, primeira data, primeiro mês de referência, conta PJ de origem e PF de destino. Uma recorrência cria entre 1 e 60 registros mensais, incluindo opções de 10 ou 12 meses.

Exemplo: PJ com R$ 100.000 e PF zerada. Pró-labore de R$ 30.000 deixa PJ com R$ 70.000 e PF com R$ 30.000. Saldo total permanece R$ 100.000. Uma conta pessoal de R$ 500 paga pela PF deixa PF com R$ 29.500 e total R$ 99.500; se paga pela PJ, reduz a PJ. A despesa pessoal continua na categoria pessoal, independentemente da conta usada.

O registro não cria renda externa nem despesa consolidada e não altera os cálculos das vendas. Trata-se de alocação interna para preservar o resultado econômico da empresa e da vida pessoal sem contar o mesmo valor duas vezes. Não calcula impostos ou folha: informe o líquido efetivamente transferido; custos tributários pagos são registrados separadamente. Nenhum Pix ou operação bancária é executado.

Mês do cartão recebido = data do recebimento; previsões usam a data prevista e ficam separadas. O primeiro mês pode ser marcado como já transferido, com data até hoje. Os demais ficam previstos: basta confirmar quando entrar, sem cadastrar novamente. A recorrência não executa Pix nem presume que uma transferência aconteceu. Datas no fim do mês são limitadas ao último dia do mês seguinte. “Alterar próximos” altera valor, contas e observação deste registro previsto em diante na mesma série; recebidos e cancelados permanecem intactos.

Registros antigos sem conta continuam no saldo total e precisam ser classificados; não são presumidos como PF/PJ. Saldos por conta são antes das reservas, como na tela de contas já existente. A criação inline no pró-labore fixa a área da conta: origem PJ, destino PF. Nome de conta existente com mesmo banco/área e saldo inicial zero retorna a conta existente. Conflitos PF/PJ ou novos saldos iniciais recebem uma mensagem específica, sem criar duplicações.

Por voz/WhatsApp: “da minha conta física”, “da PF”, “da conta pessoal”, “da PJ” ou nome exato da conta. Se houver múltiplas contas na mesma área, pedir nome. Despesa pessoal nunca implica automaticamente qual banco foi usado. Transferência de pró-labore continua manual, conforme regra de retiradas por voz.

Salvamento idempotente por UUID; registros realizados são imutáveis. Cancelamento preserva histórico, exige senha de exclusão e recompõe ambos os saldos. RLS e RPCs restringem os dados ao proprietário. Classificação PF/PJ das contas com pró-labore é preservada para não reclassificar o histórico.
