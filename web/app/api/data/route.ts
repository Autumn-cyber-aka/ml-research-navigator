import { requestUserId } from '@/lib/request-user';
import { allowedOrigin, cors, validApiMutation } from '@/lib/http-policy';
import { getStore } from '@/db';
import { AppError } from '@/lib/store';
import catalogue from '@/lib/catalogue.json';
export const dynamic = 'force-dynamic';
const reply = (request: Request, data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: cors(request),
  });
function error(request: Request, e: unknown) {
  if (e instanceof AppError)
    return reply(request, { error: e.message }, e.status);
  console.error('Database request failed');
  return reply(
    request,
    {
      error:
        'The request could not be saved. A name may already exist, or the database may be busy. Reload and retry.',
    },
    503,
  );
}
export async function GET(request: Request) {
  try {
    if (!allowedOrigin(request))
      return reply(request, { error: 'Origin not allowed.' }, 403);
    const userId = await requestUserId(request);
    if (request.headers.has('authorization') && !userId)
      return reply(request, { error: 'Session expired. Sign in again.' }, 401);
    const store = getStore(userId);
    await store.seed(catalogue);
    const profile = userId ? await store.ensureUser() : null;
    return reply(request, {
      ...(await store.read(new URL(request.url).searchParams)),
      profile,
    });
  } catch (e) {
    return error(request, e);
  }
}
export async function POST(request: Request) {
  try {
    if (!validApiMutation(request))
      return reply(request, { error: 'Invalid request origin.' }, 403);
    if (!allowedOrigin(request))
      return reply(request, { error: 'Origin not allowed.' }, 403);
    const userId = await requestUserId(request);
    if (request.headers.has('authorization') && !userId)
      return reply(request, { error: 'Session expired. Sign in again.' }, 401);
    if (!userId)
      return reply(
        request,
        { error: 'Sign in with ChatGPT to continue.' },
        401,
      );
    if (Number(request.headers.get('content-length')) > 20000)
      return reply(request, { error: 'Request too large.' }, 413);
    const body = await request.text();
    if (body.length > 20000)
      return reply(request, { error: 'Request too large.' }, 413);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return reply(request, { error: 'Invalid JSON.' }, 400);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return reply(request, { error: 'Invalid action.' }, 400);
    return reply(request, await getStore(userId).mutate(data));
  } catch (e) {
    return error(request, e);
  }
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: allowedOrigin(request) ? 204 : 403,
    headers: cors(request),
  });
}
