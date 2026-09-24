-- Patrocinador fornecido pelo capítulo ADHONEP Taubaté.
with taubate as (
  select id
  from public.adh_chapters
  where lower(city) = lower('Taubaté')
  order by created_at
  limit 1
)
insert into public.adh_businesses (
  chapter_id, name, slug, segment, headline, short_description, description,
  logo_url, cover_url, website_url, instagram_url, whatsapp, status, featured,
  offerings, differentials, service_area
)
select
  taubate.id,
  'Polar Ar Condicionado',
  'polar-ar-condicionado',
  'Climatização e ar-condicionado',
  'Conforto e qualidade de vida em qualquer estação.',
  'Há mais de 30 anos oferecendo venda, instalação, manutenção e higienização de ar-condicionado em Taubaté e região.',
  'A Polar Ar Condicionado é especialista em climatização e atua há mais de 30 anos atendendo residências, comércios e empresas de Taubaté e região. A empresa oferece soluções completas para criar ambientes mais frescos, agradáveis e eficientes, desde a escolha do equipamento até a instalação profissional, a manutenção preventiva e corretiva e a higienização. Com técnicos especializados, atendimento rápido e personalizado, trabalha com equipamentos de todas as marcas e prioriza segurança, qualidade e o melhor custo-benefício para cada cliente.',
  'assets/empresarios/polar-ar-condicionado/logo-polar-ar-condicionado.png',
  'assets/empresarios/polar-ar-condicionado/capa-servicos-polar.png',
  null,
  'https://www.instagram.com/polar_arcondicionado2021/',
  '5512981935517',
  'active'::public.adh_business_status,
  true,
  array[
    'Venda de equipamentos de ar-condicionado',
    'Instalação profissional e segura',
    'Manutenção preventiva e corretiva',
    'Higienização e limpeza completa',
    'Atendimento residencial, comercial e industrial'
  ],
  array[
    'Mais de 30 anos de experiência',
    'Técnicos especializados',
    'Atendimento de todas as marcas',
    'Serviço rápido, confiável e personalizado',
    'Produtos de qualidade e garantia'
  ],
  'Taubaté e região'
from taubate
on conflict (slug) do update set
  chapter_id = excluded.chapter_id,
  name = excluded.name,
  segment = excluded.segment,
  headline = excluded.headline,
  short_description = excluded.short_description,
  description = excluded.description,
  logo_url = excluded.logo_url,
  cover_url = excluded.cover_url,
  website_url = excluded.website_url,
  instagram_url = excluded.instagram_url,
  whatsapp = excluded.whatsapp,
  status = excluded.status,
  featured = excluded.featured,
  offerings = excluded.offerings,
  differentials = excluded.differentials,
  service_area = excluded.service_area,
  updated_at = now();
