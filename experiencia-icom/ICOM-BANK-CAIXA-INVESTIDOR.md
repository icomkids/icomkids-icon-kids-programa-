# Caixa, investidores e destino da troca

## Regra confirmada por Bruno · 06/10/2026

O lucro registrado já é líquido: venda − compra − custos adicionais − vendedor. Os custos não são reservados novamente fora do valor do investidor.

Quando o mesmo investidor recebe a troca e todo o restante foi recebido em dinheiro:

- Recebimento: R$ 72.000,00.
- Lucro líquido da loja: R$ 14.150,00.
- Dinheiro a devolver ao investidor: R$ 57.850,00.
- O carro da troca também fica com o investidor; não representa saldo de caixa.

O alvo de devolução é custo total da venda menos crédito líquido da troca destinada ao mesmo investidor. IDs cadastrados identificam o mesmo investidor; nomes normalizados são fallback para registros anteriores. Recebimentos parciais reservam primeiro esse alvo, liberando somente o excedente recebido para a loja.

Custos e débitos pagos pela loja em nome do investidor abatem o valor a devolver, sem descontar novamente o lucro. Após devolver integralmente o dinheiro, o sistema impede pagar os mesmos custos novamente em nome dele. Despesas gerais sem vínculo continuam sendo saídas reais adicionais.

Se a troca fica para revenda ou vai a outro investidor, ela não abate a devolução do investidor original. Débitos de uma troca retida pela loja continuam reservados separadamente. Capital recebido na revenda da troca se associa à operação original sem duplicar entradas ou reservas.

## Uso

1. Administrativo → Vendas: informe o dono do carro e selecione o investidor quando aplicável.
2. Na troca, escolha Loja, Repasse ou Investidor e selecione o destinatário. O formulário mostra “Valor a devolver ao investidor” e “Lucro líquido disponível da loja”.
3. Para registrar uma devolução efetivamente feita, use Custos da loja → Novo lançamento → Venda vinculada → Pagar valor reservado ao investidor. Não há transferência bancária automática.
4. Um custo pago em nome do investidor deve ser vinculado à mesma venda, finalidade CUSTOS. IPVA, multas e quitação são baixados em Contas a pagar.
5. Carros destinados ao investidor não oferecem preparação/revenda pela loja. Para repasse da loja, marque Disponível e use Registrar repasse: compra/preparação vêm do estoque, vendedor custa zero.

Venda de veículo próprio conserva o caixa recebido, descontados débitos reservados e saídas. Repasse R$ 30 mil → R$ 31 mil reserva R$ 30 mil e libera R$ 1 mil; preparação reduz esse resultado. Prejuízos concluídos são descontados uma vez. Previsto, arquivado e estoque não viram dinheiro recebido.

Saldo disponível é acumulado até hoje, com despesas pessoais pagas. Fechamento mensal mostra o movimento bruto. Vendas anteriores sem dono/destino definidos ficam retidas até revisão do proprietário; a publicação não preenche esses dados por ele.

## Integridade e acesso

Livro e históricos privados conservam RLS OWNER. `icom_bank_cash_entries` exige usuário autenticado OWNER; vínculos de caixa são gerados no banco, não aceitos no payload. Helpers novos ficam em schema interno com EXECUTE negado a PUBLIC/anon/authenticated e search_path vazio.

Saídas validam dinheiro recebido, finalidade, origem, data, duplicação e concorrência. Custos, devoluções e débitos pagos para o mesmo investidor compartilham um limite. Vendas, recebimentos e revendas que sustentam pagamentos ficam protegidos até corrigir seus vínculos.

Advisor conserva os avisos anteriores de RPCs SECURITY DEFINER intencionais com autorização interna; novos helpers não ampliam acesso. [Referência do Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Validação

136 testes unitários, incluindo 72.000/14.150/57.850, recebimento parcial, despesa vinculada, débitos, IDs de investidores, repasse/revenda e prejuízo sem duplicação. Fixtures SQL de caixa, lucro líquido, contas a pagar/receber e investidores verificadas com rollback: limites após devolução integral, custos/débitos antes da devolução, reversão de débito, idempotência e acesso negado. Nenhum lançamento de teste persiste.

Migração: `20261006190615_icom_bank_investor_net_profit.sql`. Nenhuma venda existente, propriedade ou pagamento foi alterado nos testes.
