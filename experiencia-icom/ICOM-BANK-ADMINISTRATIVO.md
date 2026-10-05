# Administrativo — primeira versão baseada nos PDFs

Área exclusiva do OWNER, em `/icom-bank/administrativo`, dentro do mesmo módulo e repositório. Usa Supabase com JWT do usuário, autorização atual de membro ativo e RLS nas três novas tabelas. Nenhuma senha, dado pessoal ou valor de relatório foi incluído no código publicado.

## Telas e operações

- Fechamento por mês ou ano, entradas, custos e despesas pessoais separados.
- Vendas: data, carro, placa, vendedor, compra, custo do veículo, comissão, custo real, preço de venda, lucro, dinheiro recebido e troca.
- Custos loja, variáveis e pós-venda, com busca e filtro.
- Retornos por vendedor, carro e banco, tipos 1/2/3, financiado, valor bruto, imposto e repasses manuais.
- Trocas: pagamento, débito, documentação, CC, desconto, divisão e lucro por pessoa manuais.
- Contas mensais em grade de janeiro a dezembro. Descrições e dias visíveis no PDF são modelos privados; o usuário escolhe loja ou pessoal ao cadastrar.
- Despesas pessoais, incluindo contas mensais identificadas como pessoais.
- Cadastro, edição com versão, arquivo recuperável, restauração e exportação CSV compatível com Excel.

## Cálculos e limites

- Custo real = compra + custo do veículo + comissão. Lucro = preço de venda − custo real.
- Caixa considera o recebido explicitamente informado na venda, outras entradas e retornos brutos realizados. Não presume que preço de venda seja dinheiro disponível.
- Saídas da loja = custos e contas da loja realizados + impostos e repasses informados nos retornos realizados. Custos da venda calculam lucro; seus pagamentos são lançados em Custos da loja, evitando soma automática em duplicidade.
- Retorno líquido = bruto − imposto; parte da loja = líquido − gerente − vendedor. A metade do líquido é referência matemática, sem repasse automático. Regras de 70% e 90% aguardam esclarecimento.
- Trocas não movimentam caixa automaticamente; pagamentos e recebimentos devem ser lançados nas áreas correspondentes.
- Previsto e arquivado não entram nos totais realizados. “OK” sem valor permanece desconhecido e sinaliza total parcial. R$ 0 informado é diferente de valor ausente.
- Sem saldo bancário inicial ou conciliação automática. Entradas deste módulo não são importadas automaticamente de contratos, feedbacks ou pagamentos do ICOM Bank.

## Leitura dos documentos

Os cinco PDFs de planilhas foram lidos visualmente porque suas páginas são imagens. A referência privada preserva o fechamento original e indica a divergência entre seu subtotal e entrada menos saída. O período do fechamento está pendente. Os recortes de trocas e da grade anual não exibem todas as colunas. Valores e marcações históricas não foram transformados em lançamentos novos.

Os dois PDFs denominados comprovante têm SHA-256 idêntico e contêm um anúncio de veículo, não prova de pagamento. Nenhuma cobrança, venda ou pagamento foi gerado a partir deles.

## Persistência e verificação

Migração registrada: `20261005185819_icom_bank_administrative_ledger.sql`.

Entradas, referências e histórico detalhado são legíveis somente por OWNER ativo. Escrita direta é revogada. Duas RPCs verificam identidade e perfil atual, com `search_path` vazio, sem EXECUTE para PUBLIC/anon. Repetir uma criação com o mesmo identificador e payload não duplica; payload diferente ou versão desatualizada falha. Conta mensal ativa é única por nome, escopo e mês. Edição, arquivo e restauração preservam versões em histórico privado. A auditoria geral recebe somente a ação e o módulo, sem valores ou descrições pessoais.

Verificados: TypeScript, ESLint, build de produção e 81 testes automatizados. Testes SQL transacionais verificaram validação, RLS para todos os perfis, proprietário inativo, anon, escrita direta bloqueada, repetição, edição desatualizada, arquivo, restauração, histórico e duplicidade mensal; todos os dados de teste foram revertidos. Avisos do advisor para RPCs SECURITY DEFINER autenticadas foram revisados: são intencionais para impedir escrita direta e impor versão/histórico; a checagem de OWNER ocorre em cada chamada.

Referências de segurança: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e [advisor de funções autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
