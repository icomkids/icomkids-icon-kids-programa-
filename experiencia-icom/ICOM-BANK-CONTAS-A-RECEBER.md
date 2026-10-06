# ICOM Bank · Contas a receber

Rota: `/experiencia-icom/icom-bank/administrativo/contas-a-receber`. Área exclusiva OWNER, com leitura protegida por RLS e escrita por funções que verificam o proprietário.

## Uso

- Administrativo → Contas a receber. Agenda diária, atrasos, hoje, próximos 7 dias e mês; filtros cliente, banco e cartão.
- Vendas com dados completos geram automaticamente o saldo: preço − troca líquida − dinheiro recebido na venda. Troca líquida = avaliação − IPVA − multas − quitação.
- Data de recebimento prevista não é presumida: defina o vencimento da venda nesta tela. Vendas antigas com dados insuficientes são sinalizadas para conferência. Saldo zero não gera cobrança.
- Outros recebimentos podem ser cadastrados manualmente. Parcelas contratuais continuam em Parcelas; não recadastre aqui a mesma obrigação.
- Recebimento total ou parcial exige confirmação manual do dinheiro já recebido. Cria uma ENTRADA realizada da loja; o valor recebido originalmente na VENDA permanece intacto.
- Uma ENTRADA realizada já lançada pode ser vinculada se valor, data e forma coincidirem; nenhuma segunda entrada será criada.
- Histórico → Desfazer recebimento exige motivo, arquiva a entrada e reabre o saldo. O registro anterior não pode ser editado, reutilizado ou restaurado isoladamente.
- Contas manuais sem recebimentos ativos podem ser arquivadas e restauradas. Contas de venda acompanham sua origem. Valores da origem são protegidos enquanto há recebimentos ativos; desfaça os recebimentos antes de corrigi-los.

## Validação

107 testes unitários; lint; build Next/TypeScript. Migração aplicada junto a testes SQL de recebimentos, débitos de veículos e despesas pessoais/loja em subtransações com rollback, sem deixar dados de teste no caixa. Teste visual isolado cobriu cadastro com data, valor brasileiro, recebimento parcial, correção e agenda; celular sem overflow horizontal da página.

Três tabelas privadas têm RLS e somente SELECT para authenticated; anon sem privilégios. RPCs authenticated SECURITY DEFINER são intencionais e verificam OWNER antes de qualquer acesso. Testes SQL negaram leitura e quatro operações a todas as contas ativas de funcionários. Aviso do advisor sobre funções SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Outros avisos de módulos já existentes do projeto compartilhado não foram alterados.
