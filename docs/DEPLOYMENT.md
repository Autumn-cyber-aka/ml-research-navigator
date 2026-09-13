# Public deployment — live

**Website: https://ml-research-navigator.lyujianchen182.chatgpt.site**

Published successfully on 2026-09-13. Sites access policy is **public**: anyone with the URL can read the catalogue, paper details, author network, reviews/discussions, published lists and rankings. Personal lists, reading progress and mutations require **Sign in with ChatGPT**. The original Flask + MySQL learning edition remains intact; its database is separate.

## Deployed topology

Browser → Sites-hosted Worker (Vinext/TypeScript) → persistent D1 database.

Platform-owned ChatGPT sign-in supplies trusted identity for private data and writes. The app stores a public nickname, not application passwords or email addresses. New profiles default to `Reader`. Seed data is only the existing 16 fictional papers and 8 fictional authors; no reviews, ratings, lists or popularity are fabricated.

The UI is at `web/app/navigator.tsx`, API boundary at `web/app/api/data/route.ts`, prepared SQL/authorization at `web/lib/store.ts`, and the 13-table D1 model at `web/db/schema.ts`. The generated Drizzle migration is applied by Sites. Runtime code performs only bounded DML seeding, never schema changes.

## Deployment evidence

- Site: `appgprj_6aa6fa95ae2c8191ab8e7a4a34cac5cf`.
- Version: `appgprj_6aa6fa95ae2c8191ab8e7a4a34cac5cf~appgver_50321badd19c8191bd99880c4dbb9323`.
- Deployment: `appgdep_6aa701eeef508191a8f48aa9b163c2d2`, terminal status **succeeded**.
- Sites source revision: `406f403a1ef1db2197b6656304ba4648f1bfc192`. The Sites source repository uses the `web/` directory as its worktree; this is distinct from the parent GitHub commit.
- Access was explicitly changed to `public` under the user's request and read back as public after deployment.
- [Unauthenticated public HTTP checks](evidence/sites-public-http.json): homepage and six public API views returned 200; private-list/progress reads and anonymous writes returned 401. Hosted catalogue reads confirmed the seeded D1 data.
- TypeScript, lint, production build and [14 SQL/domain tests](../web/evidence/store-tests.txt) passed. Actual **local** Worker/D1 HTTP checks also covered synthetic platform sign-in, private/public membership, cross-origin rejection and cleanup.

The browser's full production OAuth round trip and authenticated production writes were **not** exercised. A tool-provided Sites access credential did not supply application identity and was not used to fabricate authentication. No temporary public review/list data was created. Browser screenshot/click tests were not requested or performed. The optional WebMCP search tool has no supported live-browser contract verification; ordinary search is tested independently.

## How to use it

1. Open the public URL and search the catalogue.
2. Sign in with ChatGPT to use **My reading lists** and **Reading progress**.
3. Set a public nickname in the sidebar if desired; it appears on your public contributions.
4. Create a private list and add paper IDs. Publish only when ready; **Make private** revokes the public link.
5. Review papers, discuss ideas and vote on other users' contributions. The rating leaderboard is empty until real users submit enough ratings.

Read the [beginner two-edition lesson](lessons/11_TWO_EDITIONS.md) before comparing this deployment with the original Python/MySQL version.

## Maintenance and limits

Reuse `.openai/hosting.json` and its existing Site ID. Build, validate, push exact Sites source, package Worker assets and migrations, save a version, and publish to existing public access. Never edit a successfully applied migration; generate a new one. Do not put tokens, `.env`, local `.wrangler` state or private data in GitHub. Database persistence is platform-backed; an independent backup/recovery workflow has not been implemented.

This remains a small educational portfolio service: no content moderation, account-deletion UI, production load/SLA claim, or distributed-database benchmark. MySQL benchmark results belong to the original implementation, not this D1 deployment. Data and accounts do not synchronize between editions.

## Unused alternative: host the original Flask + MySQL edition

`render.yaml` and the lower part of [lesson 16](lessons/10_PUBLIC_DEPLOYMENT.md) retain the earlier Render Free + Aiven MySQL Free plan. No resources were created on those services, and you do not need to log into them for the current Sites website. That alternate route needs HTTPS proxy configuration, verified MySQL TLS, a separate cloud database, and privately managed runtime credentials.
