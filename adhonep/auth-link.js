// Read once before the SDK consumes the fragment. Never put a token in the DOM.
const fragment = new URLSearchParams(typeof location === 'undefined' ? '' : location.hash.slice(1));
export const incomingAuthLink = { type: fragment.get('type'), token: fragment.get('access_token') };
export function isRecoverySession(session, link = incomingAuthLink) {
  return Boolean(link.token && ['invite', 'recovery'].includes(link.type) && session?.access_token === link.token);
}
