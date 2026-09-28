# ADHONEP Expansão – Taubaté

Implementação de 28/09/2026 no site estático existente, em `adhonep/`. Não é uma nova aplicação React nem um painel paralelo. Este relatório registra o estado anterior à publicação no `main`; a publicação foi solicitada posteriormente. As referências do Git indicam a revisão publicada.

## Estado da entrega

- Página e integrações implementadas no código local. Nenhum commit ou push para `main` foi feito nesta tarefa.
- Duas migrations aplicadas no projeto Supabase `swsfwthjxtqtkloexyjs` e Edge Function `register-adhonep-expansion` publicada, com verificação de JWT habilitada.
- Persistência real, idempotência, consentimento, permissões de serviço e RLS testados em transação revertida, sem contatos de teste permanentes e sem enviar e-mail.
- **Primeiro acesso por e-mail ainda não liberado para produção:** a lista atual de redirects do Auth não inclui os destinos ADHONEP. Foi solicitada autorização ao responsável para adicionar somente os destinos necessários, preservando Icomkids e o Site URL compartilhado. Não alterar o Site URL global para resolver isso.
- Entrega real de e-mail e o fluxo completo em produção ainda precisam ser homologados após essa liberação e a publicação do frontend.
- Não foi encontrado convite oficial de grupo WhatsApp nem política de privacidade publicada no material inspecionado. Configuração preparada, sem número ou QR fictício.

## 1. Rota

`/expansao`, também acessível como `/expansao.html`. Nginx e Netlify reescrevem a rota para a página estática. `/expansao/` redireciona para a rota sem barra final no Nginx.

Prévia local: `http://127.0.0.1:8767/expansao`. O servidor local normal não substitui a necessidade de publicar os arquivos para testar o e-mail no domínio autorizado.

## 2. Arquivos criados

- `adhonep/expansao.html`: hero, 13 perguntas, e-mail obrigatório, estados de erro/sucesso e bloco de conexão.
- `adhonep/expansion.css`: layout independente, responsivo e acessível.
- `adhonep/expansion-schema.js`: validação compartilhada entre navegador e backend; opções e normalização.
- `adhonep/expansion.js`: formulário, confirmação de identidade, restauração e atualização do mesmo cadastro.
- `adhonep/expansion-config.js`: configurações públicas de WhatsApp, QR e política de privacidade.
- `adhonep/admin-expansion.js` e `admin-expansion.css`: listagem, filtros, detalhes e atualização de status no painel atual.
- `supabase/functions/register-adhonep-expansion/index.ts`: entrada autenticada, validação e persistência segura.
- As duas migrations indicadas abaixo.
- `tests/expansion.test.mjs`, `tests/expansion-database.sql` e `tests/expansion-preview.mjs`.
- `eslint.adhonep.config.mjs` e este relatório.

## 3. Arquivos modificados

- `adhonep/admin.html` e `admin.js`: nova seção, carregada somente quando aberta.
- `adhonep/membros.html`: cadastro, acesso por e-mail e link para o perfil de networking. Link fora do cabeçalho para não apertar o mobile.
- `adhonep/portal-auth.js`: botão opcional de magic link para contas existentes, sem remover login por senha, recuperação ou convites.
- `adhonep/portal-entry.js`: versão atualizada do módulo administrativo.
- `adhonep/members.js`: versão do import de autenticação para evitar cache antigo no novo acesso por e-mail.
- `adhonep/index.html`: link no rodapé para o cadastro.
- `adhonep/nginx.conf`, `netlify.toml` e `sitemap.xml`: rota e descoberta.
- `supabase/config.toml`: configuração reproduzível de JWT da nova função.
- `package.json`: comandos de lint específico e testes ADHONEP; nenhuma nova dependência de produção.
- `.gitignore`: ignora cache local de npm.
- `tests/public-preview-server.mjs`: rota curta na prévia.

Alterações preexistentes em `docs/adhonep-performance-2026-09-25.md` e `.preview-server.mjs` foram preservadas e não fazem parte desta implementação.

