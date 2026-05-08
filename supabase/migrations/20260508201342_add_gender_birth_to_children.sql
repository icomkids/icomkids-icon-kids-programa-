-- Icon Kids — padroniza genero (e idade onde fizer sentido) nos cadastros
-- de crianca em todo o sistema.

-- Children (CRM): birth_date ja existia, agora adiciona gender.
alter table public.children
  add column gender public.gender;

-- Waitlist: o operador costuma cadastrar a familia rapido pela porta;
-- guardar idade (numero) + genero ajuda a identificar e priorizar.
alter table public.waitlist_entries
  add column child_age integer
    check (child_age is null or (child_age >= 0 and child_age <= 18)),
  add column child_gender public.gender;
