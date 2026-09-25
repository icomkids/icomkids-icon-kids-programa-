// Public reads only: no session restoration, auth refresh, or privileged client.
// The server caches a single anonymous response shared by all visitors.
const resources = new Set(['businesses', 'chapters', 'events']);
const prefix = 'adhonep-public-v1:';
const freshFor = 60_000;
const staleFor = 24 * 60 * 60_000;
const pending = new Map();
const memory = new Map();

function readStored(key) {
  try { return JSON.parse(localStorage.getItem(prefix + key)); } catch { return null; }
}
function valid(record) {
  return record && Array.isArray(record.data) && Number.isFinite(record.updatedAt)
    && record.updatedAt <= Date.now() && Date.now() - record.updatedAt < staleFor;
}
export function cachedPublicData(key) {
  const record = memory.get(key) || readStored(key);
  return valid(record) ? record : null;
}
export function loadPublicData(key) {
  if (!resources.has(key)) return Promise.reject(new Error('Recurso público inválido.'));
  if (pending.has(key)) return pending.get(key);
  const saved = cachedPublicData(key);
  if (saved && Date.now() - saved.updatedAt < freshFor) return Promise.resolve({ ...saved, stale: false });
  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`/api/public/${key}`, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Consulta indisponível (${response.status}).`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Resposta pública inválida.');
      // Never accept a truncated catalog as the complete directory.
      const total = response.headers.get('content-range')?.split('/')[1];
      if (total && total !== '*' && Number(total) > data.length) throw new Error('Catálogo incompleto.');
      const stale = ['STALE', 'UPDATING'].includes(response.headers.get('x-public-cache'));
      const serverDate = Date.parse(response.headers.get('x-catalog-updated') || response.headers.get('date'));
      const record = { data, updatedAt: Math.min(Date.now(), Number.isFinite(serverDate) ? serverDate : Date.now()) };
      if (stale && !valid(record)) throw new Error('Cópia pública expirada.');
      memory.set(key, record);
      try { localStorage.setItem(prefix + key, JSON.stringify(record)); } catch { /* Storage is optional. */ }
      return { ...record, stale };
    } catch (error) {
      if (saved) return { ...saved, stale: true };
      throw error;
    } finally { clearTimeout(timer); }
  })();
  pending.set(key, request);
  request.finally(() => pending.delete(key)).catch(() => {});
  return request;
}

export function upcomingEvents(rows, chapterId = '', now = Date.now()) {
  return rows.filter((item) => (!chapterId || item.chapter_id === chapterId)
    && Date.parse(item.ends_at || item.starts_at) >= now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