## 4. Tabelas e colunas

Reutilizadas: `auth.users`, `adh_profiles`, `adh_chapters`, `adh_leads` e `adh_notification_subscriptions`.

Os dados comerciais ficam em `adh_leads`, ligados ao membro por `user_id`. Reutilizados `name`, `email`, `whatsapp`, `company`, `city`, `chapter_id`, `source_page`, `status`, `consent_at`, `created_at` e `updated_at`.

Adicionados: `user_id`, `job_title`, `business_sector`, `business_sector_other`, `whatsapp_normalized`, `instagram`, `main_product_service`, `average_ticket`, `networking_goals`, `desired_connections`, `marketing_opt_in`, `business_description`, `origin` e `submission_fingerprint`.

Origem: `adhonep_expansao_form` / `ADHONEP Expansão Taubaté`; status inicial usa o padrão existente `new`. O capítulo é resolvido pelo backend como Taubaté/SP ativo, nunca aceito do formulário. Cadastrar um perfil não publica automaticamente um anunciante no marketplace.

## 5. Migrations

1. `20260928201433_adhonep_expansion_registration.sql`: colunas, FK, constraints, índices parciais únicos por usuário/e-mail/telefone, índices para listagem, policies e RPC atômica.
2. `20260928203627_expansion_trusted_identity.sql`: ajusta a RPC às permissões reais de `service_role`. A identidade já é verificada via Auth pelo backend; não amplia acesso à tabela `auth.users`.

A função SQL é `SECURITY INVOKER`, executável apenas por `service_role`. Usuários comuns e anônimos não podem chamá-la diretamente. Leitura: próprio cadastro ou administrador autorizado do capítulo. Edição direta: somente coluna `status`, por administrador autorizado. Nenhuma chave privada foi adicionada ao frontend.

## 6. Criação e associação ao membro

O Auth atual exige e-mail; por isso o formulário o solicita junto do WhatsApp.

1. Usuário conectado e com e-mail confirmado envia diretamente ao backend.
2. Visitante solicita um link do Supabase Auth (`signInWithOtp`, criação permitida). Uma conta já existente com esse e-mail é reutilizada.
3. Respostas aguardam confirmação no armazenamento local do mesmo navegador, com validade lógica de uma hora, informada na página. Não se mostra sucesso de gravação antes da confirmação.
4. Após o link, o backend verifica a sessão com `Auth.getUser`, exige e-mail confirmado e salva os dados associados ao ID autenticado.
5. Link aberto em outro navegador não recupera o rascunho daquele dispositivo: a página explica e pede preenchimento novamente.
6. O perfil de membro existente e seu papel não são sobrescritos. Se necessário, cria-se perfil com o papel padrão, sem promoção administrativa.
7. Reenvio idêntico retorna o mesmo cadastro; alterações têm intervalo mínimo de um minuto. Telefone associado a outra identidade exige revisão e não é usado como prova para juntar contas.

Não há senha inventada. O membro pode continuar usando sua senha existente ou solicitar link em `membros.html`; essa opção não cria novas contas. O acesso “Meu perfil de networking” reabre os dados para revisão.

## 7. Administração

No painel atual: **Cadastros da Expansão** (também no seletor mobile).

- Pesquisa por nome/empresa; filtros de cidade, ramo, ticket, objetivo e status.
- Lista de 25 registros por página, sem contagem exata pesada e sem polling.
- Detalhes com todos os campos, links de WhatsApp/Instagram, datas e consentimento.
- Status: Novo, Em contato, Qualificado, Concluído.
- Escopo do capítulo aplicado por RLS, não apenas pelo layout.
- As regras antigas de `dl` horizontal são neutralizadas somente nesta seção para evitar vazamento lateral no celular.

## 8. Configuração do WhatsApp

Em `adhonep/expansion-config.js`:

- `whatsappGroupUrl`: convite oficial HTTPS em `chat.whatsapp.com`.
- `whatsappQrImage`: caminho local em `assets/` para QR que codifique esse mesmo convite, caso fornecido.
- `privacyPolicyUrl`: política oficial já publicada, quando disponível.

