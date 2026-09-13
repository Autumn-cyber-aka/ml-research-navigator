import { getChatGPTUser, chatGPTSignInPath } from '@/app/chatgpt-auth';
import { getStore } from '@/db';
import { PagesAuth, validProof } from '@/lib/pages-auth';
import { PAGES_URL } from '@/lib/deployment';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
};
export async function GET(request: Request) {
  const url = new URL(request.url),
    challenge = url.searchParams.get('challenge'),
    state = url.searchParams.get('state');
  if (!validProof(challenge) || !validProof(state))
    return new Response('Restart sign-in from the GitHub Pages website.', {
      status: 400,
      headers,
    });
  const user = await getChatGPTUser();
  if (!user)
    return new Response(null, {
      status: 302,
      headers: {
        ...headers,
        Location: new URL(
          chatGPTSignInPath(url.pathname + url.search),
          url.origin,
        ).href,
      },
    });
  try {
    const store = getStore(user.userId);
    await store.ensureUser();
    const code = await new PagesAuth(store).issue(
      user.userId,
      challenge,
      state,
    );
    // Fixed callback. The single-use code is proof-bound; tokens never enter URLs.
    const target = new URL(PAGES_URL);
    target.hash = new URLSearchParams({
      nav_code: code,
      nav_state: state,
    }).toString();
    return new Response(null, {
      status: 302,
      headers: { ...headers, Location: target.href },
    });
  } catch {
    return new Response(
      'Sign-in is temporarily unavailable. Please retry from GitHub Pages.',
      { status: 503, headers },
    );
  }
}
