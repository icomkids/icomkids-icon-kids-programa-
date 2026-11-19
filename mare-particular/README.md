# Maré Particular — primeira versão

Aplicação exclusiva para um apartamento em Ubatuba. Código independente do Experiência, sem dependências npm em runtime. Node.js 24, HTML/CSS/JavaScript e SQLite nativo com transações.

## O que já funciona

- Página responsiva do apartamento e galeria de fotografias ilustrativas.
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

Endereços locais: `http://127.0.0.1:4317/` e `/proprietaria`. No modo demonstrativo, clique em **Explorar o painel demonstrativo**. Use exclusivamente dados fictícios: todos os avaliadores da demonstração podem acessar o mesmo painel.

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
- Regras sazonais por data, cupons, integração com canais, área autenticada do hóspede e reembolso automático são etapas posteriores.

## Verificação

Os testes verificam datas e tarifas, limites de hóspedes, disputa simultânea de disponibilidade, idempotência, acesso administrativo, preservação de preços, cancelamento, conflitos de bloqueio, expiração, persistência após reinício, origem das solicitações e autenticação fora do modo demonstrativo.

Fotografias de demonstração: Unsplash, IDs `photo-1600210492486-724fe5c67fb0`, `photo-1611892440504-42a792e24d32`, `photo-1510414842594-a61c69b5ae57` e `photo-1556912172-45b7abe8b7e1`. Não representam o apartamento real.
