# Devoluções e entradas de capital

No Administrativo e em Contas a pagar, o quadro A devolver a investidores / consignantes abre Caixa da empresa. A lista agrupa pendências por responsável, com botão em cada venda. O formulário registra um pagamento já feito e pede a mesma senha de segurança usada nas exclusões. Não envia Pix.

As saídas usam CUSTO + sale_cost_id + settlement_part=INVESTIDOR. A matemática existente baixa dinheiro e reserva juntos e preserva o lucro líquido da venda. O histórico lista devoluções e seus cancelamentos. A senha protege criação, alterações e restauração; a aprovação é limitada ao ator, operação, registro e prazo. Controles de valor recebido, pagamentos concorrentes e capital reservado continuam no banco.

Saldo inicial / aporte permite informar conta da empresa, valor, data até hoje e observação. A conta pode ser cadastrada no próprio formulário. O usuário confirma que o dinheiro já existe e ainda não está lançado. Saldo inicial é permitido uma vez por conta; aportes podem ser registrados posteriormente. As entradas são ENTRADA com vínculo de conta SALDO_INICIAL ou APORTE. Ambos aumentam caixa e saldo da conta, mas são excluídos dos ganhos operacionais no painel, fechamento e consultas da IA. Não usar APORTE para receita de venda nem para retirada.

O banco grava entrada e vínculo em uma única transação e reaproveita o mesmo ID nas repetições para evitar duplicidade. Entradas ou saídas reais não foram criadas durante a verificação: os cenários de banco usam rollback.

Migração: 20261015202744_ia_bank_investor_returns_cash_funds.sql
Testes: tests/ia-bank-investor-returns-funds.test.ts e verificação transacional em work/investor-return-funds/rollback.sql.
