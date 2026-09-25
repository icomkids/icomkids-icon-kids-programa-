# ADHONEP — investigação de desempenho (25/09/2026)

Projeto compartilhado: `swsfwthjxtqtkloexyjs` (`icomkids`), PostgreSQL 17, Nano/Free.

## Evidências observadas

- 8 empresas ativas: 6 com `featured=true`, 2 com `featured=false`. A listagem pública deve mostrar as oito, ordenando destaques primeiro.
- Painel: CPU 98%, RAM 69%; relatório de CPU mostrava 93,79%. Há um alerta crítico `CONNECT_TIMEOUT` no banco, apesar do rótulo geral `Healthy`.
- Amostra SQL: 16 conexões visíveis, limite 60, zero sessões bloqueadas e nenhuma consulta longa naquela amostra. Não foi demonstrado esgotamento das conexões.
- Banco com aproximadamente 269 MB. Relatório de objetos: `net._http_response` 164,83 MB (58,16%); `cron.job_run_details` 84,9 MB (29,96%). Não são cadastros de patrocinadores.
- Advisor confirmou **excessive bloat** em `net._http_response`.
- Estatística acumulada de limpeza de `net._http_response`: 182.231 chamadas, 132.718.521 ms totais, 728,30 ms de média e 1.062.608,44 ms de máximo. São contadores históricos, não uma medição de CPU exclusiva do último minuto.
- Logs de API das últimas 24h: `scheduled_messages` 1.008 respostas 200, 164 respostas 503 e 13 respostas 504; `adh_email_outbox` 192 respostas 200 e 4 respostas 503. `adh_businesses` teve 48 respostas 200 no recorte listado. Há atividades agendadas sem visitantes.
- Consultas diagnósticas subsequentes e a API pública também sofreram timeouts. Não executar consultas pesadas repetidamente durante a saturação.

## Falhas confirmadas no site

1. HTML com três empresas fixas, independente dos cadastros.
2. JavaScript substituía essa lista por um fallback só com a Polar antes de receber o banco.
3. Carregamento dos empresários dependia de uma consulta prévia de capítulos; homepage consultava capítulos duas vezes e eventos duas vezes.
4. Diretório público importava o cliente de autenticação, mesmo para visitantes anônimos.
5. Falhas de agenda eram interpretadas como ausência de eventos.

## Correção implementada

- Removidas as listas fixas conflitantes. Homepage e marketplace usam a mesma origem pública.
- Três rotas Nginx estritamente GET/HEAD, anônimas e com campos/consultas fixos: empresas ativas, capítulos ativos e eventos publicados. Credenciais/cookies/argumentos do visitante nunca são encaminhados.
- Cache compartilhado por 60 segundos, lock contra consultas simultâneas e uso da última resposta válida durante indisponibilidade. Cache local público limitado a 24 horas; mensagens identificam dados desatualizados. Respostas de erro não são cacheadas como sucesso.
- Nenhum cache de membros, administradores, permissões, comissões ou dados privados.
- Eventos e próximo encontro derivam da mesma consulta; filtro por cidade não dispara novas consultas. Empresários carregam independentemente da agenda.
- Nenhuma alteração em RLS, funções de autenticação, tarefas agendadas ou dados dos outros projetos.

## Pendência de manutenção compartilhada

A evidência aponta a tabela técnica do pg_net como forte candidata à carga interna. Ainda é necessário medir a melhora após manutenção; não atribuir toda a CPU a ela sem essa comparação.

Reorganizar `net._http_response` pode bloquear temporariamente o worker de HTTP e atrasar disparos. Foi solicitada autorização antes de operar nessa tabela compartilhada. Não apagar a fila `net.http_request_queue`, não truncar históricos, não reiniciar a instância inteira e não desativar automações sem autorização específica.

Referências oficiais:

- https://supabase.com/docs/guides/observability/inspect
- https://supabase.com/docs/guides/database/extensions/pg_net
- https://github.com/supabase/pg_net/issues/166
- https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_use_stale
