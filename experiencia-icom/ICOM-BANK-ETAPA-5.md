# ICOM Bank — perfis internos de cliente

Classificação manual A/B/C/D implementada em 05/10/2026. Não há rótulos depreciativos, consulta de score, aprovação automática de crédito, sugestão de taxa ou alteração automática de parcelas. Cada conta autorizada ao cadastro escolhe o perfil após sua própria análise. Vendedores só acessam e alteram seus próprios clientes; financeiro não altera perfis.

O cadastro inicial oferece o campo opcional. Clientes existentes aparecem como **Sem classificação**, sem inferência sobre seu histórico. A ficha permite selecionar, alterar ou remover o perfil. Listagem exibe o perfil atual. A criação de cliente registra o perfil inicial na auditoria; alterações registram autor, valor anterior e novo valor, com validação da versão para evitar sobrescrita em outra aba. Nenhum cliente real foi classificado pelos testes.

No novo contrato, junto aos juros, o perfil começa com o valor da ficha. Pode ser ajustado para aquela venda sem sobrescrever a ficha. O contrato preserva esse perfil em suas condições e o apresenta na revisão e no detalhe. Alterações futuras da ficha não reescrevem contratos anteriores. Contratos antigos não recebem classificação retroativa. Juros, multa, parcela, entrada e valor financiado permanecem manuais.

Migração aplicada: `20261005175837_icom_bank_manual_customer_profiles.sql`. Campo opcional e restrições adicionados apenas a tabelas do Bank; RPC autenticada verifica o perfil ativo do módulo e vínculo do vendedor. UPDATE direto continua revogado. Não houve concessão de acesso a novas tabelas ou alteração dos módulos anteriores.

Validação: 73 testes unitários passaram, TypeScript sem erros, ESLint e build Next passaram. SQL transacional com rollback confirmou perfis aceitos, rejeição de valor inválido na chamada direta, auditoria, edição própria do vendedor, bloqueio de outro cliente, bloqueio de financeiro/inativo/anônimo, bloqueio de escrita direta, remoção explícita do perfil, rejeição de versão antiga, compatibilidade com contratos antigos, preservação das condições financeiras e snapshot do contrato. Fixture inválida não deixou veículo órfão. Todas as fixtures e autorizações técnicas foram revertidas.

Advisor do Bank apresenta somente o aviso esperado de funções SECURITY DEFINER autenticadas, com search_path vazio e validação explícita de autorização. [Referência do aviso](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Funcionários e Inadimplência da etapa anterior foram conferidos no navegador com acesso OWNER ativo: cadastro/perfis/proteção do proprietário e faixas/estado vazio de atraso carregaram corretamente. Nenhum funcionário foi autorizado durante essa conferência.

Publicado no Easypanel em 05/10/2026 às 18:08:54 UTC, commit de implementação `846afda44f489ec0338fa11f1c1341fd1cb9fe6f`. TypeScript, 73 testes e build também passaram no servidor. Verificação online confirmou a ficha com perfil opcional, opções A/B/C/D, botão desabilitado enquanto não há alteração, campo de perfil junto aos juros no novo contrato e indicação Sem classificação no contrato antigo, preservando os valores anteriores. Nenhum contrato foi criado nessa conferência; dados de veículo digitados para navegar na prévia não foram salvos.

Um cadastro de teste com perfil Vendedor foi preenchido e revisado na tela de Funcionários, aguardando confirmação final da autorização. Ainda não foi concedido acesso ou enviado convite. Recebimento do e-mail e criação da senha pelo destinatário continuam pendentes.
