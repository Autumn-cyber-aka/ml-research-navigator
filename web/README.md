# GitHub Pages 全功能部署

主要入口：[GitHub Pages](https://autumn-cyber-aka.github.io/ml-research-navigator/)。前端调用原 Sites 云端后端，数据库和全部业务功能保留。新增登录桥接表使 D1 共15张表。17项自动测试覆盖业务与登录交换。

[零基础部署课]( ../docs/lessons/12_GITHUB_PAGES.md )说明每一步；下面保留原云端部署记录作为后端参考。

# ML Research Navigator — Sites edition

This directory is the online edition: React/Vinext, Cloudflare Worker, platform-owned ChatGPT sign-in, and durable D1 storage. The parent project's Flask + MySQL code remains the database/interview learning reference. These are separate applications and separate databases; accounts and personal data are not copied or synchronized.

## Run and verify

Use Node 24 and pnpm. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Apply the generated Drizzle migration to the **local** D1 binding before API testing. The Sites platform applies committed migrations during production publishing. Do not initialize/alter schema inside request handlers.

- `pnpm typecheck`: TypeScript compilation check.
- `pnpm test`: 14 SQL/domain tests against an isolated in-memory SQLite adapter implementing the D1 statement/batch interface. Includes two-user isolation, CAS conflicts, rollback boundaries, vote deduplication, cascades, rankings and coauthors. This is not a deployed-D1 load test.
- `pnpm build`: production Worker and browser assets.
- `pnpm db:generate`: generate migrations after editing `db/schema.ts`; inspect the SQL before publishing. Published migration history is immutable.

A local HTTP check also exercised the actual Worker/D1 emulator with the scaffold's synthetic sign-in: anonymous rejection, private/public list access, list membership, cross-origin denial and cleanup. The local sign-in identity is development-only and is never a production bypass. No browser screenshot/click testing was performed.

## What differs from Flask

- Public catalogue, author network, reviews, discussions, public lists and rankings can be read anonymously. Personal lists, progress and writes require **Sign in with ChatGPT**. There are no application passwords or email database columns; the platform authenticates visitors. A user-selected display name (default `Reader`) is the only public profile field.
- 13 D1 tables replace 15 MySQL tables: the platform handles sessions and login attempts, so those two application tables are absent. D1's atomic `batch` and conditional version writes replace MySQL row locks/explicit transactions. MySQL benchmark evidence does not describe this online edition.
- Read queries and mutation logic live in `lib/store.ts`. The thin API route checks trusted platform identity and same-origin JSON requests. Client IDs never choose the acting user. The platform must strip untrusted identity headers before forwarding requests.
- The 16 fictional papers and 8 fictional authors are loaded with an idempotent DML batch from `lib/catalogue.json` on the first catalogue request. No fabricated accounts, reviews, ratings or popularity are seeded. The online dataset derives only from the project's existing `sql/fixture.sql`.
- Lists start private. Public list views omit reading progress and raw identity IDs. Publication is reversible. Reviews/posts/list votes are unique per user and reject self-votes. Rankings use source review averages, default minimum count two; the network shows at most 24 direct coauthors.
- Server reads are bounded and paginated. OFFSET pagination and per-target subqueries suit a small portfolio catalogue, not a production-scale performance claim.

## Source and deployment

`.openai/hosting.json` records the existing Site ID and logical `DB` binding. Never create a second Site when this ID exists. Sites source publication uses a separate repository whose worktree is this directory; its Git metadata is kept outside the parent GitHub checkout. The parent GitHub repository still tracks all source files under `web/` as ordinary files.

Publishing uses the Sites hosting package helper with the validated Worker assets and generated migrations. No database credentials are needed in client code. Do not publish local `.env`, `.wrangler` state, tokens, or runtime logs.

A feature-detected, read-only WebMCP `search_papers` tool uses the same search API and library navigation. A supported browser WebMCP validation context was not available during this build, so this optional tool is not claimed verified. Normal search is independently tested.

See [the deployment record](../docs/DEPLOYMENT.md) and [the beginner course](../docs/LEARNING_GUIDE.md) for the live URL and walkthrough. Fictional data, AI assistance, and learner-mastery limits apply to both editions.
