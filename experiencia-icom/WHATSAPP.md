# Registro da integração anterior (01/10/2026)

O fluxo atual está em [WHATSAPP-VENDEDORES.md](WHATSAPP-VENDEDORES.md): gestão da chave e criação de instâncias pelo sistema, aba Meu WhatsApp e agendamento. As instruções abaixo registram a configuração manual anterior.

O envio automático pelo número do vendedor exige uma instância Uazapi própria, pareada ao WhatsApp dele. A sessão compartilhada já existente no Supabase não é usada como alternativa.

No servidor Easypanel, configure `ICOM_WHATSAPP_SELLERS` como JSON indexado pelo `salesperson_id`, com `url`, `token` e `phone` para cada vendedor. O token fica exclusivamente no ambiente do servidor. O número cadastrado deve ser o próprio número do vendedor; a consulta de status valida essa correspondência antes de enviar.

Depois de vincular a instância, o vendedor abre Cadastrar cliente → Conectar meu WhatsApp, segue o QR Code ou código de pareamento e atualiza a conexão. O cadastro exige o telefone brasileiro do cliente com DDD. Quando a sessão está conectada, salvar o cliente dispara a pesquisa. Enquanto não houver conexão, o cadastro continua funcionando e o painel informa que o envio está pendente, com a opção de abrir a conversa no WhatsApp.

O envio usa `/send/text`. Apenas uma tentativa por atendimento pode estar em processamento. Uma resposta com identificador de mensagem registra aceitação pelo provedor, sem afirmar entrega ou leitura. Erros definitivos permitem nova tentativa explícita. Timeouts e resultados sem identificador ficam em conferência e não são reenviados automaticamente. Dados de demonstração e avaliações já concluídas não recebem envios automáticos.

Investigação em 01/10/2026: `send-whatsapp` e `whatsapp-control` existem no Supabase. A consulta de status retornou a sessão Icom Motors Atendimento desconectada. Os segredos disponíveis são UAZAPI_BASE_URL e UAZAPI_TOKEN, sem token administrativo para listar/criar sessões. Não há vínculo de uma sessão a cada vendedor configurado neste aplicativo. É necessário acesso ao painel do provedor para confirmar o plano e provisionar/vincular as instâncias antes do teste real.

Verificação: 24 testes de aplicação, testes SQL com rollback de telefone, idempotência de cadastro, exclusão de envio simultâneo, registro de aceitação e restrição de execução ao servidor. Nenhuma mensagem foi enviada a clientes reais durante esses testes.
