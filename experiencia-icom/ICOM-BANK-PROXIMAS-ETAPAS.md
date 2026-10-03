# ICOM Bank — próximas etapas e decisões pendentes

## Ordem de trabalho

1. Configuração da chave Pix fixa; envio, análise e confirmação de comprovantes; pagamentos auditados. Nenhuma API bancária ou boleto.
2. Edição/cancelamento controlados, relatórios e gestão de acessos, conforme validação do usuário.
3. Classificação interna de risco e taxa por cliente, solicitadas por Bruno em 03/10/2026 para implementação posterior, sem interromper a sequência atual.

## Classificação interna de risco — pedido registrado

A equipe realizará a análise fora da plataforma. O sistema não consultará score, Serasa, bancos ou serviços externos e não decidirá crédito automaticamente.

Bruno sugeriu inicialmente três opções, depois detalhou quatro códigos: A para menor risco, B para intermediário, D para cliente com restrição e C para maior risco. Confirmar quantidade e ordem antes de implementar. Usar nomes neutros/profissionais, sem termos pejorativos, e deixar claro que a classificação é informada pela equipe.

Posicionar a seleção perto da taxa de juros no cadastro das condições. A taxa deve ser específica para o cliente/contrato e informada pela equipe. Não definir percentuais padrão nem aplicar alteração automática de taxa nesta fase. Confirmar se a seleção deve apenas informar o perfil ou sugerir uma taxa configurável, e se C/D terão ordem de risco distinta. A fala incluiu uma referência a taxa menor para maior risco, mas posteriormente especificou taxa maior: confirmar a regra antes de qualquer automação.

Preservar o perfil e a taxa usados em cada contrato para auditoria; mudanças futuras no cadastro não devem reescrever as condições de contratos já salvos. Restringir visualização e edição às permissões adequadas do ICOM Bank. Não armazenar relatórios de score ou documentos externos sem necessidade específica.

A menção a boleto foi contextual: não altera a regra atual de não implementar emissão de boleto ou integração bancária.
