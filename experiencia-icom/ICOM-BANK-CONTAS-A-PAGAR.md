# ICOM Bank — contas a pagar das trocas

Rota: `/experiencia-icom/icom-bank/administrativo/contas-a-pagar`.
Entrada pelo botão **Contas a pagar** no Administrativo ou pelo vínculo de débitos em Veículos. Área exclusiva do OWNER, com autorização no servidor e no banco.

## Funcionamento

- Uma venda com troca e débitos gera uma conta por tipo com valor positivo: IPVA, multas e quitação. O banco da quitação vem da origem. Edições da origem sincronizam os débitos pendentes; pagamentos confirmados bloqueiam alterações financeiras ou troca de placa até a correção da baixa.
- Débitos anteriores são importados pendentes, sem inventar vencimentos ou pagamentos. Vendas previstas exibem obrigações previstas, com baixa bloqueada até a realização da origem.
- **Definir vencimento** salva data e observações, sem afetar o caixa. Data desconhecida permanece vazia e é sinalizada como não incluída na projeção mensal.
- **Confirmar pagamento** exige data entre a entrada do carro e hoje (São Paulo), forma de pagamento e confirmação explícita de pagamento realizado. A baixa integral cria um CUSTO de loja realizado e uma ligação permanente com a conta. Repetir a mesma solicitação não cria outra saída.
- **Vincular saída já lançada** reutiliza um CUSTO realizado e ativo da loja com mesmo valor, data e forma de pagamento, sem vínculo de preparação ou de outra conta. Não cria um lançamento adicional.
- Comprovante opcional em JPG, PNG ou PDF até 10 MB; validação de extensão, MIME, assinatura e tamanho. Reserva com hash SHA-256, envio pela Storage API para bucket privado e conclusão após conferir metadados. Acesso e download autorizados somente para OWNER. Arquivos são baixados como anexos, com `nosniff` e CSP sandbox.
- **Desfazer baixa** exige motivo e arquiva a saída vinculada, retirando-a dos totais. Conta volta a pendente; pagamentos e comprovantes anteriores permanecem no histórico. A saída corrigida não pode ser restaurada ou alterada separadamente no Administrativo.
- Todos os débitos pagos liberam um carro que estava aguardando quitação para **Em preparação**. Não marcam o carro automaticamente como disponível. Correção reabre a pendência; um carro já vendido mantém seu status de vendido.

## Valores e caixa

O valor negociado da troca antes dos débitos já corresponde à aquisição (crédito líquido ao cliente + obrigações assumidas). A baixa movimenta apenas o caixa: seus lançamentos **não** recebem `details.stock_id`, não aumentam a preparação e não repetem o débito no custo de aquisição.

O mês do pagamento é definido pela data efetiva da baixa, independentemente do mês da venda. O resumo separa caixa realizado e contas pendentes com vencimento no mês. A projeção é parcial: não inclui saldo inicial, outras obrigações, contas sem data, nem entradas futuras. Despesas pessoais continuam separadas.

O sistema registra confirmações manuais; não realiza transferências ou pagamentos bancários. Pagamentos parciais, despesas mensais/pessoais como obrigações e conciliação bancária não fazem parte desta etapa.

## Validação

- 96 testes unitários passaram, incluindo datas impossíveis/futuras, confirmação obrigatória, filtros e totais mensais, reutilização de saídas e ausência de custo duplicado.
- ESLint e build Next.js/TypeScript passaram; novas rotas reconhecidas.
- `supabase/tests/icom-bank-payables.sql` executado junto à migração, com todas as fixtures revertidas: geração de três tipos, origem prevista bloqueada, comparação de versões, baixa idempotente, saída protegida, origem paga protegida, reversão, restauração indevida bloqueada, reutilização de saída, reserva de comprovante e upload ausente recusado.
- RLS e RPCs testados para todas as contas ativas de vendedor/gerente: não acessam ou alteram contas, arquivos e históricos desta área.
- Prévia isolada com componente real: vencimento salvo, confirmação obrigatória, baixa, filtros, correção e recomposição do saldo; layout desktop e 390 px.
- Arquivos privados reutilizam o bucket e a integração de comprovantes já existentes. Nenhum comprovante fictício foi anexado a contas reais durante esta validação.
- Advisors: sem novos avisos de RLS ausente, chave estrangeira sem índice ou `search_path` aberto no módulo. Avisos de índices ainda não usados são esperados numa área nova. As cinco RPCs elevadas são intencionais, guardadas por identidade + OWNER e com execução pública/anon revogada; detalhes em [Authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Migração: `20261005212433_icom_bank_trade_payables.sql`. Nenhuma baixa foi realizada nas contas existentes pelo agente.
