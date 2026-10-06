# Caixa, investidores e destino da troca

## Uso

1. Administrativo → Vendas: informe se o carro vendido é da loja ou de um investidor; identifique o investidor.
2. Na troca, escolha Loja, Repasse ou Investidor. Se o mesmo investidor recebe a troca, use o mesmo nome nos dois campos.
3. Veículos mostra o destino junto ao carro. Um carro destinado ao investidor não oferece preparação ou revenda pela loja.
4. Para repassar, marque o carro como Disponível e use Registrar repasse. Compra e preparação são preenchidas do estoque; informe preço, recebimento e data. O custo fixo do vendedor é zero neste fluxo.
5. Custos da loja → Novo lançamento: selecione a venda e a finalidade ao pagar custos, devolver capital ao investidor ou retirar capital reservado do repasse. IPVA, multas e quitação continuam em Contas a pagar.

## Separação do dinheiro

O cálculo do lucro permanece venda − compra − custos adicionais − vendedor. Recebimentos previstos, carros em estoque e contas ainda pendentes não viram dinheiro recebido.

- Venda de carro da loja: dinheiro efetivamente recebido pertence à loja, descontados os débitos da troca ainda reservados e as saídas registradas.
- Venda de investidor: reserva primeiro o capital, depois os custos não pagos. Somente o excedente recebido fica disponível.
- Exemplo confirmado: venda R$ 100 mil, compra R$ 90 mil, custo R$ 1 mil, vendedor R$ 1.650, troca R$ 50 mil para o mesmo investidor e recebimento R$ 50 mil. Reserva de investidor R$ 40 mil, custos R$ 2.650, disponível R$ 7.350.
- Repasse R$ 30 mil → R$ 31 mil: R$ 30 mil ficam como capital reservado, R$ 1 mil como disponível. Preparação reduz esse resultado. Prejuízo de repasse concluído é descontado uma vez, inclusive depois de pagar os custos.
- Se a troca de uma venda de investidor fica para revenda, seu capital recebido é associado à operação original. Não há entrada duplicada nem duas reservas para o mesmo capital.
- Devolver capital reduz o dinheiro registrado e a reserva correspondente; não diminui novamente o lucro. Pagar um custo vinculado consome a reserva e registra a saída uma vez.
- Vendas anteriores sem dono/destino definidos ficam sinalizadas. Seus recebimentos não são considerados livres até o proprietário revisar o cadastro. A publicação não escolhe esses dados pelo usuário.

O saldo disponível acumula registros até hoje, incluindo despesas pessoais já pagas. O fechamento mensal conserva o movimento bruto do período, claramente identificado. Não há saldo bancário inicial, consulta ao banco ou transferência automática neste recurso.

Custos devem ser vinculados à venda para consumir a reserva. Uma despesa geral sem vínculo continua sendo uma saída geral; o sistema não presume que duas despesas com o mesmo valor são a mesma coisa. A preparação já ligada ao estoque e a baixa de débitos em Contas a pagar são reconhecidas pelos vínculos do banco de dados.

## Integridade e acesso

Dados mantidos no livro e históricos privados existentes, com RLS do proprietário. `icom_bank_cash_entries` verifica usuário autenticado e perfil OWNER, usa search_path vazio e nega anon. Associações de caixa são geradas pelo servidor e não aceitas no payload de escrita.

Saídas vinculadas validam limites, origem realizada, data, concorrência e duplicação. Uma venda com devoluções não pode ser alterada/arquivada sem corrigir essas saídas. Recebimentos e revendas que sustentam capital já devolvido também ficam protegidos; primeiro corrija a devolução.

Advisor aponta a execução autenticada de SECURITY DEFINER intencional. A autorização interna OWNER foi testada para todos os perfis ativos; não houve ampliação de acesso. Referência: [orientação do Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Validação

126 testes unitários aprovados, incluindo 19 casos de caixa. Fixtures SQL de caixa, contas a receber e contas a pagar foram executadas com rollback, sem registros financeiros de teste persistidos. Cobrem capital parcial, pagamento de custos, repetição, conflito de versão, destino investidor, repasse, associação da revenda à origem, reversão após devolução e acesso negado para funcionários/anon.

Build Next.js e TypeScript aprovados. Prévia isolada confirmou R$ 7.350 disponíveis no exemplo, R$ 1 mil adicionais no repasse e ausência de novo desconto ao pagar R$ 2.650 de custos. Layout móvel com largura útil 375px e scrollWidth 375px.

Migrações criadas via CLI: 20261006163916, 20261006165712 e 20261006170027. Nenhuma venda real foi reclassificada ou alterada para testes.
