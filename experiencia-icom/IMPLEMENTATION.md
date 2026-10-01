# Experiência Icom — estado da entrega

Código criado do zero em React 19, Next.js 16, TypeScript e CSS/Tailwind. Os scripts principais usam Next.js estável; as ferramentas opcionais de Sites foram herdadas do starter e não foram usadas para publicar esta aplicação.

## Implementado no código

- Página pública mobile-first, pesquisa por UUID v4, perguntas condicionais, notas, NPS e avaliação da liderança.
- API de progresso e conclusão, validação no servidor, bloqueio de duplicidade e gravação atômica com bloqueio de linha no PostgreSQL.
- Autenticação Supabase, lista explícita de usuários administrativos e permissão para feedback da liderança.
- Painel com indicadores, distribuição NPS, elogios, melhorias, filtros, busca, CSV, clientes, vendedores, liderança e evolução mensal.
- Criação de venda e experiência em transação, compartilhamento WhatsApp, QR Code PNG e impressão.
- Alertas automáticos e manuais, responsável, status, notas, timeline e logs administrativos.
- Configurações de textos, pesquisa ativa, Google e mensagem WhatsApp.
- Fluxo para criar a experiência DEMO de João da Silva, Jeep Compass 2025 e Vendedor Demonstração; separação dos indicadores reais.

## Verificado

- TypeScript sem erros.
- Lint do código da aplicação sem erros.
- 11 testes das regras passaram.
- Build final de produção Next.js passou após os últimos ajustes.
- Configuração Docker/Easypanel adicionada; build standalone passou. A imagem Docker ainda precisa ser construída no Easypanel.
- Página pública e login conferidos em navegador, incluindo largura de celular de 390 px, sem overflow horizontal.

## Ainda depende de configuração e validação

O destino de hospedagem escolhido é Easypanel. A organização Supabase indicada, `Icomkids' projects` (via Vercel), foi inspecionada no navegador e não contém projetos. A conexão Supabase disponível no chat não possui permissão nessa organização. Nenhum banco foi criado ou alterado. A migration foi gerada, mas não aplicada. Não há usuário administrativo provisionado nem experiência DEMO persistida. Não há publicação ou URL pública para clientes.

O fluxo completo autenticado, leitura/gravação em PostgreSQL, concorrência de respostas, RLS, geração de alertas e permissões precisa ser testado com o banco conectado antes do uso real. A apresentação visual das telas internas com dados também precisa ser verificada após a configuração. Não tratar este código como produção homologada antes desses testes.

## Arquivos da aplicação

- `app/experiencia/page.tsx`, `app/experiencia/[token]/page.tsx`: acesso público.
- `app/admin/experiencia/page.tsx`, `app/admin/experiencia/[section]/page.tsx`: painel.
- `app/api/auth/route.ts`, `app/api/admin/route.ts`, `app/api/experience/[token]/route.ts`: APIs.
- `components/Survey.tsx`, `components/Admin.tsx`, `components/QrCode.tsx`: interfaces.
- `lib/experience.ts`: tipos, perguntas, validação, alertas e analytics.
- `lib/server.ts`: acesso ao banco e autorização.
- `app/icom.css`, `app/layout.tsx`, `app/page.tsx`: estilo, identidade e entrada.
- `tests/experience.test.ts`: regras de negócio.
- `supabase/migrations/20261001171425_experience_icom.sql`: migration gerada pelo CLI oficial.
- `db/experience-schema.sql`: cópia de consulta da migration; não aplicar separadamente.
- `.env.example`, `README.md`: configuração e operação.
- `Dockerfile`, `.dockerignore`, `DEPLOY-EASYPANEL.md`: implantação no Easypanel.
