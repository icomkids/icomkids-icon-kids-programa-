# ICOM Bank — comprovantes e recebimentos

Dados de recebimento confirmados pelo OWNER foram salvos e verificados no Supabase em 05/10/2026. Dados reais ficam somente no banco, editáveis nas configurações. Nenhuma transferência foi realizada.

Abra um contrato e escolha **Ver parcela / comprovante**. A parcela apresenta o saldo, a chave Pix e os dados da conta. O usuário interno pode anexar JPG, PNG ou PDF até 10 MB e informar o valor do comprovante. O cliente ainda não tem um portal de pagamentos nesta etapa.

O envio deixa a parcela **COMPROVANTE ENVIADO** e não gera pagamento. OWNER, ADMIN, GERENTE e FINANCEIRO podem baixar o arquivo privado, conferir o recebimento no extrato e aprovar com a data efetiva, ou recusar com motivo. VENDEDOR envia para seus próprios contratos, acompanha seus envios e não aprova. Usuários inativos e anônimos não acessam os arquivos.

A aprovação registra pagamento, valor pago, data e responsável em uma transação com auditoria. A última parcela aprovada quita o contrato. Repetir a mesma aprovação não duplica o pagamento. A data não pode anteceder a venda nem ser futura. Nesta fase, apenas o saldo integral de uma parcela pode ser aprovado; divergências devem ser recusadas para correção. Pagamentos parciais, estornos e renegociações ficam para etapas posteriores.

Comprovantes ficam no bucket privado `icom-bank-documents`. Reserva autenticada gera caminho único, válido por 15 minutos. Upload sem sobrescrita usa JWT do usuário e política restrita ao remetente e à reserva. Finalização exige arquivo com MIME e tamanho correspondentes. Não há permissões de UPDATE/DELETE para os arquivos. Extensão, MIME, assinatura inicial, tamanho e hash SHA-256 são validados no servidor; o hash vincula tentativas repetidas ao mesmo arquivo. Arquivos são baixados pelo servidor autenticado, sem URLs públicas e sem tokens no navegador. Não há reconhecimento automático do conteúdo nem integração de confirmação com bancos.

Abas **Comprovantes** (filtros pendente/aprovado/recusado) e **Pagamentos** apresentam os dados reais. O total recebido usa a data efetiva do recebimento e só considera pagamentos aprovados. Os arquivos originais e os motivos de recusa permanecem no histórico da parcela.

Migrações: `20261005150506_icom_bank_private_proof_payments.sql` e `20261005150911_icom_bank_proof_index_cleanup.sql`. Nenhuma tabela de outros módulos foi alterada. RPCs SECURITY DEFINER usam search_path vazio, validação explícita de identidade/perfil, bloqueios transacionais e ausência de permissão anônima; tabelas financeiras continuam sem escrita direta autenticada.

Validação: 64 testes unitários passaram; TypeScript e ESLint passaram. Build Next completo passou em uma cópia limpa dos fontes, com todas as novas rotas geradas. O diretório de desenvolvimento antigo conserva um tipo gerado de uma prévia removida; essa cache não foi publicada e não existe na cópia limpa. Teste SQL transacional confirmou reserva, repetição segura, arquivo ausente, bloqueio de outro upload pendente, política de upload restrita, não sobrescrita, envio sem pagamento, recusa com motivo, rejeição de valor parcial/data futura, aprovação única, baixa da parcela, quitação ao final e auditoria. Bloqueou vendedor aprovador, usuário inativo, anônimo e escrita direta. Todas as fixtures foram revertidas. O teste Storage usou apenas metadados temporários dentro da transação; não representa um envio binário real pelo navegador.

Referência técnica: [controle de acesso do Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control). Upload comum exige INSERT; sobrescrita exige UPDATE, que não é concedido para comprovantes.

Advisor de segurança revisado: para o módulo, apontou as funções SECURITY DEFINER executáveis por authenticated. Esse acesso é intencional para a escrita atômica, com as restrições descritas e testadas acima. [Descrição do aviso no Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Pendências futuras: inadimplência detalhada, relatórios avançados, classificação interna de risco, alterações/estornos/renegociação e portal do cliente. A classificação registrada em `ICOM-BANK-PROXIMAS-ETAPAS.md` será manual e não consulta score.

Publicação e teste autenticado do envio binário ainda precisam ser confirmados antes de declarar esta etapa pronta em produção.