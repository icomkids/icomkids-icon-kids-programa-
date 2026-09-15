import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

export const supabase = createClient(
  'https://swsfwthjxtqtkloexyjs.supabase.co',
  'sb_publishable_UCpt5UUIheImRldncvyseg_8pDQixDy',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export function showMessage(element, message, kind = 'info') {
  element.textContent = message;
  element.dataset.kind = kind;
  element.hidden = !message;
}
