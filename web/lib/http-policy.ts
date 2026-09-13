import { PAGES_ORIGIN } from './deployment.ts';
export function allowedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (
    !origin || origin === new URL(request.url).origin || origin === PAGES_ORIGIN
  );
}
export function isPagesOrigin(request: Request) {
  return request.headers.get('origin') === PAGES_ORIGIN;
}
export function cors(request: Request) {
  const headers = new Headers({
    Vary: 'Origin',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (isPagesOrigin(request)) {
    headers.set('Access-Control-Allow-Origin', PAGES_ORIGIN);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Authorization, Content-Type, X-Navigator-Action',
    );
    headers.set('Access-Control-Max-Age', '600');
  }
  return headers;
}
export function validApiMutation(request: Request) {
  return (
    !!request.headers.get('origin') &&
    allowedOrigin(request) &&
    request.headers.get('x-navigator-action') === '1' &&
    request.headers.get('content-type')?.split(';')[0] === 'application/json'
  );
}
export function bearer(request: Request) {
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}
