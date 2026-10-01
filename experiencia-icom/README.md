# Experiência Icom

Sua opinião nos leva mais longe.

Cada venda gera informação para melhorar a próxima venda.

## Estado

Aplicação implementada localmente. Banco Supabase ainda não vinculado, migration não aplicada, primeiro usuário ainda não provisionado. Consulte IMPLEMENTATION.md para validações e pendências. Nenhum dado fictício é utilizado como dado real.

## Rodar

Requer Node.js 24 e pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

No Windows, use Copy-Item .env.example .env.local. Se o ambiente bloquear subprocessos, use pnpm preview:local. O next.config.ts utiliza o compilador TypeScript pela API e workers por threads para compatibilidade com este ambiente; a verificação de tipos continua ativa.

Variáveis exclusivamente de servidor:

- SUPABASE_URL: URL do projeto escolhido.
- SUPABASE_SERVICE_ROLE_KEY: chave secreta do servidor, fornecida pelo Supabase. Nunca colocar em uma variável NEXT_PUBLIC, compartilhar ou versionar.

## Banco e migrations

Use um projeto Supabase dedicado. Para reutilizar outro projeto, analise suas tabelas antes: esta migration pressupõe um banco novo.

A migration inicial é supabase/migrations/20261001171425_experience_icom.sql, criada com supabase migration new experience_icom. Contém tabelas, índices, RLS, grants e funções transacionais. db/experience-schema.sql é apenas uma cópia para leitura.

Antes de usar CLI, consulte supabase --help, supabase link --help e supabase db push --help na versão instalada. Vincule o projeto explicitamente e aplique a migration pelo fluxo oficial. Para novas mudanças, use supabase migration new NOME; não altere migrations já aplicadas.

Tabelas:

- customers, salespeople, vehicles, sales: cadastro inicial e vendas.
- customer_experiences: cliente, vendedor, veículo, venda, token, datas, status e identificação DEMO.
- experience_responses: documento JSONB answers com os campos do questionário e NPS tipado; uma resposta por experiência.
- experience_alerts e experience_alert_events: tratamento e timeline.
- experience_users: whitelist administrativa, papel e permissão leadership_access.
- experience_settings: textos, Google, WhatsApp e ativação.
- experience_leadership: Luiz Lázaro e Bruno Lira.
- experience_audit_logs: eventos administrativos.

As tabelas têm RLS e não concedem acesso a anon/authenticated. O cliente utiliza somente APIs do servidor. A API valida o JWT no Supabase Auth e consulta a whitelist a cada chamada administrativa. Funções SQL são SECURITY INVOKER e executáveis somente por service_role. A leitura pública recebe somente primeiro nome, configurações públicas e a própria resposta. Telefone e dados internos não são retornados.

Conclusão e gravação usam SELECT FOR UPDATE para impedir submissões concorrentes duplicadas. Criação de venda e experiência ocorre em transação. Feedback da liderança é removido do resultado quando leadership_access é false.

## Primeiro acesso

Crie o primeiro usuário no Supabase Auth. Registre seu UUID confirmado em experience_users com nome, role owner, leadership_access true e active true. Não há cadastro público de administradores. Depois entre com seu e-mail e senha em /admin/experiencia. A sessão é mantida apenas na aba; quando expirar, entre novamente.

## Rotas

- / e /experiencia: apresentação e orientação para abrir o link individual.
- /experiencia/UUID: pesquisa do cliente.
- /admin/experiencia: visão geral.
- /admin/experiencia/avaliacoes, /alertas, /clientes, /vendedores, /lideranca, /relatorios, /configuracoes: seções do painel.
- /api/auth, /api/admin, /api/experience/UUID: APIs.

## Gerar experiência

1. Entre no painel e cadastre cliente, veículo e vendedor em Configurações.
2. Clique em Nova experiência, selecione os cadastros e informe compra, entrega, pagamento e troca.
3. Copie o link, abra a pesquisa ou baixe o QR Code PNG. Abra o detalhe para enviar pelo WhatsApp.
4. No WhatsApp, confirme o envio manualmente. O sistema registra a abertura do compartilhamento como pesquisa enviada; wa.me não fornece confirmação de entrega da mensagem.
5. O cliente responde e o servidor cria alertas quando necessário. A gestão registra o tratamento no detalhe da avaliação.

Para testar, clique Criar experiência DEMO nas Configurações e ative o filtro DEMO. O seed cria uma experiência sem respostas para testar o fluxo inteiro; não inventa indicadores. Os valores reais são calculados somente de respostas com NPS concluído.

## Google

Configure um link HTTPS em Configurações. O botão aparece ao concluir, independentemente da nota. Não existe bloqueio por satisfação.

## Regras

NPS = percentual de promotores (9–10) menos percentual de detratores (0–6). Passivos são 7–8. Resultado entre -100 e 100; sem respostas, a interface mostra um traço.

Notas 1 ou 2, documentação complicada, NPS detrator, pedido de contato ou registro manual criam alerta crítico. Passivos geram atenção. As avaliações do gerente/proprietário são opcionais por ramo, e perguntas desnecessárias são removidas no servidor.

O progresso é salvo a cada seleção, por debounce no comentário e por keepalive ao sair da página. Não há uso de localStorage como banco. Na falta de conexão, a página exibe erro e mantém as respostas enquanto aberta.

CSV exporta o conjunto filtrado e neutraliza células que possam ser interpretadas como fórmulas. Excel/PDF e API oficial do WhatsApp ficam para expansão futura.

## Verificar

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Os testes cobrem NPS, limites de classificação, notas baixas, documentação, contato, token inválido, ramos da liderança, validação, duplicidade e exclusão de rascunhos das métricas. Testes de integração no Supabase e homologação das telas administrativas ainda dependem do banco.

## Publicação

O destino de hospedagem definido é **Easypanel**. Consulte `DEPLOY-EASYPANEL.md` para configurar o repositório, o Dockerfile, a porta 3000 e as variáveis de runtime. O build standalone gera `.next/standalone/server.js`.

Não publicado. Escolha primeiro o Supabase e configure segredos e usuário. O cliente precisa de uma URL pública HTTPS; a área administrativa continua protegida por autenticação e whitelist. A prévia localhost serve apenas nesta máquina.
