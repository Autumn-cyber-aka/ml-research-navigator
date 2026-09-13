import { env } from 'cloudflare:workers';
import { Store } from '@/lib/store';
export function getStore(uid: string | null) {
  if (!env.DB) throw new Error('Database unavailable');
  return new Store(env.DB, uid);
}
