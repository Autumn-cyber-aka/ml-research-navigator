import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/sqlite-core';
const stamp = () =>
  integer('created_at')
    .notNull()
    .default(sql`(unixepoch())`);
export const papers = sqliteTable(
  'papers',
  {
    paper_id: integer('paper_id').primaryKey(),
    source_key: text('source_key').notNull().unique(),
    title: text('title').notNull(),
    abstract: text('abstract').notNull(),
    publication_year: integer('publication_year').notNull(),
    topic: text('topic').notNull(),
    provenance: text('provenance').notNull(),
  },
  (t) => [
    index('idx_papers_year').on(t.publication_year, t.paper_id),
    check('paper_year', sql`${t.publication_year} BETWEEN 1900 AND 2100`),
  ],
);
export const authors = sqliteTable('authors', {
  author_id: integer('author_id').primaryKey(),
  display_name: text('display_name').notNull(),
});
export const paperAuthors = sqliteTable(
  'paper_authors',
  {
    paper_id: integer('paper_id')
      .notNull()
      .references(() => papers.paper_id),
    author_id: integer('author_id')
      .notNull()
      .references(() => authors.author_id),
    author_order: integer('author_order').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.paper_id, t.author_id] }),
    uniqueIndex('uq_author_order').on(t.paper_id, t.author_order),
    index('idx_author_papers').on(t.author_id, t.paper_id),
  ],
);
export const users = sqliteTable('users', {
  user_id: text('user_id').primaryKey(),
  display_name: text('display_name').notNull(),
  created_at: stamp(),
});
export const lists = sqliteTable(
  'reading_lists',
  {
    list_id: integer('list_id').primaryKey({ autoIncrement: true }),
    owner_id: text('owner_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    is_public: integer('is_public').notNull().default(0),
    version: integer('version').notNull().default(1),
    created_at: stamp(),
  },
  (t) => [
    uniqueIndex('uq_list_owner_name').on(t.owner_id, t.name),
    check('list_visibility', sql`${t.is_public} IN (0,1)`),
    check('list_name', sql`length(trim(${t.name})) BETWEEN 1 AND 150`),
  ],
);
export const memberships = sqliteTable(
  'list_papers',
  {
    list_id: integer('list_id')
      .notNull()
      .references(() => lists.list_id, { onDelete: 'cascade' }),
    paper_id: integer('paper_id')
      .notNull()
      .references(() => papers.paper_id),
    created_at: stamp(),
  },
  (t) => [primaryKey({ columns: [t.list_id, t.paper_id] })],
);
export const states = sqliteTable(
  'reading_states',
  {
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    paper_id: integer('paper_id')
      .notNull()
      .references(() => papers.paper_id),
    status: text('status').notNull(),
    version: integer('version').notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.paper_id] }),
    check('state_status', sql`${t.status} IN ('want','reading','read')`),
  ],
);
export const reviews = sqliteTable(
  'reviews',
  {
    review_id: integer('review_id').primaryKey({ autoIncrement: true }),
    paper_id: integer('paper_id')
      .notNull()
      .references(() => papers.paper_id),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    created_at: stamp(),
  },
  (t) => [
    uniqueIndex('uq_user_review').on(t.user_id, t.paper_id),
    index('idx_review_paper').on(t.paper_id),
    check('review_rating', sql`${t.rating} BETWEEN 1 AND 5`),
    check('review_body', sql`length(trim(${t.body})) BETWEEN 1 AND 4000`),
  ],
);
export const posts = sqliteTable(
  'posts',
  {
    post_id: integer('post_id').primaryKey({ autoIncrement: true }),
    paper_id: integer('paper_id')
      .notNull()
      .references(() => papers.paper_id),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    created_at: stamp(),
  },
  (t) => [
    index('idx_posts_paper').on(t.paper_id),
    check('post_title', sql`length(trim(${t.title})) BETWEEN 1 AND 200`),
    check('post_body', sql`length(trim(${t.body})) BETWEEN 1 AND 8000`),
  ],
);
export const replies = sqliteTable(
  'replies',
  {
    reply_id: integer('reply_id').primaryKey({ autoIncrement: true }),
    post_id: integer('post_id')
      .notNull()
      .references(() => posts.post_id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    created_at: stamp(),
  },
  (t) => [
    index('idx_replies_post').on(t.post_id),
    check('reply_body', sql`length(trim(${t.body})) BETWEEN 1 AND 4000`),
  ],
);
export const reviewVotes = sqliteTable(
  'review_votes',
  {
    review_id: integer('review_id')
      .notNull()
      .references(() => reviews.review_id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.review_id, t.user_id] })],
);
export const postVotes = sqliteTable(
  'post_votes',
  {
    post_id: integer('post_id')
      .notNull()
      .references(() => posts.post_id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.post_id, t.user_id] })],
);
export const listVotes = sqliteTable(
  'list_votes',
  {
    list_id: integer('list_id')
      .notNull()
      .references(() => lists.list_id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.list_id, t.user_id] })],
);

// Cross-origin Pages transport sessions; platform ChatGPT remains the identity provider.
export const pagesAuthCodes = sqliteTable(
  'pages_auth_codes',
  {
    code_hash: text('code_hash').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    challenge: text('challenge').notNull(),
    state: text('state').notNull(),
    expires_at: integer('expires_at').notNull(),
  },
  (t) => [index('idx_pages_codes_expiry').on(t.expires_at)],
);
export const pagesSessions = sqliteTable(
  'pages_sessions',
  {
    token_hash: text('token_hash').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.user_id, { onDelete: 'cascade' }),
    expires_at: integer('expires_at').notNull(),
  },
  (t) => [index('idx_pages_sessions_expiry').on(t.expires_at)],
);
