import Navigator from './navigator';
import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getChatGPTUser();
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'string') params.set(key, value);
  }
  const search = params.size ? '?' + params.toString() : '';
  return (
    <Navigator
      signedIn={!!user}
      signIn={chatGPTSignInPath('/' + search)}
      initialSearch={search}
    />
  );
}
