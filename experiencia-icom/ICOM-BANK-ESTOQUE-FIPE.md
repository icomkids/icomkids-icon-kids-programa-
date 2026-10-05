# Estoque das trocas e referência FIPE

Marca, modelo, versão e ano/combustível são selecionados pelo catálogo. A consulta usa o provedor comunitário Parallelum, não uma API oficial da FIPE. O valor, código, mês de referência, data de consulta e identificadores do veículo ficam salvos no registro. Os preços negociados não são alterados pela consulta. Selecionar outro carro limpa a referência anterior. Edições do mesmo carro preservam a consulta histórica.

Disponível no Administrativo (venda, troca, retorno e custo vinculado a carro) e no cadastro de novos contratos. Cadastros anteriores continuam legíveis. Há cadastro manual sem FIPE para indisponibilidade do provedor. Não são enviados nomes, placas ou dados de clientes ao serviço de consulta; apenas identificadores públicos do catálogo.

Salvar uma venda com troca cria automaticamente um veículo vinculado à venda de origem. O primeiro estado é entrada prevista, aguardando quitação/débitos ou em preparação. O proprietário atualiza a situação; o sistema não confirma pagamentos bancários. Um carro disponível pode ser revendido, usando aquisição e custos de preparação realizados. A revenda realizada marca o carro como vendido. Arquivar essa venda libera novamente o carro; uma venda prevista de outro registro não desfaz a venda real.

Exemplo: valor negociado da troca R$ 50.000,00, com débitos de R$ 5.000,00. O crédito líquido é R$ 45.000,00; o custo de aquisição para revenda é R$ 50.000,00 (crédito líquido mais obrigações assumidas). Preparação de R$ 2.500,00 leva o custo a R$ 52.500,00, antes do custo do vendedor. Não repetir os débitos como preparação. Pagamentos dos débitos são saídas de caixa registradas separadamente.

Histórico, RLS e rotinas protegidas permitem acesso ao estoque financeiro apenas ao OWNER. Custos não podem ser alterados depois da revenda realizada; a venda de origem não pode ser arquivada ou ter os valores alterados enquanto houver lançamentos vinculados. As gravações têm controle de versão e as tentativas repetidas preservam o mesmo registro.

Validação em 05/10/2026: 91 testes automatizados; build Next/TypeScript; lint dos componentes e rotas alterados; consulta real Chevrolet Onix LT 2020 Flex (FIPE 004517-9, outubro de 2026); teste visual de seleção e limpeza da referência; teste transacional de origem, preparação, revenda, reversão, concorrência por versão e isolamento de perfis. Dados dos testes transacionais revertidos. Testes de interface usam exemplos e não registram vendas reais.

Os advisors identificam a RPC `icom_bank_update_stock` como SECURITY DEFINER executável por authenticated: uso intencional para evitar escrita direta nas tabelas, com verificação de OWNER ativo, search_path vazio e teste de rejeição de vendedor. Nenhuma política ausente foi apontada nas novas tabelas. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

Provedor: https://deividfortuna.github.io/fipe/v2/ — consulta externa sujeita à disponibilidade e limite do provedor, com cache no servidor e opção manual. Consulta oficial: https://veiculos.fipe.org.br/
