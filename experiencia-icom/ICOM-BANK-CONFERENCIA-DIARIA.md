# Conferência diária e retiradas

Área exclusiva do OWNER, em Administrativo → Caixa do dia.

1. Escolha o dia e atualize. O saldo inicial é acumulado até o dia anterior; entradas e saídas do dia usam apenas registros ativos e realizados.
2. Some todas as contas e o dinheiro incluídos no controle, incluindo reservas de investidores. Informe o saldo total conferido. A diferença compara esse total com o saldo bruto dos registros, e não com o lucro livre da loja.
3. Explique diferenças, confirme a conferência e salve. Não há ajuste automático do caixa. Os snapshots são imutáveis; correções nos lançamentos são seguidas por uma nova conferência. O histórico é filtrado pelo mês da data escolhida, com horário e responsável.
4. Registrar retirada / Pix serve para saídas já feitas para terceiros. Informe data, destinatário, motivo, valor e forma. Loja e pessoal reduzem o caixa livre. Devolução ao investidor exige a venda e usa as mesmas proteções de limite e reserva do Administrativo. Um ID por tentativa evita repetir a saída em reenvios de rede.

Não envia Pix, não consulta banco, não movimenta dinheiro real. Transferências entre contas da própria loja não reduzem o saldo total e não devem ser lançadas como retiradas. Pagamentos já baixados em Contas a pagar não devem ser registrados de novo. Se o registro foi salvo mas a atualização falhou, atualize o caixa.

O saldo bancário inicial anterior aos registros não é inventado pelo sistema. Diferenças podem indicar movimentos históricos ainda não lançados. Reservas e prejuízos continuam usando o cálculo central `cashPosition`.

O servidor calcula os totais do snapshot. O banco verifica saldo bruto, entradas, saídas, saldo inicial e a revisão dos lançamentos. O cadastro não concede acesso novo ao Administrativo: vendedores, gerente e financeiro continuam sem acesso a essa área.
