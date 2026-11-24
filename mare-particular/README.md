# AP House Select — primeira versão

Aplicação exclusiva para um apartamento em Ubatuba. Código independente do Experiência, sem dependências npm em runtime. Node.js 24, HTML/CSS/JavaScript e SQLite nativo com transações.

## Prévia publicada

- Site: https://icom-mare-particular.pqaykh.easypanel.host/
- Proprietária: https://icom-mare-particular.pqaykh.easypanel.host/proprietaria
- Serviço `icom/mare-particular`, volume `mare-particular-data` em `/app/data`, HTTPS encaminhado à porta 3000.
- Publicação verificada em 19/11/2026: página pública, painel, API de saúde e solicitação/aprovação de reserva fictícia no navegador.
- Três testes automatizados aprovados (datas e preços; fluxo concorrente e persistência; autenticação).
- Layout conferido em desktop e 390 px. Registros de exemplo usam domínio `example.test`.
- Supabase pendente do acesso à conta Icom Kids. Pagamentos e e-mails desativados.

## O que já funciona

- Página responsiva do apartamento e galeria com as 19 fotografias reais enviadas pela responsável.
- Consulta de datas, seleção por calendário e cálculo de diárias por noite; sexta e sábado têm valores próprios.
- Solicitação de reserva com código, aceite registrado e valores congelados.
- Bloqueio transacional por noite: duas solicitações concorrentes não ocupam a mesma data. Saída não ocupa uma nova noite.
- Solicitações pendentes expiram em 24 horas; a liberação ocorre no próximo acesso à API.
- Painel: aprovação/cancelamento, busca, filtros, calendário e bloqueios manuais.
- Edição de apresentação, capacidade, valores, duração e regras.
- Histórico de ações, registros persistentes, sessão HttpOnly e validação no servidor.

## Rodar

```powershell
node server.mjs
node --test --test-isolation=none tests/reservations.test.mjs
```

Endereços locais: `http://127.0.0.1:4317/` e `/proprietaria`. O painel exige o usuário e a senha da proprietária, mesmo no modo demonstrativo. Use exclusivamente dados fictícios: todos os avaliadores da demonstração podem acessar o mesmo painel.

## Infraestrutura e isolamento

- GitHub Icom Kids: `icomkids/icomkids-icon-kids-programa-`.
- Branch exclusiva: `codex/mare-particular`; diretório `/mare-particular`.
- Serviço EasyPanel separado: `icom/mare-particular`; Dockerfile e porta 3000.
- Volume exclusivo: `/app/data`. Não compartilhar volumes ou variáveis secretas com o Experiência.
- Experiência: nenhuma alteração de arquivos, branch, serviço, domínio ou dados.
- Esta versão usa **SQLite em volume persistente exclusivo** para permitir avaliação funcional. **Ainda não está conectada ao Supabase**: a conexão disponível no chat não possui acesso ao projeto `swsfwthjxtqtkloexyjs`. Não reutilizar outro projeto por conveniência.
- Arquitetura prevista no Supabase: tabelas próprias `mp_*` ou schema dedicado, RLS e permissões explícitas. A migração exige inspeção do banco real e acesso à conta da Icom Kids. Não há migrations remotas aplicadas por esta entrega.

## Publicação no EasyPanel

1. Criar App `mare-particular` dentro de `icom`.
2. Source: repositório acima, branch `codex/mare-particular`, Build Path `/mare-particular`.
3. Builder Dockerfile; porta interna 3000.
4. Environment: `DEMO_MODE=true`, `SECURE_COOKIES=true`, `HOST=0.0.0.0`, `PORT=3000`, `DATA_DIR=/app/data`.
5. Criar volume próprio montado em `/app/data` antes de utilizar a prévia.
6. Usar o domínio HTTPS próprio gerado para o serviço. Não alterar a rota do Experiência.
7. Deploy manual. Confirmar `/api/health`, página pública e painel.

## Antes de receber hóspedes reais

O modo demonstrativo está ativo deliberadamente. Não basta ocultar a faixa de demonstração para lançar a operação.

- Confirmar capacidade, localização, comodidades, fotografias, preços e políticas reais com a proprietária.
- Conectar o Supabase correto e testar as políticas de isolamento, concorrência e recuperação de dados.
- Definir autenticação individual da proprietária. A senha de administrador oferecida pelo servidor é uma alternativa inicial; configure-a exclusivamente no ambiente e nunca no repositório.
- Integrar pagamentos e notificações autenticadas. Aprovar uma reserva **não registra pagamento**.
- Configurar envio de e-mails, privacidade e retenção dos dados; os formulários atuais são apenas demonstrativos.
- Configurar backup e recuperação. Uma única instância grava no SQLite; não aumentar réplicas nesse modo.
- Cupons, integração com canais, área autenticada do hóspede e reembolso automático são etapas posteriores.

## Verificação

