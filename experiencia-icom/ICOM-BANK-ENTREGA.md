# ICOM Bank — primeira etapa

## Arquitetura e integração

Análise feita antes da implementação: o repositório contém o IcomKids em React/Vite e o módulo Experiência ICOM em Next.js 16, React 19 e TypeScript. O novo módulo usa o aplicativo Next existente, a mesma branch `experiencia-icom`, Supabase e serviço Easypanel. O prefixo fixo da aplicação foi respeitado: `/experiencia-icom/icom-bank`. Não houve alteração das rotas, autenticação ou tabelas dos módulos anteriores.

Login usa o Supabase Auth existente e autorização exclusiva em `icom_bank_user_access`. Cookie separado HttpOnly, SameSite Strict, Secure em produção, duração máxima de uma hora. Recuperação de senha reaproveita a página existente; a senha pertence à mesma conta Supabase. Primeiro OWNER autorizado: brunolira0312@icloud.com. Nenhuma permissão foi herdada automaticamente de outros módulos.

## Entrega funcional

- Login e saída exclusivos do módulo.
- Sidebar conforme perfil, cabeçalho, identidade visual responsiva.
- Dashboard com dados reais, valores em centavos e estados vazios, sem simular pagamentos.
- Clientes: cadastro básico de nome, CPF, telefone e e-mail; busca, filtros e ficha de consulta. CPF mascarado nas respostas de consulta.
- Registro de auditoria ao criar cliente.
- Demais áreas com indicação explícita de próxima etapa; não executam operações financeiras.

## Rotas

Todas sob `/experiencia-icom/icom-bank`: `/login`, `/dashboard`, `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/contratos`, `/parcelas`, `/pagamentos`, `/comprovantes`, `/inadimplencia`, `/relatorios`, `/funcionarios`, `/veiculos`, `/configuracoes`; APIs `/api/session` e `/api/customers`.

## Permissões

| Perfil | Áreas permitidas |
|---|---|
| OWNER / ADMIN | Todas as áreas preparadas |
| GERENTE | Todas, exceto usuários e configurações |
| FINANCEIRO | Dashboard, parcelas, pagamentos, comprovantes e inadimplência |
| VENDEDOR | Dashboard, seus clientes e seus contratos |

Permissão de menu não significa operação futura implementada. Nesta etapa a única escrita de negócio habilitada é cadastro de clientes. Vendedor não pode atribuir cliente a outro usuário. Alteração de perfil, pagamentos e aprovação de comprovantes não estão liberadas por escrita direta.

Todas as consultas usam JWT do usuário, inclusive no servidor. As tabelas têm RLS; contas sem acesso ativo não recebem dados. A chave de serviço fica somente no servidor. Política de origem protege as operações de sessão e cadastro. Veja a [documentação de RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Banco e migrações

| Tabela | Finalidade |
|---|---|
| icom_bank_user_access | Perfil e autorização do módulo |
| icom_bank_customers | Clientes e responsável |
| icom_bank_vehicles | Estrutura inicial de veículos |
| icom_bank_contracts | Estrutura inicial de contratos |
| icom_bank_installments | Parcelas e vencimentos |
| icom_bank_payment_proofs | Metadados e revisão de comprovantes |
| icom_bank_payments | Pagamentos confirmados |
| icom_bank_audit_logs | Eventos de auditoria |
| icom_bank_system_settings | Configuração inicial |

Migrações aplicadas no projeto existente: `20261003192037_icom_bank_phase_one_isolated.sql` e `20261003192948_icom_bank_phase_one_indexes.sql`. Schema privado `icom_bank_internal` contém auxiliares de autorização e auditoria. Bucket privado `icom-bank-documents`, limite 10 MB, JPEG/PNG/PDF; uploads ainda não habilitados. Chaves estrangeiras compostas impedem vincular veículo ou comprovante a entidades incompatíveis. Índices adicionados para as duas referências apontadas pelo advisor.

Nenhum cliente, contrato ou pagamento fictício permaneceu no banco. Os testes SQL usam transação com rollback. O primeiro OWNER foi habilitado separadamente, por autorização explícita, e não faz parte de uma migração que conceda acesso a todos.

## Arquivos

Novos diretórios: `app/icom-bank/` (layout, CSS, login, APIs e páginas protegidas), `components/icom-bank/` (shell, login, dashboard, clientes e formulário), `lib/icom-bank/` (modelo, validação e acesso ao banco). Novos testes: `tests/icom-bank.test.ts` e `supabase/tests/icom-bank-access.sql`. Novas migrações listadas acima. Único arquivo existente alterado: `package.json`, para incluir os testes do módulo. Não foram adicionadas dependências ou alteradas variáveis de ambiente e configuração de hospedagem.

## Validação

56 testes passaram, incluindo os testes anteriores. ESLint completo e TypeScript passaram. Teste SQL real confirmou isolamento de vendedor, bloqueio de não membro e anônimo, impossibilidade de elevar o próprio perfil, bloqueio de pagamento direto e revogação imediata do acesso inativo. Advisor de segurança não apontou problemas específicos nas novas tabelas. Build Docker de produção passou, incluindo TypeScript e 56 testes, em 03/10/2026. A conferência no domínio identificou duplicação do basePath no redirecionamento: corrigida usando caminhos relativos à aplicação nas chamadas de redirect do Next.js. A busca desta fase é por nome ou CPF; placa e contrato ficam para a próxima etapa.

## Próximas etapas

Completar cadastro de veículo, contrato e geração de parcelas; alterações de clientes; upload e aprovação de comprovantes; confirmação de pagamentos e auditoria de cada operação; configuração Pix manual; gestão de acessos; relatórios completos e busca por placa/contrato. Nenhuma API bancária, Pix dinâmico, boleto, assinatura ou automação WhatsApp foi integrada nesta fase.
