import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getStore } from '@/db';
import { PagesAuth } from './pages-auth';
import { bearer, isPagesOrigin } from './http-policy';
export async function requestUserId(request: Request) {
  if (request.headers.has('authorization'))
    return new PagesAuth(getStore(null)).identify(bearer(request) ?? '');
  // Pages uses only its scoped bearer session, never third-party ambient cookies.
  if (isPagesOrigin(request)) return null;
  return (await getChatGPTUser())?.userId ?? null;
}
