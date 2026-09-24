// Abort the request itself. Media uploads and functions retain a longer budget.
export async function boundedFetch(input, init = {}) {
  const url = String(input?.url || input);
  const controller = new AbortController();
  const signal = init.signal || input?.signal;
  const abort = () => controller.abort(signal.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), /\/storage\/|\/functions\//.test(url) ? 90000 : 10000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
