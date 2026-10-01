# Experiência Icom — estado da entrega

Publicado no Easypanel, serviço `icom/experiencia-icom`, usando o repositório `icomkids/icomkids-icon-kids-programa-`, branch `experiencia-icom`, pasta `/experiencia-icom`.

Endereço: https://sistema.icomkids.com.br/experiencia-icom

Painel: https://sistema.icomkids.com.br/experiencia-icom/admin/experiencia

## Implementado

- Pesquisa responsiva por token UUID, progresso automático, perguntas condicionais, notas e NPS. Inclui limpeza da loja, limpeza do veículo e origem do cliente, com campo para outra origem.
- Painel com indicadores, filtros, CSV, vendas, clientes, vendedores, liderança, alertas e histórico.
- QR Code e compartilhamento WhatsApp; configurações de textos e experiência DEMO.
- Login com contas existentes do Supabase e autorização explícita em `experience_users`. Perfil vendedor exige vínculo a `salespeople`; consulta apenas seus clientes e feedbacks, sem permissões de alteração ou acesso à liderança.
- Gestão de contas em Configurações: vínculo por e-mail, convite para novas contas e desativação. Contas da gestão não podem ser convertidas em vendedor.
- Recuperação de senha por e-mail pelo Supabase Auth com SMTP Resend existente.
- APIs com validação, acesso ao banco exclusivamente no servidor e regras de autorização.

## Banco e publicação

Supabase existente `icomkids`, referência `swsfwthjxtqtkloexyjs`. Migration `20261001171425_experience_icom.sql` aplicada após verificar ausência de colisões. Tabelas novas com RLS e sem acesso direto de anon/authenticated. Funções com SECURITY INVOKER e execução restrita. Contas owner existentes autorizadas no novo painel.

Rota específica do domínio encaminha `/experiencia-icom` para o novo serviço, preservando o prefixo. Chave service role configurada somente no ambiente do Easypanel; não incluída no código ou arquivo ZIP.

## Verificado

- TypeScript e lint sem erros; 19 testes das regras e de isolamento passaram.
- Build Docker/Next.js de produção passou no Easypanel.
- Pesquisa DEMO concluída pelo navegador; comentário e respostas persistidos.
- NPS 10 com nota geral baixa gerou alerta crítico, conforme regra.
- Transação de teste confirmou bloqueio de nova conclusão e ausência de duplicação.
- Login e recuperação carregam no domínio compartilhado.
- Pedido de recuperação aceito para o e-mail fornecido pelo usuário.

## Validação restante com o usuário

O usuário confirmou a redefinição de senha e login. Resumos por vendedor e veículo foram verificados em produção. Para ativar as contas de vendedores, é necessário informar os nomes e e-mails corretos; o cadastro e a entrega do convite ainda precisam ser validados com um destinatário autorizado. A aceitação de um envio não comprova entrega na caixa de entrada.

Migrations incrementais de acesso `20261001205656_seller_access.sql` e `20261001210141_seller_access_email.sql` aplicadas. Vínculo, desativação e proteção das contas da gestão verificados em transação revertida; nenhum vendedor foi ativado por esse teste.

`db/experience-schema.sql` é cópia de consulta da migration; não aplicar separadamente nem reaplicar a migration inicial.

