import { getStore } from '@/db';
import { PagesAuth } from '@/lib/pages-auth';
import {
  cors,
  bearer,
  isPagesOrigin,
  validApiMutation,
} from '@/lib/http-policy';
export const dynamic = 'force-dynamic';
export function OPTIONS(request: Request) {
  return new Response(null, {
    status: isPagesOrigin(request) ? 204 : 403,
    headers: cors(request),
  });
}
export async function POST(request: Request) {
  const reply = (data: unknown, status = 200) =>
    Response.json(data, { status, headers: cors(request) });
  if (!isPagesOrigin(request) || !validApiMutation(request))
    return reply({ error: 'Invalid request origin.' }, 403);
  if (Number(request.headers.get('content-length')) > 4096)
    return reply({ error: 'Request too large.' }, 413);
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'Request too large.' }, 413);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return reply({ error: 'Invalid request.' }, 400);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return reply({ error: 'Invalid request.' }, 400);
    const auth = new PagesAuth(getStore(null));
    if (data.action === 'logout') {
      await auth.revoke(bearer(request) ?? '');
      return reply({ ok: true });
    }
    const session = await auth.exchange(data.code, data.verifier, data.state);
    return session
      ? reply(session)
      : reply(
          {
            error: 'Sign-in expired or was already used. Please sign in again.',
          },
          401,
        );
  } catch {
    return reply({ error: 'Sign-in is temporarily unavailable.' }, 503);
  }
}
