# Garantia e indicações

A pesquisa começa obrigatoriamente pelas orientações de garantia. A conclusão é validada no servidor e no banco contra a versão vigente. O texto referencia o CDC, arts. 18, 24, 26 e 50; não inclui garantia contratual inventada nem renúncia a direitos.

Em **Configurações**, proprietário e administrador podem enviar MP4 de até 50 MB, conferir a duração (10–1.200 segundos) e salvar orientações adicionais. Arquivos enviados pelo painel recebem nomes únicos, sem sobrescrever versões anteriores. URLs externas devem permanecer disponíveis e não mudar de conteúdo. Sem vídeo publicado, a etapa registra leitura e declaração; não afirma reprodução de vídeo.

O player impede avanço no vídeo e velocidade acelerada. O servidor verifica o tempo decorrido e limita o crédito de reprodução. Ao sair da aba, a reprodução pausa. Isso registra telemetria e a declaração do cliente; não prova identidade, atenção ou compreensão absoluta. O cliente pode declarar **tenho dúvidas** e concluir a pesquisa: a gestão recebe um alerta. Os recibos guardam versão, texto, URL, duração, progresso e data de confirmação; **Garantia e indicações** permite consultar esses registros.

A indicação é opcional. **Agora** pede nome, telefone e confirmação de autorização da pessoa indicada. **Mais tarde** oferece consentimento separado para um único lembrete. Não há mensagem automática para o amigo indicado.

Após 24 horas, o lembrete é elegível para envio pelo número do vendedor responsável. Depende da configuração `ICOM_WHATSAPP_SELLERS` e de conexão com o número esperado. Sem conexão, aguarda por até sete dias; depois expira. O cliente pode voltar ao próprio link, indicar ou cancelar um lembrete pendente. Não há reenvio automático após aceitação, recusa ou resultado incerto. Aceitação do provedor não significa confirmação de entrega/leitura pelo destinatário.

O disparo usa Supabase Cron, Vault, Edge Function com autenticação própria e uma rota interna autenticada. O segredo do agendador e a chave de serviço não aparecem no cliente, respostas ou logs. As tabelas têm RLS e acesso direto negado a `anon`/`authenticated`; apenas o servidor acessa registros após validar o vínculo do link ou a autorização da gestão. Os testes de banco rodam em transação com rollback.
