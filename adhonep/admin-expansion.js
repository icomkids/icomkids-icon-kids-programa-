import { SECTORS, TICKETS, GOALS, STATUSES } from './expansion-schema.js';
const FIELDS = 'id,user_id,name,email,company,job_title,city,whatsapp,whatsapp_normalized,business_sector,business_sector_other,instagram,main_product_service,average_ticket,networking_goals,desired_connections,marketing_opt_in,business_description,created_at,updated_at,status,origin';
export function mountExpansionAdmin(supabase) {
  const container = document.querySelector('#expansion-admin');
  const filters = container.querySelector('form');
  const list = container.querySelector('#expansion-list');
  const feedback = container.querySelector('[role=status]');
  const previous = container.querySelector('[data-page=previous]'); const next = container.querySelector('[data-page=next]');
  let page = 0; let version = 0; let loaded = false; let controller; let loading = false;
  for (const [name, options] of [['business_sector', SECTORS.map(x => [x, x])], ['average_ticket', Object.entries(TICKETS)], ['networking_goals', GOALS.map(x => [x, x])], ['status', Object.entries(STATUSES)]]) {
    options.forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; filters.elements[name].append(option); });
  }
  const note = text => { feedback.textContent = text; };
  function element(tag, text, className) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; }
  function render(rows) {
    list.replaceChildren();
    if (!rows.length) { list.append(element('p', 'Nenhum cadastro encontrado para estes filtros.', 'empty-admin-list')); return; }
    for (const row of rows) {
      const card = element('article', null, 'expansion-admin-card');
      const top = element('div', null, 'expansion-card-heading'); const heading = element('div');
      heading.append(element('h3', row.name), element('p', `${row.company} · ${row.job_title}`));
      const status = element('span', STATUSES[row.status] || row.status, 'expansion-status'); top.append(heading, status); card.append(top);
      card.append(element('p', `${row.city} · ${row.business_sector === 'Outro' ? row.business_sector_other : row.business_sector} · ${TICKETS[row.average_ticket] || ''}`, 'expansion-card-meta'));
      const contact = element('a', row.whatsapp); contact.href = `https://wa.me/55${row.whatsapp_normalized}`; contact.target = '_blank'; contact.rel = 'noopener noreferrer'; contact.className = 'expansion-contact'; card.append(contact);
      const details = element('details'); details.append(element('summary', 'Ver cadastro completo'));
      const definition = element('dl');
      const pairs = [['E-mail', row.email], ['Produto ou serviço', row.main_product_service], ['Objetivos', row.networking_goals?.join(' · ')], ['Conexões procuradas', row.desired_connections?.join(' · ')], ['Receber comunicações', row.marketing_opt_in ? 'Sim' : 'Não'], ['Apresentação', row.business_description || 'Não informada'], ['Origem', row.origin], ['Cadastro', new Date(row.created_at).toLocaleString('pt-BR')], ['Última atualização', new Date(row.updated_at).toLocaleString('pt-BR')]];
      pairs.forEach(([label, value]) => definition.append(element('dt', label), element('dd', value)));
      if (row.instagram) { const dd = element('dd'); const link = element('a', `@${row.instagram}`); link.href = `https://www.instagram.com/${encodeURIComponent(row.instagram)}/`; link.target = '_blank'; link.rel = 'noopener noreferrer'; dd.append(link); definition.append(element('dt', 'Instagram'), dd); }
      details.append(definition);
      const label = element('label', 'Situação do contato'); const select = document.createElement('select');
      Object.entries(STATUSES).forEach(([value, text]) => { const option = element('option', text); option.value = value; option.selected = value === row.status; select.append(option); }); label.append(select);
      const save = element('button', 'Salvar situação'); save.type = 'button'; save.className = 'admin-action';
      save.addEventListener('click', async () => {
        const operation = version; save.disabled = true; note('Salvando situação…');
        try {
          const { data, error } = await supabase.from('adh_leads').update({ status: select.value }).eq('id', row.id).eq('source_page', 'adhonep_expansao_form').select('id,status').single();
          if (operation !== version) return;
          if (error || !data) throw error || new Error('Registro não atualizado.');
          status.textContent = STATUSES[data.status]; note('Situação atualizada.');
        } catch { if (operation === version) note('Não foi possível atualizar. Confira sua permissão e tente novamente.'); }
        finally { save.disabled = false; }
      });
      details.append(label, save); card.append(details); list.append(card);
    }
  }
  async function load(force = false) {
    if (loaded && !force) return;
    controller?.abort(); controller = new AbortController(); const requestController = controller; const current = ++version; loading = true;
    previous.disabled = true; next.disabled = true; filters.querySelector('button').disabled = true; note('Carregando cadastros…');
    const timeout = setTimeout(() => requestController.abort(), 12000);
    try {
      let query = supabase.from('adh_leads').select(FIELDS).eq('source_page', 'adhonep_expansao_form');
      const search = filters.elements.search.value.trim().replace(/[,%()"\\.*]/g, ' ').slice(0, 100);
      if (search) query = query.or(`name.ilike.*${search}*,company.ilike.*${search}*`);
      const city = filters.elements.city.value.trim().replace(/[%_*]/g, '').slice(0, 100);
      if (city) query = query.ilike('city', `%${city}%`);
      for (const field of ['business_sector', 'average_ticket', 'status']) if (filters.elements[field].value) query = query.eq(field, filters.elements[field].value);
      if (filters.elements.networking_goals.value) query = query.contains('networking_goals', [filters.elements.networking_goals.value]);
      const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 25).abortSignal(requestController.signal);
      if (current !== version) return;
      if (error) throw error;
      const rows = data || []; render(rows.slice(0, 25)); loaded = true;
      previous.disabled = page === 0; next.disabled = rows.length <= 25;
      container.querySelector('#expansion-page').textContent = `Página ${page + 1}`;
      note(`${Math.min(rows.length, 25)} cadastro(s) nesta página. Acesso restrito aos capítulos que você administra.`);
    } catch { if (current === version) { loaded = false; note('Não foi possível carregar os cadastros. Os dados anteriores, se exibidos, não foram atualizados. Use Filtrar e atualizar para tentar novamente.'); previous.disabled = page === 0; } }
    finally { clearTimeout(timeout); if (current === version) { loading = false; filters.querySelector('button').disabled = false; } }
  }
  filters.addEventListener('submit', event => { event.preventDefault(); if (loading) return; page = 0; load(true); });
  previous.addEventListener('click', () => { if (loading || page === 0) return; page--; load(true); });
  next.addEventListener('click', () => { if (loading) return; page++; load(true); });
  return { load, reset() { version++; controller?.abort(); page = 0; loaded = false; loading = false; list.replaceChildren(); filters.reset(); note(''); } };
}
