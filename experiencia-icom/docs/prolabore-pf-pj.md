# Pró-labore e contas PF/PJ

Administrativo → Pró-labore, também acessível junto a Rendas extras e na Visão geral. Registro interno de uma transferência **já realizada**, exclusivamente pelo proprietário: valor líquido recebido, mês de referência, data, conta PJ e conta PF.

Exemplo: PJ com R$ 100.000 e PF zerada. Pró-labore de R$ 30.000 deixa PJ com R$ 70.000 e PF com R$ 30.000. Saldo total permanece R$ 100.000. Uma conta pessoal de R$ 500 paga pela PF deixa PF com R$ 29.500 e total R$ 99.500; se paga pela PJ, reduz a PJ. A despesa pessoal continua na categoria pessoal, independentemente da conta usada.

O registro não cria renda externa nem despesa consolidada e não altera os cálculos das vendas. Trata-se de alocação interna para preservar o resultado econômico da empresa e da vida pessoal sem contar o mesmo valor duas vezes. Não calcula impostos ou folha: informe o líquido efetivamente transferido; custos tributários pagos são registrados separadamente. Nenhum Pix ou operação bancária é executado.

Mês do cartão = data do recebimento; referência fica no histórico. Não há transferência futura ou geração automática mensal. Pode registrar novamente quando a transferência do próximo mês ocorrer. Registros antigos sem conta continuam no saldo total e precisam ser classificados; não são presumidos como PF/PJ. Saldos por conta são antes das reservas, como na tela de contas já existente.

Por voz/WhatsApp: “da minha conta física”, “da PF”, “da conta pessoal”, “da PJ” ou nome exato da conta. Se houver múltiplas contas na mesma área, pedir nome. Despesa pessoal nunca implica automaticamente qual banco foi usado. Transferência de pró-labore continua manual, conforme regra de retiradas por voz.

Salvamento idempotente por UUID; registros realizados são imutáveis. Cancelamento preserva histórico, exige senha de exclusão e recompõe ambos os saldos. RLS e RPCs restringem os dados ao proprietário. Classificação PF/PJ das contas com pró-labore é preservada para não reclassificar o histórico.
