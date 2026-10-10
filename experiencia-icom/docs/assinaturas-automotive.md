# IA Bank Automotive: operação de assinaturas

O controle privado `/icom-bank/assinantes` pertence exclusivamente à conta de Bruno registrada em `ia_bank_platform_internal.owners`. Ser OWNER de outra loja não concede esse acesso. API e banco verificam a identidade; o menu não é a barreira de segurança.

## Modelo comercial

Mensalidade informada: **R$ 249,00**. Preços, planos mensais/anuais e dias de teste podem ser ajustados. O preço de um plano não reescreve o valor combinado com assinantes existentes. Cadastro manual acompanha interessados, testes, ativos, atrasados e cancelados. Não cancela contratos no provedor nem libera acessos de loja.

## Provedor recomendado

Para a primeira operação brasileira, Asaas atende recorrência em cartão e permite conciliação pelos eventos de pagamento. Não confundir recorrência com compra parcelada. Stripe oferece Billing e portal do cliente; Mercado Pago oferece planos de assinatura com checkout. A recomendação é pela adequação da operação, sem pressupor taxas menores.

- [Asaas — assinaturas](https://docs.asaas.com/docs/assinaturas)
- [Asaas — eventos de cobrança](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Asaas — autenticação de webhook](https://docs.asaas.com/docs/create-new-webhook-via-api)
- [Asaas — duplicidade de eventos](https://docs.asaas.com/docs/about-webhooks)
- [Stripe — assinaturas](https://docs.stripe.com/billing/subscriptions/overview)
- [Mercado Pago — planos](https://www.mercadopago.com.br/developers/pt/docs/subscription-plans/overview)

## Fluxo de caixa

MRR é receita mensal prevista dos cadastros ativos; um valor anual é dividido por 12. Não é caixa. CONFIRMED significa pagamento confirmado, ainda sem liberação; RECEIVED indica disponibilidade. O saldo apurado soma recebimentos de produção e desconta taxas conhecidas, estornos e custos pagos da plataforma. Não é consulta ao saldo bancário atual do Asaas. Taxas desconhecidas tornam saldo e resultado parciais. Sandbox fica fora dos valores reais. Casos de chargeback/estorno parcial ficam em revisão, sem inferir saldo disponível.

O relatório mensal usa a data de disponibilidade, a data do estorno e a data de pagamento dos custos. O histórico registra alterações sem guardar número de cartão, CVV, chave API ou payload bruto do provedor. Nenhuma tabela financeira existente da Icom é alterada.

## Integração preparada

Endpoint: `/experiencia-icom/icom-bank/api/plataforma/asaas/webhook`.

Configure `IABANK_ASAAS_API_KEY` no servidor e `IABANK_ASAAS_WEBHOOK_TOKEN` (32 a 255 caracteres sem espaços, segredo próprio, diferente da chave API). Selecione Asaas e ambiente na tela. API key e conta do provedor devem corresponder ao ambiente. O webhook verifica `asaas-access-token`, consulta a cobrança diretamente no provedor, aceita apenas assinatura em cartão, vincula pelo identificador externo e aplica um evento atomicamente. Eventos repetidos não criam pagamentos duplicados. Falhas retornam erro para permitir nova tentativa.

O módulo não cria cobranças no cartão, checkout público ou contas operacionais dos assinantes nesta fase. Para lançar comercialmente, concluir conta do provedor, checkout hospedado, gestão de cancelamento e testes de cobrança, renovação, falha, estorno e duplicidade. Essas funções precisam do provedor configurado.

## Separação das lojas antes da venda

O IA Bank atual é de uma única loja. Nunca inserir assinantes em `icom_bank_user_access` do banco da Icom. Antes de liberar a primeira loja externa, usar implantação isolada por loja ou implementar isolamento por organização em todas as tabelas, políticas, arquivos, filas, IA e WhatsApp, com testes cruzados de acesso. “Implantação isolada conferida” é um registro de acompanhamento, não um mecanismo de autorização.

## Operação privada

1. Criar/ajustar planos.
2. Cadastrar lojas interessadas e responsáveis.
3. Acompanhar status cadastral e implantação.
4. Registrar cobranças e custos manualmente até a integração ser validada.
5. Conferir recebimentos liberados e taxas.
6. Exportar relatórios mensais e assinantes em CSV.

Não há exclusão física de pagamentos; preservar histórico conciliado. O administrador da loja e vendedores não enxergam o controle da plataforma.