Sem convite válido, o bloco oferece a comunidade e não exibe QR nem botão de grupo. Não substitui o convite por telefone de um empresário.

## 9. Homologação completa após publicar

Antes: aprovar e adicionar no Supabase Auth os endereços exatos abaixo à lista existente, sem remover outros domínios:

```
https://xn--adhonepexpanso-2hb.com.br/expansao.html?confirmar=1
https://xn--adhonepexpanso-2hb.com.br/membros.html
https://icom-adhonepage.pqaykh.easypanel.host/expansao.html?confirmar=1
https://icom-adhonepage.pqaykh.easypanel.host/membros.html
```

Preservar o Site URL global e os redirects Icomkids. O template do e-mail deve usar o link de confirmação fornecido pelo Auth, e o SMTP precisa estar operacional. A entrega real de e-mail não foi testada nesta tarefa.

Depois:

1. Publicar `adhonep/` pelo fluxo existente de hospedagem. Não publicar a raiz React como se fosse este site.
2. Abrir `/expansao` sem sessão e tentar formulário vazio: erros em português e foco no primeiro campo.
3. Usar e-mail controlado pelo responsável, preencher todos os campos, testar “Outro” e selecionar explicitamente Sim ou Não.
4. Enviar; abrir o e-mail no mesmo navegador; aguardar a confirmação de gravação.
5. Acessar área de membros, depois “Meu perfil de networking”: dados devem reaparecer.
6. Reenviar igual: não cria novo contato. Após um minuto, alterar um campo: atualiza o mesmo registro.
7. Entrar como administrador, abrir “Cadastros da Expansão”, localizar o registro, filtrar, abrir detalhes e atualizar status.
8. Verificar com conta sem permissão que dados de outra pessoa não são acessíveis.
9. Selecionar Não e conferir `marketing_opt_in=false` e inscrição de comunicação desativada.

O servidor `node tests/expansion-preview.mjs` usa apenas dados sintéticos locais em 8770 e exibe aviso permanente. Ele é exclusivo para QA, está fora de `adhonep/`, não envia e-mail e não faz parte do Docker da produção. **Não usar essa prévia como evidência de envio real.**

## 10. Verificações realizadas

- Lint específico da implementação: aprovado.
- Suite ADHONEP: 44 testes aprovados, incluindo validação, isolamento de identidade, regressões de CSS e 29 testes anteriores.
- `npm run build`: aprovado; inclui `tsc -b` e Vite da aplicação raiz. O site ADHONEP continua servido pelo Nginx, sem build React novo.
- `node --check` nos módulos administrativos/autenticação alterados: aprovado.
- Lint global: ainda falha em 75 erros e 6 avisos preexistentes no restante do projeto (React/hooks/exports e funções antigas). Não foram corrigidos indiscriminadamente nesta tarefa.
- Teste real transacional no Supabase: persistência com `service_role`, associação, reenvio idempotente, opt-out, limite de atualização, papel preservado, leitura/atualização do administrador e bloqueio de outra conta. Todos os dados temporários revertidos.
- Navegador isolado: obrigatórios, campo Outro, multisseleção, escolha Não, botão bloqueado no envio, sucesso após resposta, falha sem apagar respostas, restauração do rascunho no retorno de confirmação, detalhes/status no admin e link do membro.
- Responsividade: medidas reais de viewport de 360, 390, 430, 768, 1024, 1280, 1440 e 1920 px sem overflow horizontal na nova página. Campos e perguntas 9–11 em coluna no celular. Admin com detalhes abertos e toolbar do membro verificados em 390 px, sem overflow horizontal.
- Revisão visual desktop com a foto existente, preservando os rostos e a ordem real da foto: Noilton à esquerda, Bruno à direita. Nenhuma imagem gerada por IA nesta tarefa.

Os testes isolados e transacionais não substituem a homologação final de envio/recebimento de e-mail no domínio publicado.
