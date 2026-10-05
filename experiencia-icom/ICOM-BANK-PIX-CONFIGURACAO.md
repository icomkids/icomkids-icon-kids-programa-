# ICOM Bank — configuração de recebimento

Área Configurações agora contém tipo/chave Pix, titular, agência e conta corrente com dígito. É possível cadastrar posteriormente, alterar, copiar a chave atual ou removê-la com confirmação. Dados bancários e Pix são opcionais; não bloquearão o uso dos contratos.

Só OWNER/ADMIN alteram esses dados. Backend usa JWT, valida autorização, origem, tamanho e caracteres; gravação ocorre por RPC transacional com auditoria. Alterações concorrentes são rejeitadas usando a versão `updated_at`. Histórico registra responsável, horário e tipo de alteração sem duplicar chave e conta nos logs.

Sem API bancária, geração de Pix, transferência ou validação da titularidade pelo banco. A equipe deve conferir a chave na instituição de origem. Alterar a configuração não muda contratos ou confirma pagamentos. Dados reais de recebimento ficam no Supabase, nunca no código ou repositório.

Arquivos novos: `lib/icom-bank/settings.ts`, `components/icom-bank/BankSettingsForm.tsx`, página `app/icom-bank/(protected)/configuracoes/page.tsx`, API `app/icom-bank/api/settings/route.ts`, `tests/icom-bank-settings.test.ts`, teste SQL e este relatório. Alterados: servidor do ICOM Bank para mensagem de conflito; `package.json` para testes. Não houve alteração dos outros módulos.

Migrações: `20261003202854_icom_bank_pix_settings.sql`, `20261003203006_icom_bank_receiving_account_fields.sql`. Três colunas adicionadas somente à tabela do ICOM Bank; funções `icom_bank_set_pix` e `icom_bank_set_receiving_settings`. Escrita direta na tabela continua bloqueada; anônimos não executam RPC.

Validação: 61 testes passaram; TypeScript e ESLint passaram. Teste SQL autenticado confirmou cadastrar, alterar, remover, preservar os dados opcionais, registrar auditoria, rejeitar versão antiga, bloquear FINANCEIRO/VENDEDOR/anônimo e impedir update direto. Alterações de teste revertidas. Publicação executa novamente TypeScript, testes e build Docker.

O advisor identifica SECURITY DEFINER executável por authenticated, como esperado para essas operações atômicas: chamadas exigem identidade e perfil OWNER/ADMIN ativos, usam search_path vazio e negam acesso anônimo. Referência: [advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Publicação concluída em 03/10/2026 às 17h37 (Brasília). Build Docker passou com TypeScript e 61 testes. A tela autenticada foi conferida no domínio, com Pix ainda sem chave cadastrada. Dados de recebimento enviados por voz foram confirmados pelo usuário e salvos no Supabase em 05/10/2026.

Orientação Pix por parcela, comprovantes, análise e confirmação estão descritos em `ICOM-BANK-ETAPA-3.md`. Inadimplência detalhada continua para uma próxima etapa. Classificação interna de risco continua registrada para etapa posterior em `ICOM-BANK-PROXIMAS-ETAPAS.md`.
