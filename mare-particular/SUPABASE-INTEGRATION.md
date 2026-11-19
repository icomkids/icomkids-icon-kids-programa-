# Integração Supabase — preparada, ainda não ativada

## Estado em 19/11/2026

O usuário conectou a conta Icom Kids na sessão do navegador. O dashboard confirmou o projeto `swsfwthjxtqtkloexyjs`, organização Icom Kids, como **Unhealthy**. A consulta de inventário e uma consulta `select 1` falharam com `Connection terminated due to connection timeout`. O Health Advisor retornou `db_not_reachable`, `Database not usable`, `CONNECT_TIMEOUT` em 5001 ms. Também foi exibido um alerta de Disk IO Budget perto do esgotamento; isso não prova que o alerta seja a única causa.

Nenhuma criação de tabela, alteração de permissões, migração, cópia de segredo ou reinicialização foi executada. A prévia publicada continua em SQLite. A conexão MCP ainda lista outra conta; o acesso correto está disponível pelo navegador.

## Código preparado

- `supabase/schema.sql`: schema exclusivo `mare_particular`, tabelas próprias, RLS habilitada, acesso de tabelas negado a `anon`/`authenticated` e RPC `public.mp_dispatch` executável apenas pelo servidor com `service_role`. Não usa `SECURITY DEFINER` nem altera objetos do Experiência.
- `supabase-store.mjs`: acesso pelo servidor à API REST do projeto Icom Kids; timeout controlado e erros de conflito preservados. Nenhuma chave vai para o cliente ou para o repositório.
- `server.mjs`: backend selecionado explicitamente por `STORAGE_BACKEND=supabase`. Quando esse modo está ativo, falhas do banco não acionam fallback para SQLite.
- Importação transacional do arquivo SQLite já existente no volume, preservando IDs, códigos, preços aceitos, bloqueios e histórico. O marcador `sqlite-v1` impede repetir a importação em cada deploy. A ativação requer uma janela sem gravações e conferência dos registros antes/depois.
- Os testes locais continuam usando SQLite. Cinco testes automatizados passaram, incluindo falha de conectividade sem criação de banco alternativo. **O SQL e a integração real com Postgres ainda não puderam ser executados/validados.**

## Sequência para concluir

1. Recuperar a disponibilidade do banco compartilhado. O dashboard oferece **Fast database reboot**, que reinicia somente o banco; a decisão deve considerar os sistemas existentes que o utilizam. Pode ser uma recuperação temporária se persistir o esgotamento de recursos.
2. Confirmar `select 1` e inspecionar as tabelas/funções existentes. Verificar ausência de colisão com `mare_particular`/`mp_dispatch` antes de aplicar o SQL.
3. Aplicar o SQL versionado e conferir grants, RLS e proibição de execução por `anon`/`authenticated`.
4. Configurar a chave privada exclusivamente no ambiente do novo serviço do EasyPanel. Adicionar `STORAGE_BACKEND=supabase` e `SUPABASE_URL=https://swsfwthjxtqtkloexyjs.supabase.co`; não alterar as variáveis do Experiência.
5. Publicar a aplicação, conferir importação e contagens, testar reserva concorrente, aprovação, cancelamento e bloqueios no banco real. Confirmar `/api/health` com `storage: supabase`.
6. Atualizar README e registrar verificação. Pagamentos e e-mails continuam desativados nesta etapa.

## Referências

- [Diagnóstico de timeouts do Supabase](https://supabase.com/kb/troubleshooting/failed-to-run-sql-query-connection-terminated-due-to-connection-timeout)
- [Operações de disco](https://supabase.com/kb/troubleshooting/exhaust-disk-io)
- [Saúde do projeto Icom Kids](https://supabase.com/dashboard/project/swsfwthjxtqtkloexyjs/advisors/health)
