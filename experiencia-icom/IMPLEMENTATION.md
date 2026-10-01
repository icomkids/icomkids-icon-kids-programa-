# Experiência Icom — estado da entrega

Publicado no Easypanel, serviço `icom/experiencia-icom`, usando o repositório `icomkids/icomkids-icon-kids-programa-`, branch `experiencia-icom`, pasta `/experiencia-icom`.

Endereço: https://sistema.icomkids.com.br/experiencia-icom

Painel: https://sistema.icomkids.com.br/experiencia-icom/admin/experiencia

## Implementado

- Pesquisa responsiva por token UUID, progresso automático, perguntas condicionais, notas e NPS. Inclui limpeza da loja, limpeza do veículo e origem do cliente, com campo para outra origem.
- Painel com indicadores, filtros, CSV, vendas, clientes, vendedores, liderança, alertas e histórico.
- QR Code e compartilhamento WhatsApp; configurações de textos e experiência DEMO.
- Login com contas existentes do Supabase e autorização explícita em `experience_users`.
- Recuperação de senha por e-mail pelo Supabase Auth com SMTP Resend existente.
- APIs com validação, acesso ao banco exclusivamente no servidor e regras de autorização.

## Banco e publicação

Supabase existente `icomkids`, referência `swsfwthjxtqtkloexyjs`. Migration `20261001171425_experience_icom.sql` aplicada após verificar ausência de colisões. Tabelas novas com RLS e sem acesso direto de anon/authenticated. Funções com SECURITY INVOKER e execução restrita. Contas owner existentes autorizadas no novo painel.

Rota específica do domínio encaminha `/experiencia-icom` para o novo serviço, preservando o prefixo. Chave service role configurada somente no ambiente do Easypanel; não incluída no código ou arquivo ZIP.

## Verificado

- TypeScript e lint sem erros; 15 testes das regras passaram.
- Build Docker/Next.js de produção passou no Easypanel.
- Pesquisa DEMO concluída pelo navegador; comentário e respostas persistidos.
- NPS 10 com nota geral baixa gerou alerta crítico, conforme regra.
- Transação de teste confirmou bloqueio de nova conclusão e ausência de duplicação.
- Login e recuperação carregam no domínio compartilhado.
- Pedido de recuperação aceito para o e-mail fornecido pelo usuário.

## Validação restante com o usuário

Confirmar recebimento do e-mail e concluir pessoalmente a definição da senha, se necessário. Validar login com sua conta e apresentação do painel autenticado, incluindo CSV e QR Code. A aceitação do pedido de recuperação não comprova entrega na caixa de entrada.

`db/experience-schema.sql` é cópia de consulta da migration; não aplicar separadamente nem reaplicar a migration inicial.
