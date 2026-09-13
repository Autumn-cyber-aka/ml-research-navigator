import { BACKEND_ORIGIN, PAGES_ORIGIN, PAGES_PATH } from '../lib/deployment.ts';
const SESSION = 'ml-research-navigator.pages.session.v1',
  PENDING = 'ml-research-navigator.pages.pending.v1';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
const random = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
export function token() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
    return s && /^[a-f0-9]{64}$/.test(s.token) && s.expires > Date.now() / 1000
      ? (s.token as string)
      : null;
  } catch {
    return null;
  }
}
function clear() {
  sessionStorage.removeItem(SESSION);
  notify();
}
export const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
export async function initialize() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const code = fragment.get('nav_code'),
    state = fragment.get('nav_state');
  if (!code && !state) return;
  // Remove the code from browser history before any network request.
  history.replaceState({}, '', location.pathname + location.search);
  const pending = JSON.parse(sessionStorage.getItem(PENDING) || 'null');
  sessionStorage.removeItem(PENDING);
  if (
    !pending ||
    pending.state !== state ||
    Date.now() - pending.createdAt > 600000 ||
    !/^[a-f0-9]{64}$/.test(code ?? '')
  )
    throw new Error(
      'This sign-in did not start in this tab, or it expired. Please sign in again.',
    );
  const response = await fetch(BACKEND_ORIGIN + '/api/pages-session', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'X-Navigator-Action': '1' },
    body: JSON.stringify({ code, state, verifier: pending.verifier }),
  });
  const result = (await response.json()) as {
    token: string;
    expires: number;
    error?: string;
  };
  if (!response.ok)
    throw new Error(result.error || 'Sign-in failed. Please try again.');
  sessionStorage.setItem(
    SESSION,
    JSON.stringify({ token: result.token, expires: result.expires }),
  );
  const search =
    typeof pending.search === 'string' && pending.search.startsWith('?')
      ? pending.search
      : '';
  history.replaceState({}, '', PAGES_PATH + search);
  notify();
}
export const pagesClient = {
  basePath: PAGES_PATH,
  async signIn() {
    if (location.origin !== PAGES_ORIGIN)
      throw new Error('Open the published GitHub Pages website to sign in.');
    const verifier = random(),
      state = random();
    sessionStorage.setItem(
      PENDING,
      JSON.stringify({
        verifier,
        state,
        createdAt: Date.now(),
        search: location.search,
      }),
    );
    const url = new URL('/pages-connect', BACKEND_ORIGIN);
    url.searchParams.set('challenge', await hash(verifier));
    url.searchParams.set('state', state);
    location.assign(url.href);
  },
  async signOut() {
    const t = token();
    if (t) {
      const r = await fetch(BACKEND_ORIGIN + '/api/pages-session', {
        method: 'POST',
        credentials: 'omit',
        headers: {
          Authorization: 'Bearer ' + t,
          'Content-Type': 'application/json',
          'X-Navigator-Action': '1',
        },
        body: JSON.stringify({ action: 'logout' }),
      });
      if (!r.ok)
        throw new Error('Sign-out could not be confirmed. Please retry.');
    }
    clear();
  },
  async request(path: string, init: RequestInit = {}) {
    if (!path.startsWith('/api/')) throw new Error('Unsupported API path');
    const headers = new Headers(init.headers),
      t = token();
    if (t) headers.set('Authorization', 'Bearer ' + t);
    const result = await fetch(BACKEND_ORIGIN + path, {
      ...init,
      headers,
      credentials: 'omit',
    });
    if (result.status === 401 && t) {
      clear();
      if (!init.method || init.method === 'GET') {
        headers.delete('Authorization');
        return fetch(BACKEND_ORIGIN + path, {
          ...init,
          headers,
          credentials: 'omit',
        });
      }
    }
    return result;
  },
};
