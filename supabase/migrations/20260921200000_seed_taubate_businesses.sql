-- Five marketplace profiles supplied by the ADHONEP Taubate chapter.
-- The chapter is resolved by city so this seed is portable across environments.
with taubate as (
  select id
  from public.adh_chapters
  where lower(city) = lower('Taubaté')
  order by created_at
  limit 1
), supplied (
  name, slug, segment, headline, short_description, description,
  logo_url, website_url, instagram_url, whatsapp, featured,
  offerings, differentials, service_area
) as (
  values
  (
    'Foco Global Internacionalização', 'foco-global-internacionalizacao',
    'Internacionalização e planejamento patrimonial',
    'Expanda fronteiras com estratégia, segurança e compliance.',
    'Soluções para internacionalização de pessoas, empresas e patrimônios.',
    'A Foco Global oferece soluções integradas para pessoas, famílias e empresas que desejam construir uma presença internacional com planejamento e segurança. A atuação reúne abertura e gestão de empresas nos Estados Unidos, suporte contábil e fiscal, estruturas offshore, residência no Paraguai e processos de cidadania, com atendimento multilíngue e foco em compliance.',
    'assets/empresarios/foco-global.png', 'https://focoglobal.com.br/',
    'https://www.instagram.com/global.foco/', '5511934300444', true,
    array['Abertura e gestão de empresas nos EUA','Residência e internacionalização','Estruturas offshore e proteção patrimonial','Cidadania e mobilidade internacional'],
    array['Atendimento multilíngue','Planejamento estratégico','Suporte de compliance'],
    'Brasil e exterior'
  ),
  (
    'Crocí Alimentos', 'croci-alimentos', 'Alimentos',
    'Sabor, cuidado e proximidade em cada produto.',
    'Marca do setor de alimentos com atendimento direto e relacionamento próximo.',
    'A Crocí Alimentos integra o capítulo de Taubaté como uma marca dedicada ao setor de alimentos. Seu atendimento aproxima a empresa de clientes e parceiros, facilitando o contato para conhecer produtos, disponibilidade e condições de encomenda diretamente com a equipe.',
    'assets/empresarios/croci-alimentos.png', null,
    'https://www.instagram.com/crocialimentosoficial/', '5511960788265', false,
    array['Produtos alimentícios','Atendimento para encomendas','Contato direto com a marca'],
    array['Atendimento próximo','Identidade própria','Relacionamento com a comunidade'],
    'Taubaté e região'
  ),
  (
    'Body Joy', 'body-joy', 'Moda fitness',
    'Vista-se de energia. Vista Body Joy.',
    'Moda fitness que combina tecnologia, conforto, segurança e estilo.',
    'A Body Joy desenvolve e comercializa roupas fitness pensadas para acompanhar treinos e a rotina com conforto e confiança. O portfólio reúne tops, shorts, bermudas e leggings com recursos como compressão, tecidos de alta resistência, proteção UV50+, tecnologia Blackout e acabamentos que valorizam o corpo e a liberdade de movimento.',
    'assets/empresarios/bodyjoy.png', 'https://bodyjoy.com.br/',
    'https://www.instagram.com/bodyjoyfitness/', '551234261536', true,
    array['Tops e conjuntos fitness','Leggings, fusôs e shorts','Peças com proteção UV50+','Moda fitness feminina'],
    array['Tecnologia têxtil','Conforto e compressão','Design para treino e rotina'],
    'Taubaté e vendas online'
  ),
  (
    'ID Incorporação Digital', 'id-incorporacao-digital', 'Tecnologia imobiliária',
    'O futuro da incorporação é digital.',
    'Tecnologia para revelar o potencial de terrenos e ativos imobiliários.',
    'A ID Incorporação Digital simplifica etapas tradicionalmente complexas do desenvolvimento imobiliário. Sua proposta é usar tecnologia e inteligência para revelar o potencial de terrenos e imóveis, apoiar a estruturação de oportunidades e transformar ativos imobiliários em empreendimentos com mais clareza, agilidade e visão estratégica.',
    'assets/empresarios/incorporacao-digital.png', 'https://incorporacao.digital/',
    'https://www.instagram.com/incorporacao.digital/', null, true,
    array['Análise de potencial imobiliário','Estruturação de empreendimentos','Tecnologia aplicada à incorporação','Transformação de ativos imobiliários'],
    array['Processo digital','Visão estratégica','Simplificação da incorporação'],
    'Atendimento nacional'
  ),
  (
    'Estou em Dia', 'estou-em-dia', 'Organização financeira',
    'Mais clareza para colocar a vida em dia.',
    'Atendimento voltado à organização de compromissos e à busca de soluções para uma rotina mais tranquila.',
    'A Estou em Dia oferece um canal próximo de atendimento para pessoas que buscam mais organização, clareza e apoio para manter compromissos em ordem. A proposta da marca é tornar esse processo mais simples e acessível, com orientação individual e contato direto pelo WhatsApp.',
    'assets/empresarios/estou-em-dia.png', null,
    'https://www.instagram.com/estou.em.dia/', '5512981268860', false,
    array['Atendimento individual','Organização de compromissos','Orientação e acompanhamento'],
    array['Contato direto','Linguagem simples','Atendimento próximo'],
    'Taubaté e região'
  )
)
insert into public.adh_businesses (
  chapter_id, name, slug, segment, headline, short_description, description,
  logo_url, cover_url, website_url, instagram_url, whatsapp, status, featured,
  offerings, differentials, service_area
)
select
  taubate.id, supplied.name, supplied.slug, supplied.segment, supplied.headline,
  supplied.short_description, supplied.description, supplied.logo_url,
  supplied.logo_url, supplied.website_url, supplied.instagram_url,
  supplied.whatsapp, 'active'::public.adh_business_status, supplied.featured,
  supplied.offerings, supplied.differentials, supplied.service_area
from supplied cross join taubate
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
