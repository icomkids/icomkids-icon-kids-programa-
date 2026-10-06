# Investidores e catálogo de veículos

O proprietário acessa Administrativo → Investidores da loja. Cadastro com nome,
telefone, e-mail e observações. Contatos são opcionais. O nome fica fixo após o
cadastro: os registros financeiros conservam seus nomes históricos e reservas.
Não são criados usuários ou acessos para investidores.

Nas vendas, o investidor cadastrado é selecionado tanto como dono do carro vendido
quanto como destinatário da troca. IDs persistidos e nomes conferidos no banco
impedem vínculos forjados. A ficha mostra vendas, trocas destinadas ao investidor
e capital efetivamente recebido ainda reservado, acumulado até hoje.
Registros antigos sem ID aparecem por correspondência exata de nome, ignorando
maiúsculas e espaços nas pontas. Nenhum cadastro ou veículo fictício foi importado.

RLS e API limitam a área ao OWNER. Escritas usam RPC SECURITY INVOKER e RLS,
validação no banco, controle de concorrência e repetição segura. Alterações ficam
em histórico privado; exclusão física não é autorizada ao cliente.

O catálogo Parallelum obtido em 06/10/2026 contém 108 marcas e 7.386 versões,
incluindo GM / Chevrolet. Marcas aparecem imediatamente e modelos vêm do catálogo
embutido no servidor. A edição começa no catálogo, inclusive para registros antigos
manuais, com indicação dos dados anteriores. A consulta de preços depende de ano,
combustível e versão exatos; preços não são inventados nem embutidos no catálogo.
Os anos e a cotação seguem vindo do provedor. Preço e mês de referência são
conferidos no servidor antes de salvar; snapshots anteriores seguem preservados.

Atualização do catálogo: `node scripts/update-vehicle-catalog.mjs`, revisar os JSONs
e publicar. Fonte: https://deividfortuna.github.io/fipe/v2/

Validação: 131 testes unitários; fixture `supabase/tests/icom-bank-investors.sql`
com RLS real, OWNER, todos os funcionários ativos e anon, histórico, idempotência,
nome único, concorrência e vínculo inválido. Fixtures sempre revertidas.
Fixture de caixa/repasse novamente aprovada. Lint e build de produção aprovados.
