# Contas da loja e pessoais — 06/10/2026

O botão Contas a pagar do Administrativo agora usa texto branco sobre o fundo azul. A página existente reúne débitos de veículos, contas avulsas e contas mensais da loja ou pessoais, sem adicionar páginas ao menu principal.

## Uso

1. Administrativo → Contas a pagar → Cadastrar conta.
2. Escolha Loja ou Pessoal. No pessoal, identifique Bruno, Gisela ou Bruno e Gisela.
3. Informe descrição, valor e primeiro vencimento. Valores são formatados em reais, com duas casas decimais.
4. Escolha Avulsa ou Mensal e a quantidade explícita de meses (2 a 60). O formulário informa a data final; não existe repetição indefinida. Em meses curtos, dia 30/31 usa o último dia, voltando ao dia original nos meses seguintes.
5. Após pagar fora do sistema, confirme o pagamento. O cadastro de vencimentos não cria saída de caixa; a baixa cria ou vincula uma única saída, no escopo correto. Não há transferência bancária automática.

A agenda destaca vencidos, hoje, próximos sete dias e o mês. Cada dia pode ser selecionado. Os filtros Loja/Pessoal/Veículos, identificação pessoal, busca, mês, data específica, pagos e arquivados ficam na mesma página. Contas sem vencimento continuam visíveis nas prioridades e têm aviso para definir a data.

Editar/arquivar uma conta mensal afeta apenas o vencimento escolhido. Valores variáveis (água/luz) podem ser ajustados em cada mês. Contas pagas precisam de reversão auditada antes de editar ou arquivar; comprovantes e histórico anteriores permanecem preservados. A restauração independente de uma saída vinculada/revertida continua bloqueada.

Loja e pessoal possuem totais separados. Saldo de lançamentos da loja não é saldo bancário. Nenhuma conta real foi cadastrada ou paga como teste. A área continua exclusiva do OWNER; vendedores e gerente não obtiveram acesso ao Administrativo. Bruno/Gisela são identificações de despesas, não contas de login.

## Validação

- 100 testes unitários aprovados, incluindo agenda em virada de mês, séries de meses curtos/ano bissexto, valores positivos, separação de escopos e validação de versão.
- Lint dos arquivos alterados, TypeScript e build de produção Next aprovados.
- Migração 20261006145145 aplicada no projeto existente junto de dois blocos SQL de teste com rollback: regressão de dívidas de troca e novo cadastro mensal/pessoal. Testados autorização/RLS para todos os funcionários ativos, repetição sem duplicidade, edições concorrentes, baixa/reversão, arquivo/restauração, vínculo de saída existente e ausência de movimento de caixa ao cadastrar contas.
- Fixtures SQL integralmente revertidas; nenhum registro financeiro de teste persistiu.
- Interface testada em prévia isolada, incluindo cadastro mensal, pagamento pessoal fictício e formulário de 390px. Formatação 1650 → 1.650,00 conferida.

O advisor sinaliza as RPCs SECURITY DEFINER executáveis por authenticated. É intencional: validação OWNER ocorre antes de qualquer leitura/escrita, RLS restringe leitura, search_path é vazio e EXECUTE é revogado de PUBLIC/anon. As restrições foram testadas com todos os papéis ativos. [Documentação do alerta](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