Os testes verificam datas e tarifas, limites de hóspedes, disputa simultânea de disponibilidade, idempotência, acesso administrativo, preservação de preços, cancelamento, conflitos de bloqueio, expiração, persistência após reinício, origem das solicitações e autenticação fora do modo demonstrativo.

Fotografias de demonstração: Unsplash, IDs `photo-1600210492486-724fe5c67fb0`, `photo-1611892440504-42a792e24d32`, `photo-1510414842594-a61c69b5ae57` e `photo-1556912172-45b7abe8b7e1`. Não representam o apartamento real.


## Atualização das fotos em 24 novembro 2026

As 19 fotos reais recebidas foram incluídas na galeria, com filtros por ambiente, nova capa da área externa, fotos dos quartos e atualização do painel. As imagens foram preparadas para web sem alterar as cenas; os arquivos originais permanecem na pasta de origem. Os avisos de fotos ilustrativas foram retirados. Preços, capacidade e regras continuam sujeitos à confirmação. Nome definido pelo usuário: AP House Select.

Esta publicação modifica apenas arquivos de apresentação e imagens na branch `codex/mare-particular`. Não ativa a integração Supabase preparada na outra branch.

## Painel administrativo — 24/11/2026

- Acesso em `/administrador` ou `/proprietaria`; a demonstração permite explorar com dados fictícios. Em operação, as duas rotas usam a autenticação administrativa do servidor.
- Visão geral: valor de reservas confirmadas, saldo a receber, recebimentos líquidos manuais, reservas pagas/parciais, hóspedes, pendências, cancelamentos e ocupação confirmada.
- Relatórios por mês: reservas seguem a data de entrada; recebimentos e reembolsos seguem a data do registro. A taxa de limpeza compõe o total; não há cálculo de lucro ou impostos.
- Calendário com preço por noite e situação de ocupação; consulta da reserva e ajuste de tarifa ao selecionar uma data.
- Tarifas básicas de domingo a quinta e sexta/sábado. Períodos inclusivos para baixa/alta temporada, feriados, eventos e datas específicas. Prioridade: específica > evento > feriado > temporada > básica; sobreposição na mesma prioridade é rejeitada. O maior mínimo de noites de uma estadia prevalece.
- Preço calculado no servidor no orçamento e na criação da reserva. Reservas existentes preservam o valor e as condições aceitas.
- Livro manual de recebimentos e devoluções, com parciais, forma, data, referência, observação, proteção contra duplicidade e histórico persistente. Não movimenta dinheiro. Cancelamentos com valores recebidos ficam a conciliar; a política deve ser verificada antes de devolver valores.
- Novas tabelas SQLite independentes: pricing_rules e payment_entries, criadas sem alterar as reservas existentes. Não ativa a integração Supabase pendente.
- Seis testes aprovados, incluindo prioridade de preços, mínimo de noites, concorrência de recebimentos, cancelamento, reembolso, privacidade e persistência.

## Acesso protegido e checkout — 24/11/2026

O painel exige usuário e senha mesmo em demonstração. O primeiro cadastro usa uma capacidade aleatória de uso único e validade de 30 minutos, exibida somente no log privado do serviço. Depois de provisionado, o endpoint inicial é desativado. Senhas são armazenadas com scrypt e salt aleatório; sessões opacas persistem somente como hash, expiram em 8 horas e são revogadas na troca de senha. A senha inicial exige troca no primeiro acesso. Não versionar arquivos de acesso.

Checkout Asaas preparado para Pix e cartão à vista em página hospedada. Configuração exclusiva AP_ASAAS_API_KEY, AP_ASAAS_WEBHOOK_TOKEN, AP_ASAAS_MODE e AP_PUBLIC_URL; habilitação explícita AP_PAYMENTS_ENABLED=true. Cobranças de produção também exigem DEMO_MODE=false. A publicação inicial mantém pagamentos desativados até validar a conta da proprietária.

Webhook: POST /api/payments/asaas/webhook, autenticado pelo header asaas-access-token. Assinar CHECKOUT_PAID, CHECKOUT_CANCELED, CHECKOUT_EXPIRED, PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED e eventos de contestação. A fila é persistida antes do HTTP 200 e consulta o estado real do pagamento pela API. Eventos duplicados não duplicam o recebimento. Valores, checkout e referência são conferidos; o retorno do navegador não confirma pagamento.

O hóspede acompanha em /pagamento com capacidade secreta guardada somente na sessão do navegador, sem token na URL. O checkout reserva as noites por 30 minutos. Pagamentos tardios com conflito de disponibilidade são registrados no financeiro e sinalizados para conferência, sem sobrepor outra reserva. O painel atualiza os indicadores a cada 30 segundos quando não há edição em andamento. Devoluções são sincronizadas após efetivadas no provedor; não há disparo automático de reembolsos.

Validação: onze testes de integração locais, com provedor simulado para Pix/cartão, duplicidade, webhook falso, valor divergente, reinício, reembolso e pagamento tardio. A homologação no sandbox real e um teste de ponta a ponta dependem das credenciais da proprietária. Não confundir esses testes simulados com pagamentos reais aprovados.
