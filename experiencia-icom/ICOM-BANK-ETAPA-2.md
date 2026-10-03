# ICOM Bank — etapa 2: veículo, contrato e parcelas

O cadastro de cliente validado foi preservado. A ficha agora permite continuar a venda por veículo, condições financeiras e revisão. O salvamento registra veículo, contrato interno e grade de parcelas em uma única transação. O dashboard, a ficha e as abas Contratos, Parcelas e Veículos consultam esses registros reais.

## Como testar

1. Abra Clientes e clique em Ver ficha no cadastro existente.
2. Clique em Cadastrar veículo e contrato.
3. Preencha marca, modelo, placa e os demais dados disponíveis.
4. Informe valor do veículo, entrada, quantidade, valor das parcelas, venda, primeiro vencimento e periodicidade.
5. Revise os totais e vencimentos antes de salvar.
6. Consulte o contrato e volte ao dashboard para conferir a carteira.

## Regras

Valores em reais no formulário, armazenados como centavos inteiros. Até 120 parcelas, mensais, a cada 15 dias ou semanais. No plano mensal, o dia original é preservado; se não existir no mês, usa seu último dia e volta ao dia original no mês seguinte. Entrada deve ser menor que o valor do veículo; soma das parcelas deve cobrir o valor financiado. Data da venda não pode estar no futuro; primeiro vencimento não pode preceder a venda. Datas antigas são permitidas e aparecem como atraso se ainda abertas.

Total das parcelas é o valor a receber, sem incluir a entrada. O total da venda com entrada aparece separadamente na revisão. Entrada informada não vira pagamento confirmado. Taxas de juros mensais, multa e juros mensais de atraso são informativas nesta etapa: não recalculam parcelas nem aplicam encargos automaticamente. O valor da parcela é informado pela equipe. Registro interno não substitui contrato assinado.

Solicitação possui UUID e repetição idempotente: uma mesma tentativa não duplica a venda. Repetir seu UUID com condições diferentes é rejeitado. Uma placa já vinculada a contrato ativo não pode receber outro contrato ativo. Auditoria registra veículo criado, contrato criado e parcelas geradas. Nenhum usuário recebe novos acessos nesta etapa.

## Permissões e banco

OWNER, ADMIN e GERENTE criam contratos para clientes ativos visíveis. VENDEDOR somente para seu próprio cliente, com responsável definido pelo banco; campos enviados não permitem forjar vendedor. FINANCEIRO, usuário inativo, não membro e anônimo não criam contratos. Escritas diretas nas tabelas financeiras continuam bloqueadas. Consulta usa JWT do usuário e RLS existentes.

Migrações aplicadas: `20261003195251_icom_bank_contracts_atomic_creation.sql` e `20261003195523_icom_bank_contract_variable_fix.sql`. Nova função RPC `icom_bank_create_contract`; nenhuma nova tabela, bucket ou variável de ambiente. O schema e os outros módulos foram mantidos.

## Arquivos e rotas

Novos: `lib/icom-bank/contracts.ts`; componentes `BankContractForm.tsx`, `BankCustomerFinance.tsx`, `BankPortfolio.tsx`; API `app/icom-bank/api/contracts/route.ts`; páginas protegidas `clientes/[id]/contrato/novo`, `contratos`, `contratos/[id]`, `parcelas`, `veiculos`; `tests/icom-bank-contracts.test.ts`; `supabase/tests/icom-bank-contracts.sql`; duas migrações e este relatório.

Alterados, somente no módulo: modelo, servidor, CSS, ficha e lista de clientes, API de clientes, componentes de clientes e dashboard. `package.json` inclui os novos testes. Rotas têm o prefixo existente `/experiencia-icom/icom-bank`.

## Validação

59 testes passaram, incluindo todos os anteriores. ESLint completo passou. TypeScript do código e tipos de rotas gerados passou; cache antigo de uma prévia removida não faz parte da validação do código. Teste SQL em transação confirmou datas de ano bissexto, totais, separação entre entrada e pagamento, auditoria, idempotência, rejeição de placa ativa duplicada, rollback em entrada inválida, atribuição do vendedor e bloqueio de não membros, FINANCEIRO, inativos e anônimos. Todos os dados de teste foram revertidos.

## Próxima etapa

Configuração da chave Pix fixa, envio e análise de comprovantes e confirmação de pagamentos. Depois, inadimplência detalhada, relatórios, edição e gestão de funcionários. Busca global ainda por nome ou CPF; pesquisa por placa/contrato e dados pessoais complementares ficam pendentes. Não foram integrados bancos, boletos, assinatura digital ou WhatsApp.

## Publicação e conferência

Build Docker de produção concluído com sucesso em 03/10/2026 às 17h03 (Brasília), com TypeScript e 59 testes. Conferência autenticada no domínio passou para Clientes, ficha, cadastro do veículo, condições, revisão, Contratos, Parcelas, Veículos e dashboard. A revisão mostrou 31/01, 29/02 e 31/03/2028 corretamente. O formulário de teste foi abandonado antes de salvar; nenhum contrato foi adicionado ao cadastro do usuário. A API de criação é validada pelo teste SQL transacional, inclusive com a role authenticated.

O advisor assinala a RPC como SECURITY DEFINER executável por authenticated. Essa exposição é intencional para permitir a gravação atômica sem conceder escrita direta nas tabelas: função usa search_path vazio, exige auth.uid(), verifica perfil ativo e responsável do cliente, revoga execução pública/anônima e registra auditoria. O teste confirma rejeição para usuários sem autorização. Referência do [advisor do Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
