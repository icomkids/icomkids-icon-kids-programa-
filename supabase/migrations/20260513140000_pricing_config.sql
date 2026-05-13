-- Icon Kids — tabela de precos configuravel
-- Seed das opcoes do tabuleiro de preco do parque (20/30/60 min) +
-- regra de cobranca por minuto excedente.

insert into public.system_settings (key, value) values (
  'pricing_config',
  jsonb_build_object(
    'tiers', jsonb_build_array(
      jsonb_build_object('minutes', 20, 'price_cents', 3500),
      jsonb_build_object('minutes', 30, 'price_cents', 4000),
      jsonb_build_object('minutes', 60, 'price_cents', 6000)
    ),
    'overage_per_minute_cents', 100,
    'overage_note', 'Apos o termino sera cobrado R$ 1,00 por minuto excedente. Fique atento.'
  )
) on conflict (key) do nothing;
