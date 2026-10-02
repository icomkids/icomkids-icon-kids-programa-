# Indicadores de qualidade e ranking visual

A gestão vê os quatro primeiros vendedores por pontos de qualidade no período dos atendimentos filtrados, com avatar genérico, iniciais, troféu/medalhas, pontos, média e volume. A tabela mantém todos os vendedores e seus indicadores. Empates compartilham colocação; sem avaliações, não se inventam vencedores.

O vendedor vê somente seu nome, avatar e seus dados, já filtrados e autorizados no servidor. Pode alternar entre mês atual (Brasília, pela criação do atendimento) e histórico. Não recebe nomes, posições ou avaliações de colegas.

Indicador: percentual de itens de qualidade com nota 4 ou 5, dividido pelo número de itens válidos respondidos. O resultado não é média dividida por cinco, nem percentual de clientes únicos. Itens ausentes não viram zero. Escalas ordinais de compreensão/documentação usam o mesmo mapeamento de 1 a 5 da pontuação.

Faixas internas: ótimo >=90%; bom >=80%; médio >=70%; ruim <70%. Verde escuro, verde, laranja, vermelho. Cinza significa sem avaliações. O cálculo das faixas usa a precisão original; o percentual visual é truncado a uma casa decimal para não exibir 90% com categoria Bom. Poucos itens (<10) recebem aviso de resultado inicial, sem alegar precisão estatística. Notas 1 ou 2 geram aviso visual adicional. Esses avisos não disparam mensagens nem alteram os alertas existentes.

Referências consultadas: Qualtrics — https://www.qualtrics.com/en-au/articles/customer-experience/what-is-csat/ (CSAT usa respostas 4 e 5); Zendesk — https://www.zendesk.com/blog/customer-experience/loyalty/customer-loyalty/customer-satisfaction-score/ (bons resultados dependem do setor, usualmente faixa de 70 a 80 e poucos por cento). Os quatro cortes são metas internas da Icom, não uma certificação universal de atendimento.

Pontuação comercial não interfere na cor/qualidade. O ranking por soma considera também o volume de avaliações; a média e o percentual permitem avaliar qualidade com outros denominadores. DEMO, arquivados e respostas parciais são excluídos.

Verificação: testes de limites, notas positivas, notas baixas, itens ausentes/inválidos, exclusões, escalas ordinais e virada mensal em Brasília. Prévia com nomes e notas fictícios gerada diretamente dos componentes para conferir todas as cores, sem salvar dados ou enviar pesquisas.


Atualização 02/10/2026: novas notas internas de 0 a 10; positivas de 8 a 10, baixas de 0 a 4. Histórico na escala 5 convertido por multiplicação por 2 para médias e pontos, preservando os originais. Google permanece com 5 estrelas; NPS permanece 0 a 10. A escala é versionada por experiência; rascunhos antigos são convertidos uma única vez pelo servidor ao abrir a pesquisa.
