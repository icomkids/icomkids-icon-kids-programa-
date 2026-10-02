# Fechamento da venda e pontuação

Depois do cadastro e processamento do envio, o vendedor abre a etapa interna obrigatória. A pesquisa do cliente e o agendamento não são bloqueados. Fechamentos incompletos ficam na aba Fechamentos e podem ser retomados após logout ou recarga. Somente atendimentos novos exigem fechamento; o histórico não recebe respostas inventadas.

Origem obrigatória: porta/loja, próprio ou internet. Cada origem preenchida soma 1 ponto. Cautelar vendido, retorno cheio, documentação cheia e vídeo de feedback: cada Sim soma 1 ponto, Não soma zero. O vídeo exige autorização do cliente para divulgação. Respostas são autodeclaradas, imutáveis pelo vendedor e gravadas uma única vez; retries idênticos são idempotentes.

Qualidade do vendedor: notas de atendimento e transparência, 1 a 5 pontos cada. Gerente Luiz Lázaro: entrega, limpeza da loja, limpeza do veículo e participação do gerente, 1 a 5 cada. Sem nota não há ponto. NPS, comentários livres, respostas parciais, proprietário e experiência geral não são atribuídos arbitrariamente a um setor. DEMO e arquivados não pontuam.

Gestão → Vendedores exibe ranking de qualidade, média por item avaliado, número de respostas, pontos comerciais separados, total e pendências. O período segue os filtros dos atendimentos existentes (data de criação). Empates recebem a mesma colocação. Somar pontos considera o volume; a média permite comparar qualidade com denominadores diferentes.

Google mantém o convite voluntário no fim da avaliação. Não há comprovação automática de publicação e nenhum ponto é concedido por abrir o link. O vendedor não altera respostas do cliente.

Segurança: tabela com RLS e sem grants anon/authenticated. RPC exclusivo service_role valida usuário ativo e vínculo do atendimento; backend autentica antes de passar actor. Lock por atendimento impede duplicidades concorrentes; cadastro marca exigência atomicamente. Os dados de cada vendedor continuam filtrados no servidor. Testes do banco usam rollback sem envios reais.
