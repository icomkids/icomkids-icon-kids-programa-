# ICOM Bank — gestão, atrasos, relatórios e estornos

Etapa implementada em 05/10/2026. Valores, parcelas, taxas e condições continuam sendo informados manualmente. Não há integração de transferência, cobrança automática ou análise de crédito.

## Uso

- **Inadimplência:** parcelas abertas de contratos ativos, com faixas de 1–5, 6–15, 16–30 e mais de 30 dias. Exibe telefone, CPF protegido, veículo, contrato, parcela e saldo. Comprovante em análise ainda não é recebimento. Financeiro recebe somente contatos necessários à cobrança, sem permissão de leitura ampla dos cadastros.
- **Relatórios:** vendas pela data da venda e recebimentos pela data efetiva, com período selecionável e exportação CSV. O saldo da carteira é atual, de todos os meses, identificado separadamente do período. Estornos não aumentam os recebimentos; entrada informada não vira pagamento. CSV protege dados contra interpretação como fórmulas.
- **Funcionários:** OWNER e ADMIN gerenciam autorizações exclusivas do Bank. OWNER pode conceder ADMIN; ADMIN não pode criar ou editar outro ADMIN. Não é possível editar OWNER ou o próprio acesso. Vendedor continua restrito a seus registros. Desativação bloqueia o Bank sem alterar permissões de outros módulos. Todas as alterações têm auditoria e validação de versão para evitar sobrescrita entre abas.
- **Convites:** novas contas recebem convite Supabase por e-mail e definem a própria senha na página do Bank. Contas existentes usam a senha que já possuem. Cadastro exige revisão da autorização antes da confirmação. A URL de criação de senha está coberta pelo redirecionamento já autorizado `https://sistema.icomkids.com.br/**`; nenhuma configuração global de Auth foi alterada. Entrega de um novo convite não foi testada nesta etapa, pois nenhum funcionário real foi cadastrado.
- **Estorno:** em Pagamentos, abra um recebimento confirmado e escolha estornar, informe motivo e confirme. Somente OWNER/ADMIN podem executar. O registro original é preservado com responsável, data e motivo; parcela volta a ficar aberta, comprovante fica ESTORNADO e contrato quitado reabre quando necessário. Não devolve dinheiro pelo banco. Uma nova comprovação pode ser analisada sem reutilizar o comprovante estornado.

## Validação

70 testes unitários, TypeScript sem erros, ESLint e build Next de produção passaram. Teste SQL transacional com rollback validou autorização por perfil, CPF protegido para cobrança, bloqueio de acesso amplo ao cadastro, acesso inativo/anônimo, proteção de OWNER e do próprio acesso, validação de versão, estorno idempotente com auditoria, preservação do pagamento, reabertura de parcela/contrato, bloqueio de nova aprovação do comprovante estornado e aprovação de novo comprovante sem duplicar recebimento confirmado. Nenhum pagamento real ou autorização permanente foi criado pelos testes.

Migrações aplicadas: `20261005155617_icom_bank_audited_reversal_and_staff.sql` e `20261005160227_icom_bank_limited_collection_contacts.sql`. Modificações somente nas estruturas do ICOM Bank. Arquivos privados permanecem acessíveis por autenticação e RLS.

O Security Advisor lista as RPCs autenticadas SECURITY DEFINER. São intencionais: search_path vazio, checagem explícita de identidade/perfil, execução anônima revogada e escritas financeiras diretas bloqueadas. Não foram encontrados avisos de ausência de políticas RLS nas tabelas do Bank. Avisos de outros módulos e configuração global de senhas continuam fora desta alteração. [Referência do alerta de funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Referência de convites: [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).

Publicação e verificação online: pendentes na preparação deste documento.
