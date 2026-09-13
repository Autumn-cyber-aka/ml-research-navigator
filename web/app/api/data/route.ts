import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getStore } from '@/db';
import { AppError, validMutation } from '@/lib/store';
import catalogue from '@/lib/catalogue.json';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
function error(e: unknown) {
  if (e instanceof AppError) return reply({ error: e.message }, e.status);
  console.error('Database request failed');
  return reply(
    {
      error:
        'The request could not be saved. A name may already exist, or the database may be busy. Reload and retry.',
    },
    503,
  );
}
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    const store = getStore(user?.userId ?? null);
    await store.seed(catalogue);
    const profile = user ? await store.ensureUser() : null;
    return reply({
      ...(await store.read(new URL(request.url).searchParams)),
      profile,
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!validMutation(request))
      return reply({ error: 'Invalid request origin.' }, 403);
    const user = await getChatGPTUser();
    if (!user)
      return reply({ error: 'Sign in with ChatGPT to continue.' }, 401);
    if (Number(request.headers.get('content-length')) > 20000)
      return reply({ error: 'Request too large.' }, 413);
    const body = await request.text();
    if (body.length > 20000) return reply({ error: 'Request too large.' }, 413);
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return reply({ error: 'Invalid JSON.' }, 400);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return reply({ error: 'Invalid action.' }, 400);
    return reply(await getStore(user.userId).mutate(data));
  } catch (e) {
    return error(e);
  }
}
