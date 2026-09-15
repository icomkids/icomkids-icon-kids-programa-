insert into public.adh_businesses (chapter_id, name, slug, segment, short_description, description, logo_url, website_url, instagram_url, whatsapp, contact_email, status, featured)
select c.id, v.name, v.slug, v.segment, v.short_description, v.description, v.logo_url, v.website_url, v.instagram_url, v.whatsapp, v.contact_email, 'active'::public.adh_business_status, true
from public.adh_chapters c
cross join (values
  ('Hoje Eu Tocto','hoje-eu-tocto','Suplementos e bem-estar','Suplementação alimentar, cuidado diário e qualidade de vida.','TOCTÔ é um suplemento alimentar em pó, sem hormônios e sem cafeína, criado para acompanhar uma rotina simples de cuidado pessoal.','assets/patrocinadores/tocto/logo-tocto-quadrada.webp','https://hojetocto.com.br/','https://www.instagram.com/tocto.oficial/','5512988944969',null),
  ('ICOM Motors','icom-motors','Automóveis','Veículos novos e seminovos com atendimento e procedência.','Compra, venda, troca e financiamento de veículos com atendimento próximo, transparência e preço justo.','assets/patrocinadores/icom-motors/logo-icom-quadrada.webp','https://icommotors.com.br/','https://www.instagram.com/icommotors/','5512991092187',null),
  ('Logos IA Brasil','logos-ia-brasil','Tecnologia e inteligência artificial','Agentes de IA para atendimento, CRM e operação comercial.','Atendimento, CRM e tráfego pago apoiados por agentes de inteligência artificial para qualificar leads e acelerar vendas.','assets/patrocinadores/logos-ia/logo-logos-ia-quadrada.webp','https://logosiabrasil.com/','https://www.instagram.com/logosiabrasil/','5512997423129','suporte@logosiabrasil.com')
) as v(name,slug,segment,short_description,description,logo_url,website_url,instagram_url,whatsapp,contact_email)
where c.city='Taubaté' and c.state='SP'
on conflict (slug) do update set
  name=excluded.name, segment=excluded.segment, short_description=excluded.short_description,
  description=excluded.description, logo_url=excluded.logo_url, website_url=excluded.website_url,
  instagram_url=excluded.instagram_url, whatsapp=excluded.whatsapp, contact_email=excluded.contact_email,
  status='active', featured=true;
