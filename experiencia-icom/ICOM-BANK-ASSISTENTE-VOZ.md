# Assistente ICOM por voz

Ajuda global no canto superior direito do layout autenticado do ICOM Bank. Não é a conversa do Codex; é uma integração própria com a API da OpenAI, orientada pelo guia versionado em `lib/icom-bank/assistant-guide.ts`.

## Ativação

No serviço **experiencia-icom** do EasyPanel, configure **OPENAI_API_KEY** somente no ambiente do servidor e publique novamente. A chave não vai para o navegador, banco ou repositório. Ela deve pertencer a um projeto da API com acesso ao modelo Realtime e cota disponível; a assinatura do ChatGPT é separada. Modelo padrão `gpt-realtime-2.1-mini`, voz `marin`. Opcional: `OPENAI_REALTIME_MODEL` para um modelo compatível autorizado na conta. `ICOM_ASSISTANT_ENABLED=false` desliga novas conversas sem retirar o guia rápido.

Sem a chave o botão aparece e o guia rápido funciona, mas a interface informa **Voz aguardando ativação**. Não apresenta uma falsa conversa. Não use `NEXT_PUBLIC_` para credenciais.

## Uso e limites

1. Em qualquer tela autenticada, abra Assistente ICOM.
2. Leia o aviso de áudio enviado à OpenAI e clique Iniciar conversa; permita o microfone no navegador.
3. Faça uma pergunta sobre o uso do sistema. A resposta sai em áudio com texto de apoio.
4. Pause o microfone ou encerre. Fechar a janela, sair da página ou atingir cinco minutos desliga as faixas do microfone e fecha a conexão. A sessão também recebe um prazo de cinco minutos no servidor.

Integração WebRTC via `/v1/realtime/calls`, negociada pelo servidor. GET/POST/DELETE locais exigem sessão ICOM válida e perfil ativo atualizado. Mutações verificam Origin; corpo limitado a 65 KB. A sessão recebe somente o perfil, a área do menu e o guia permitido. Não lê clientes, saldos, documentos ou credenciais; não há ferramentas para executar operações. Não grava áudio ou transcrições no ICOM Bank. O texto de apoio fica na memória da tela e é apagado ao fechar. O processamento externo obedece às condições da API da OpenAI; não promete retenção zero no provedor.

As instruções delimitam o assunto ao projeto e negam pedidos fora do escopo. Instruções para IA não são uma garantia absoluta contra desvios; a separação de dados e a ausência de ferramentas evitam que uma resposta conceda acesso ou altere registros. Testar recusas antes de ampliar o uso.

Guardas operacionais por processo: uma conversa simultânea por usuário, intervalo mínimo de 15 segundos entre tentativas e até oito inícios por hora. Para múltiplas réplicas ou quotas financeiras rígidas, substituir por contador compartilhado. Reinício do processo limpa os contadores. Definir também controles de orçamento no projeto da API. Falhas do provedor nunca expõem mensagens brutas ou a chave.

## Verificação

Testes automatizados cobrem filtro por perfil, origem do contexto, payload de áudio, rejeição de configuração enviada pelo cliente, limites de corpo, concorrência, descarte de recursos, resposta sem credenciais e encerramento restrito ao dono da chamada. Build, TypeScript e lint devem passar.

Teste final após configurar a chave: administrador e vendedor, permissão de microfone negada, início, fala, resposta audível, pausa, interrupção, encerramento, navegação e fechamento. Perguntar sobre assunto fora do projeto e pedir para alterar saldo: orientar o uso ou recusar, sem executar ações. Sem chave e sem teste físico de áudio, a integração não deve ser anunciada como validada em produção.

Documentação oficial consultada em 07/10/2026:
- https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime
- https://developers.openai.com/api/docs/guides/voice-server-controls?voice-api=realtime
- https://developers.openai.com/api/reference/resources/realtime/server-events
- https://developers.openai.com/api/reference/resources/realtime/subresources/calls/methods/hangup
- https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini
