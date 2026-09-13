import type { Store } from './store';
/** Single-use proof-bound code exchange; no platform cookies travel to Pages. */
export const randomSecret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export const validProof = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export class PagesAuth {
  constructor(public store: Store) {}
  async issue(
    userId: string,
    challenge: string,
    state: string,
    now = Math.floor(Date.now() / 1000),
  ) {
    if (!validProof(challenge) || !validProof(state))
      throw new Error('Invalid sign-in request');
    const code = randomSecret();
    await this.store.db.batch([
      this.store.st('DELETE FROM pages_auth_codes WHERE expires_at<=?', [now]),
      this.store.st('DELETE FROM pages_sessions WHERE expires_at<=?', [now]),
      this.store.st(
        'INSERT INTO pages_auth_codes(code_hash,user_id,challenge,state,expires_at) VALUES(?,?,?,?,?)',
        [await digest(code), userId, challenge, state, now + 120],
      ),
    ]);
    return code;
  }
  async exchange(
    code: unknown,
    verifier: unknown,
    state: unknown,
    now = Math.floor(Date.now() / 1000),
  ) {
    if (!validProof(code) || !validProof(verifier) || !validProof(state))
      return null;
    const token = randomSecret(),
      tokenHash = await digest(token),
      codeHash = await digest(code),
      challenge = await digest(verifier),
      expires = now + 43200;
    const where = 'code_hash=? AND challenge=? AND state=? AND expires_at>?';
    const results = await this.store.db.batch([
      this.store.st(
        'INSERT INTO pages_sessions(token_hash,user_id,expires_at) SELECT ?,user_id,? FROM pages_auth_codes WHERE ' +
          where,
        [tokenHash, expires, codeHash, challenge, state, now],
      ),
      this.store.st('DELETE FROM pages_auth_codes WHERE ' + where, [
        codeHash,
        challenge,
        state,
        now,
      ]),
    ]);
    return results[0].meta.changes === 1 ? { token, expires } : null;
  }
  async identify(token: string, now = Math.floor(Date.now() / 1000)) {
    if (!validProof(token)) return null;
    const row = await this.store.one(
      'SELECT user_id FROM pages_sessions WHERE token_hash=? AND expires_at>?',
      [await digest(token), now],
    );
    return (row?.user_id as string | undefined) ?? null;
  }
  async revoke(token: string) {
    if (validProof(token))
      await this.store.run('DELETE FROM pages_sessions WHERE token_hash=?', [
        await digest(token),
      ]);
  }
}
