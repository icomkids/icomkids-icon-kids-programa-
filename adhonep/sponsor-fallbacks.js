const polar = {
  id: 'polar-ar-condicionado',
  slug: 'polar-ar-condicionado',
  name: 'Polar Ar Condicionado',
  segment: 'Climatização e ar-condicionado',
  headline: 'Conforto e qualidade de vida em qualquer estação.',
  short_description: 'Há mais de 30 anos oferecendo venda, instalação, manutenção e higienização de ar-condicionado em Taubaté e região.',
  description: 'A Polar Ar Condicionado é especialista em climatização e atua há mais de 30 anos atendendo residências, comércios e empresas de Taubaté e região. A empresa oferece soluções completas para criar ambientes mais frescos, agradáveis e eficientes, desde a escolha do equipamento até a instalação profissional, a manutenção preventiva e corretiva e a higienização. Com técnicos especializados, atendimento rápido e personalizado, trabalha com equipamentos de todas as marcas e prioriza segurança, qualidade e o melhor custo-benefício para cada cliente.',
  logo_url: 'assets/empresarios/polar-ar-condicionado/logo-polar-ar-condicionado.png',
  cover_url: 'assets/empresarios/polar-ar-condicionado/capa-servicos-polar.png',
  instagram_url: 'https://www.instagram.com/polar_arcondicionado2021/',
  whatsapp: '5512981935517',
  featured: true,
  status: 'active',
  offerings: ['Venda de equipamentos de ar-condicionado', 'Instalação profissional e segura', 'Manutenção preventiva e corretiva', 'Higienização e limpeza completa', 'Atendimento residencial, comercial e industrial'],
  differentials: ['Mais de 30 anos de experiência', 'Técnicos especializados', 'Atendimento de todas as marcas', 'Serviço rápido, confiável e personalizado', 'Produtos de qualidade e garantia'],
  service_area: 'Taubaté e região'
};

export function withSponsorFallbacks(rows = [], chapterRows = []) {
  if (rows.some((item) => item.slug === polar.slug)) return rows;
  const taubate = chapterRows.find((item) => String(item.city || '').toLocaleLowerCase('pt-BR') === 'taubaté');
  return [{ ...polar, chapter_id: taubate?.id || '', adh_chapters: { name: taubate?.name || 'Capítulo ADHONEP Taubaté', city: 'Taubaté', state: taubate?.state || 'SP' } }, ...rows];
}
