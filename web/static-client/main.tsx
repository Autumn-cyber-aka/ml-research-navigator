import { createRoot } from 'react-dom/client';
import { useSyncExternalStore } from 'react';
import Navigator from '../app/navigator';
import { initialize, pagesClient, subscribe, token } from './client';
import { BACKEND_ORIGIN } from '../lib/deployment';
import '../app/globals.css';
function PagesApp({ error }: { error?: string }) {
  const signedIn = useSyncExternalStore(
    subscribe,
    () => !!token(),
    () => false,
  );
  return (
    <>
      {error && (
        <div
          role="alert"
          className="p-4 border-b border-destructive text-destructive"
        >
          {error}
        </div>
      )}
      <Navigator
        signedIn={signedIn}
        signIn={BACKEND_ORIGIN + '/pages-connect'}
        initialSearch={location.search}
        client={pagesClient}
      />
    </>
  );
}
let error: string | undefined;
try {
  await initialize();
} catch (e) {
  error = e instanceof Error ? e.message : 'Sign-in could not be completed.';
}
createRoot(document.getElementById('root')!).render(<PagesApp error={error} />);
