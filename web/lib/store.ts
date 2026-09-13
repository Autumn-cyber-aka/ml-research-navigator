/** D1 edition: prepared values, bounded reads, CAS updates and atomic batches. */
// Dynamic SQL projections are checked by domain tests; bind arguments remain unknown until validated.
// oxlint-disable-next-line typescript/no-explicit-any
export type Row = Record<string, any>;
export type Identity = { userId: string } | null;
export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const fail = (status: number, message: string): never => {
  throw new AppError(status, message);
};
export function integer(value: unknown, min = 1, max = 2147483647) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    fail(400, 'Enter a valid whole number.');
  return n;
}
export function text(value: unknown, max: number, optional = false) {
  if (typeof value !== 'string') fail(400, 'Text is required.');
  const s = (value as string).trim();
  if ((!optional && !s) || s.length > max)
    fail(400, `Enter ${optional ? '0' : '1'}–${max} characters.`);
  return s;
}
export function validMutation(request: Request) {
  return (
    request.headers.get('origin') === new URL(request.url).origin &&
    request.headers.get('x-navigator-action') === '1' &&
    request.headers.get('content-type')?.split(';')[0] === 'application/json'
  );
}
export interface Statement {
  bind(...args: unknown[]): Statement;
  all(): Promise<{ results: Row[] }>;
  run(): Promise<{ meta: { changes: number; last_row_id?: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(
    statements: Statement[],
  ): Promise<{ meta: { changes: number; last_row_id?: number } }[]>;
}
export class Store {
  constructor(
    public db: Database,
    public uid: string | null,
  ) {}
  st(sql: string, args: unknown[] = []) {
    return this.db.prepare(sql).bind(...args);
  }
  async rows(sql: string, args: unknown[] = []) {
    return (await this.st(sql, args).all()).results;
  }
  async one(sql: string, args: unknown[] = []) {
    return (await this.rows(sql, args))[0];
  }
  async run(sql: string, args: unknown[] = []) {
    return this.st(sql, args).run();
  }
  async seed(catalogue: {
    papers: Row[];
    authors: Row[];
    paper_authors: Row[];
  }) {
    if (await this.one('SELECT paper_id FROM papers LIMIT 1')) return;
    const statements: Statement[] = [];
    for (const table of ['papers', 'authors', 'paper_authors'] as const) {
      for (const row of catalogue[table]) {
        const keys = Object.keys(row);
        statements.push(
          this.st(
            `INSERT OR IGNORE INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`,
            Object.values(row),
          ),
        );
      }
    }
    await this.db.batch(statements);
  }
  auth() {
    if (!this.uid) fail(401, 'Sign in with ChatGPT to use your workspace.');
    return this.uid as string;
  }
  async ensureUser() {
    const uid = this.auth();
    await this.run(
      "INSERT OR IGNORE INTO users(user_id,display_name) VALUES(?, 'Reader')",
      [uid],
    );
    return this.one('SELECT display_name FROM users WHERE user_id=?', [uid]);
  }
  async ownList(id: number) {
    const row = await this.one(
      'SELECT * FROM reading_lists WHERE list_id=? AND owner_id=?',
      [id, this.auth()],
    );
    if (!row) fail(404, 'List not found.');
    return row;
  }
  async exists(table: 'papers' | 'posts', id: number) {
    if (
      !(await this.one(
        `SELECT 1 FROM ${table} WHERE ${table === 'papers' ? 'paper_id' : 'post_id'}=?`,
        [id],
      ))
    )
      fail(404, 'Record not found.');
  }
  safe(row: Row, owner = 'user_id') {
    const { user_id: _userId, owner_id: _ownerId, ...rest } = row;
    return { ...rest, mine: !!this.uid && row[owner] === this.uid };
  }
  async decoratePapers(rows: Row[]) {
    if (!rows.length) return rows;
    const authors = await this.rows(
      `SELECT pa.paper_id,a.author_id,a.display_name FROM paper_authors pa JOIN authors a ON a.author_id=pa.author_id WHERE pa.paper_id IN (${rows.map(() => '?').join(',')}) ORDER BY pa.author_order`,
      rows.map((r) => r.paper_id),
    );
    return rows.map((r) => ({
      ...r,
      authors: authors.filter((a) => a.paper_id === r.paper_id),
    }));
  }
  async votes(kind: string, rows: Row[]) {
    const config = voteTargets[kind];
    if (!config) fail(400, 'Unknown vote target.');
    const [, , key, owner] = config;
    if (!rows.length) return rows;
    const stats = await this.rows(
      `SELECT ${key},COUNT(*) votes,MAX(user_id=?) voted FROM ${config[1]} WHERE ${key} IN (${rows.map(() => '?').join(',')}) GROUP BY ${key}`,
      [this.uid ?? '', ...rows.map((r) => r[key])],
    );
    return rows.map((r) => {
      const s = stats.find((s) => s[key] === r[key]);
      return {
        ...this.safe(r, owner),
        votes: s?.votes ?? 0,
        voted: !!s?.voted,
      };
    });
  }
  async read(params: URLSearchParams): Promise<Row> {
    const view = params.get('view') || 'papers',
      page = integer(params.get('page') || 1, 1, 100000),
      limit = 10,
      offset = (page - 1) * limit;
    const paginate = async (sql: string, args: unknown[] = []) => {
      const count = await this.one(`SELECT COUNT(*) total FROM (${sql})`, args);
      const rows = await this.rows(sql + ' LIMIT ? OFFSET ?', [
        ...args,
        limit,
        offset,
      ]);
      return {
        rows,
        total: count.total,
        page,
        pages: Math.max(1, Math.ceil(count.total / limit)),
      };
    };
    if (view === 'papers' || view === 'progress') {
      if (view === 'progress') this.auth();
      const clauses: string[] = [];
      const args: unknown[] = [this.uid ?? ''];
      const q = (params.get('q') || '').trim();
      const author = (params.get('author') || '').trim();
      if (q.length > 200 || author.length > 200)
        fail(400, 'Search is too long.');
      const literal = (s: string) => '%' + s.replace(/[\\%_]/g, '\\$&') + '%';
      if (q) {
        clauses.push(
          "(p.title LIKE ? ESCAPE '\\' OR p.abstract LIKE ? ESCAPE '\\')",
        );
        args.push(literal(q), literal(q));
      }
      if (author) {
        clauses.push(
          "EXISTS(SELECT 1 FROM paper_authors pa JOIN authors a ON a.author_id=pa.author_id WHERE pa.paper_id=p.paper_id AND a.display_name LIKE ? ESCAPE '\\')",
        );
        args.push(literal(author));
      }
      if (params.get('year')) {
        clauses.push('p.publication_year=?');
        args.push(integer(params.get('year'), 1900, 2100));
      }
      if (params.get('author_id')) {
        clauses.push(
          'EXISTS(SELECT 1 FROM paper_authors pa WHERE pa.paper_id=p.paper_id AND pa.author_id=?)',
        );
        args.push(integer(params.get('author_id')));
      }
      if (view === 'progress') clauses.push('rs.status IS NOT NULL');
      const result = await paginate(
        `SELECT p.*,rs.status,COALESCE(rs.version,0) state_version FROM papers p LEFT JOIN reading_states rs ON rs.paper_id=p.paper_id AND rs.user_id=? ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY p.paper_id DESC`,
        args,
      );
      return { ...result, rows: await this.decoratePapers(result.rows) };
    }
    if (view === 'authors') {
      const q = text(params.get('q') || '', 200, true);
      return paginate(
        'SELECT a.*,(SELECT COUNT(*) FROM paper_authors pa WHERE pa.author_id=a.author_id) paper_count FROM authors a WHERE instr(lower(a.display_name),lower(?))>0 ORDER BY a.display_name,a.author_id',
        [q],
      );
    }
    if (view === 'network') {
      const id = integer(params.get('id'));
      const author = await this.one('SELECT * FROM authors WHERE author_id=?', [
        id,
      ]);
      if (!author) fail(404, 'Author not found.');
      const neighbors = await this.rows(
        'SELECT a.*,COUNT(DISTINCT mine.paper_id) shared_papers FROM paper_authors mine JOIN paper_authors other ON other.paper_id=mine.paper_id AND other.author_id<>mine.author_id JOIN authors a ON a.author_id=other.author_id WHERE mine.author_id=? GROUP BY a.author_id ORDER BY shared_papers DESC,a.author_id LIMIT 25',
        [id],
      );
      return {
        author,
        neighbors: neighbors.slice(0, 24),
        truncated: neighbors.length > 24,
      };
    }
    if (view === 'leaderboard') {
      const args: unknown[] = [integer(params.get('minimum') || 2, 1, 1000)];
      let year = '';
      if (params.get('year')) {
        year = ' AND p.publication_year=?';
        args.push(integer(params.get('year'), 1900, 2100));
      }
      const result = await paginate(
        'SELECT p.*,r.average_rating,r.review_count FROM papers p JOIN (SELECT paper_id,AVG(rating) average_rating,COUNT(*) review_count FROM reviews GROUP BY paper_id) r ON r.paper_id=p.paper_id WHERE r.review_count>=?' +
          year +
          ' ORDER BY r.average_rating DESC,r.review_count DESC,p.paper_id DESC',
        args,
      );
      return { ...result, rows: await this.decoratePapers(result.rows) };
    }
    if (view === 'lists' || view === 'community') {
      const privateView = view === 'lists';
      if (privateView) this.auth();
      const result = await paginate(
        'SELECT l.*,u.display_name,(SELECT COUNT(*) FROM list_papers lp WHERE lp.list_id=l.list_id) paper_count FROM reading_lists l JOIN users u ON u.user_id=l.owner_id WHERE ' +
          (privateView ? 'l.owner_id=?' : 'l.is_public=1') +
          ' ORDER BY l.list_id DESC',
        privateView ? [this.uid] : [],
      );
      return { ...result, rows: await this.votes('list', result.rows) };
    }
    if (view === 'list' || view === 'shared') {
      const id = integer(params.get('id'));
      const row =
        view === 'list'
          ? await this.ownList(id)
          : await this.one(
              'SELECT l.*,u.display_name FROM reading_lists l JOIN users u ON u.user_id=l.owner_id WHERE l.list_id=? AND l.is_public=1',
              [id],
            );
      if (!row) fail(404, 'List not found.');
      const result = await paginate(
        'SELECT p.* FROM list_papers lp JOIN papers p ON p.paper_id=lp.paper_id WHERE lp.list_id=? ORDER BY lp.created_at DESC,p.paper_id DESC',
        [id],
      );
      return {
        ...result,
        item: (await this.votes('list', [row]))[0],
        rows: await this.decoratePapers(result.rows),
      };
    }
    if (view === 'paper') {
      const id = integer(params.get('id'));
      const p = await this.one(
        'SELECT p.*,rs.status,COALESCE(rs.version,0) state_version FROM papers p LEFT JOIN reading_states rs ON rs.paper_id=p.paper_id AND rs.user_id=? WHERE p.paper_id=?',
        [this.uid ?? '', id],
      );
      if (!p) fail(404, 'Paper not found.');
      const reviews = await paginate(
        'SELECT r.*,u.display_name FROM reviews r JOIN users u ON u.user_id=r.user_id WHERE r.paper_id=? ORDER BY r.review_id DESC',
        [id],
      );
      const postPage = integer(params.get('post_page') || 1, 1, 100000);
      const posts = await this.rows(
        'SELECT p.post_id,p.title,p.created_at,u.display_name FROM posts p JOIN users u ON u.user_id=p.user_id WHERE p.paper_id=? ORDER BY p.post_id DESC LIMIT 10 OFFSET ?',
        [id, (postPage - 1) * 10],
      );
      const postCount = await this.one(
        'SELECT COUNT(*) total FROM posts WHERE paper_id=?',
        [id],
      );
      return {
        paper: (await this.decoratePapers([p]))[0],
        ...reviews,
        rows: await this.votes('review', reviews.rows),
        posts,
        post_page: postPage,
        post_pages: Math.max(1, Math.ceil(postCount.total / 10)),
        rating: await this.one(
          'SELECT AVG(rating) average_rating,COUNT(*) review_count FROM reviews WHERE paper_id=?',
          [id],
        ),
        my_review: this.uid
          ? await this.one(
              'SELECT review_id,body,rating,version FROM reviews WHERE paper_id=? AND user_id=?',
              [id, this.uid],
            )
          : null,
      };
    }
    if (view === 'post') {
      const id = integer(params.get('id'));
      const item = await this.one(
        'SELECT p.*,u.display_name FROM posts p JOIN users u ON u.user_id=p.user_id WHERE p.post_id=?',
        [id],
      );
      if (!item) fail(404, 'Discussion not found.');
      const result = await paginate(
        'SELECT r.*,u.display_name FROM replies r JOIN users u ON u.user_id=r.user_id WHERE r.post_id=? ORDER BY r.reply_id',
        [id],
      );
      return {
        ...result,
        item: (await this.votes('post', [item]))[0],
        rows: result.rows.map((r) => this.safe(r)),
      };
    }
    return fail(404, 'Page not found.');
  }
  async mutate(data: Row): Promise<Row> {
    const uid = this.auth();
    await this.ensureUser();
    const action = data.action;
    const id = () => integer(data.id);
    const version = () => integer(data.version, 0);
    const changed = (n: number) => {
      if (!n) fail(409, 'This record changed. Reload and try again.');
    };
    if (action === 'profile') {
      await this.run('UPDATE users SET display_name=? WHERE user_id=?', [
        text(data.name, 60),
        uid,
      ]);
      return { ok: true };
    }
    if (action === 'list_create') {
      const r = await this.run(
        'INSERT INTO reading_lists(owner_id,name,description) VALUES(?,?,?)',
        [uid, text(data.name, 150), text(data.description || '', 2000, true)],
      );
      return { id: r.meta.last_row_id };
    }
    if (
      [
        'list_edit',
        'list_delete',
        'list_visibility',
        'list_add',
        'list_remove',
      ].includes(action)
    ) {
      const lid = id();
      const list = await this.ownList(lid);
      const v = version();
      if (list.version !== v)
        fail(409, 'The list changed. Reload before editing.');
      if (action === 'list_edit') {
        changed(
          (
            await this.run(
              'UPDATE reading_lists SET name=?,description=?,version=version+1 WHERE list_id=? AND owner_id=? AND version=?',
              [
                text(data.name, 150),
                text(data.description || '', 2000, true),
                lid,
                uid,
                v,
              ],
            )
          ).meta.changes,
        );
      }
      if (action === 'list_delete') {
        changed(
          (
            await this.run(
              'DELETE FROM reading_lists WHERE list_id=? AND owner_id=? AND version=?',
              [lid, uid, v],
            )
          ).meta.changes,
        );
      }
      if (action === 'list_visibility') {
        if (typeof data.public !== 'boolean')
          fail(400, 'Choose public or private.');
        changed(
          (
            await this.run(
              'UPDATE reading_lists SET is_public=?,version=version+1 WHERE list_id=? AND owner_id=? AND version=?',
              [data.public ? 1 : 0, lid, uid, v],
            )
          ).meta.changes,
        );
      }
      if (action === 'list_add' || action === 'list_remove') {
        const input = action === 'list_add' ? data.paper_ids : [data.paper_id];
        if (!Array.isArray(input) || !input.length || input.length > 100)
          fail(400, 'Choose 1–100 paper IDs.');
        const ids = [...new Set(input.map((n: unknown) => integer(n)))];
        const found = await this.one(
          `SELECT COUNT(*) n FROM papers WHERE paper_id IN (${ids.map(() => '?').join(',')})`,
          ids,
        );
        if (found.n !== ids.length)
          fail(400, 'A paper ID does not exist; nothing was added.');
        const statements = ids.map((pid) =>
          action === 'list_add'
            ? this.st(
                'INSERT OR IGNORE INTO list_papers(list_id,paper_id) SELECT list_id,? FROM reading_lists WHERE list_id=? AND owner_id=? AND version=?',
                [pid, lid, uid, v],
              )
            : this.st(
                'DELETE FROM list_papers WHERE list_id=? AND paper_id=? AND EXISTS(SELECT 1 FROM reading_lists WHERE list_id=? AND owner_id=? AND version=?)',
                [lid, pid, lid, uid, v],
              ),
        );
        statements.push(
          this.st(
            'UPDATE reading_lists SET version=version+1 WHERE list_id=? AND owner_id=? AND version=?',
            [lid, uid, v],
          ),
        );
        const results = await this.db.batch(statements);
        changed(results.at(-1)!.meta.changes);
      }
      return { id: lid };
    }
    if (action === 'progress') {
      const pid = integer(data.paper_id),
        v = version();
      await this.exists('papers', pid);
      if (!['want', 'reading', 'read'].includes(data.status))
        fail(400, 'Choose a reading status.');
      const r =
        v === 0
          ? await this.run(
              'INSERT OR IGNORE INTO reading_states(user_id,paper_id,status) VALUES(?,?,?)',
              [uid, pid, data.status],
            )
          : await this.run(
              'UPDATE reading_states SET status=?,version=version+1 WHERE user_id=? AND paper_id=? AND version=?',
              [data.status, uid, pid, v],
            );
      changed(r.meta.changes);
      return { ok: true };
    }
    if (action === 'review_save') {
      const pid = integer(data.paper_id),
        v = version();
      await this.exists('papers', pid);
      const rating = integer(data.rating, 1, 5),
        body = text(data.body, 4000);
      const r =
        v === 0
          ? await this.run(
              'INSERT OR IGNORE INTO reviews(paper_id,user_id,rating,body) VALUES(?,?,?,?)',
              [pid, uid, rating, body],
            )
          : await this.run(
              'UPDATE reviews SET rating=?,body=?,version=version+1 WHERE paper_id=? AND user_id=? AND version=?',
              [rating, body, pid, uid, v],
            );
      changed(r.meta.changes);
      return { ok: true };
    }
    if (action === 'post_create') {
      const pid = integer(data.paper_id);
      await this.exists('papers', pid);
      const r = await this.run(
        'INSERT INTO posts(paper_id,user_id,title,body) VALUES(?,?,?,?)',
        [pid, uid, text(data.title, 200), text(data.body, 8000)],
      );
      return { id: r.meta.last_row_id };
    }
    if (action === 'reply_create') {
      const pid = integer(data.post_id);
      await this.exists('posts', pid);
      await this.run(
        'INSERT INTO replies(post_id,user_id,body) VALUES(?,?,?)',
        [pid, uid, text(data.body, 4000)],
      );
      return { ok: true };
    }
    if (
      [
        'review_delete',
        'post_edit',
        'post_delete',
        'reply_edit',
        'reply_delete',
      ].includes(action)
    ) {
      const kind = action.split('_')[0] as 'review' | 'post' | 'reply';
      const table = { review: 'reviews', post: 'posts', reply: 'replies' }[
        kind
      ]!;
      const key = kind + '_id',
        rid = id(),
        v = version();
      if (
        !(await this.one(
          `SELECT 1 FROM ${table} WHERE ${key}=? AND user_id=?`,
          [rid, uid],
        ))
      )
        fail(404, 'Record not found.');
      if (action.endsWith('_delete'))
        changed(
          (
            await this.run(
              `DELETE FROM ${table} WHERE ${key}=? AND user_id=? AND version=?`,
              [rid, uid, v],
            )
          ).meta.changes,
        );
      else {
        const title = kind === 'post' ? 'title=?,' : '';
        const args = kind === 'post' ? [text(data.title, 200)] : [];
        changed(
          (
            await this.run(
              `UPDATE ${table} SET ${title}body=?,version=version+1 WHERE ${key}=? AND user_id=? AND version=?`,
              [
                ...args,
                text(data.body, kind === 'post' ? 8000 : 4000),
                rid,
                uid,
                v,
              ],
            )
          ).meta.changes,
        );
      }
      return { ok: true };
    }
    if (action === 'vote') {
      const cfg = voteTargets[data.kind];
      if (!cfg) fail(400, 'Unknown vote target.');
      const [table, votes, key, owner] = cfg,
        rid = id();
      const extra = data.kind === 'list' ? ' AND is_public=1' : '';
      const target = await this.one(
        `SELECT ${owner} owner FROM ${table} WHERE ${key}=?${extra}`,
        [rid],
      );
      if (!target) fail(404, 'Record not found.');
      if (target.owner === uid)
        fail(400, 'You cannot vote on your own content.');
      if (typeof data.like !== 'boolean') fail(400, 'Choose like or unlike.');
      if (data.like)
        await this.run(
          `INSERT OR IGNORE INTO ${votes}(${key},user_id) SELECT ${key},? FROM ${table} WHERE ${key}=? AND ${owner}<>?${extra}`,
          [uid, rid, uid],
        );
      else
        await this.run(`DELETE FROM ${votes} WHERE ${key}=? AND user_id=?`, [
          rid,
          uid,
        ]);
      return { ok: true };
    }
    return fail(400, 'Unknown action.');
  }
}
const voteTargets: Record<string, [string, string, string, string]> = {
  review: ['reviews', 'review_votes', 'review_id', 'user_id'],
  post: ['posts', 'post_votes', 'post_id', 'user_id'],
  list: ['reading_lists', 'list_votes', 'list_id', 'owner_id'],
};
