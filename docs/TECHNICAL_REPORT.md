# Technical report — 2026-09-13

## Implementation and verification

The application uses Flask 3.1.3, Python 3.12.14, PyMySQL 1.2.0 and MySQL Community Server 8.4.11. Dependencies are locked. Local verification ran on macOS ARM64 with a dedicated MySQL instance using a Unix socket. No SQLite substitute or paid cloud was used.

The final native run passed **29 tests**, with **98% reported Python statement coverage**. Coverage is not a proof of security or completeness. See [raw output](evidence/test-run.txt). Tests use the dedicated `navigator_test` database and keep CSRF enabled. They include public/authenticated page rendering, literal search and pagination, scrypt password verification, session revocation/expiry, CSRF rejection, secure cookies, two-user ownership boundaries, CRUD, XSS escaping, database constraints, failure rollback and two independent concurrent database connections.

Schema initialization and seed import were executed successfully in the application database. Basic browser page loading and HTTP/template rendering were checked. Screenshot/visual inspection was not performed: automatic approval review rejected the screenshot because browser visual testing was not explicitly requested.

Docker/Compose and GitHub Actions configuration are supplied. Their hosted execution status must be checked separately in GitHub Actions; the native test output is not evidence of a Docker run.

## Query experiment

Raw data: [benchmark.json](evidence/benchmark.json). The experiment uses separate `bench_*` tables inside the dedicated test database, with 30,000 synthetic papers, 200 authors and 60,000 paper-author rows. It selects the 20 newest paper IDs from year 2026, then joins their ordered authors. Both conditions return the same 40 rows.

| Condition | Median client elapsed time, 20 runs | Observed paper access in EXPLAIN ANALYZE |
|---|---|---|
| Before year/ID index | 0.303458 ms | Reverse primary-key scan examines 1,103 rows before finding 20 matches |
| After `(publication_year,paper_id)` index | 0.1997915 ms | Indexed lookup retrieves 20 matching rows |

Each condition includes three warm-ups. Timing uses a monotonic high-resolution clock and includes result transfer/materialization. Full plans, all samples, parameters and software environment are saved. This is one small, warm-cache, single-client local experiment; sub-millisecond measurements have substantial relative noise. There is no production-load or throughput claim.

Interestingly, the plan's estimated join cost rises from about 25.6 to 207 even though measured time falls. Those estimates are optimizer model units, not elapsed milliseconds. Also, the baseline already uses a primary-key index; it is inaccurate to call it a full table scan. The comparison measures one useful access path, not “all queries are faster.”

The application schema includes a corresponding year/ID index. Author filtering uses EXISTS to preserve paper cardinality, while bounded author loading avoids one query per paper. Literal `%term%` search can still require scans and is not claimed to be an indexed search engine. OFFSET pagination is suitable for this small catalogue but becomes expensive at deep offsets.

## Transactions and concurrency

The two-connection batch test submits the same two papers to one list at once. The list row lock serializes operations; one call adds two and the other adds zero. The membership primary key prevents duplicates. The rollback test attempts a valid paper followed by an invalid ID and verifies no partial membership survives.

The two-connection progress test submits different states with the same expected version. Exactly one saves and one receives a conflict, with version advancing once. The test does not claim exhaustive coverage of every possible schedule. Production deadlocks/timeouts return a retryable 503 after rollback rather than silently retrying arbitrary operations.

No triggers or stored procedures are added just to satisfy a checklist. Review averages are computed from the authoritative review rows; this avoids synchronization logic without a measured need for a cached aggregate.

## Known boundaries

- Fictional metadata only; no active-user counts or real publications are claimed.
- Public discussion, private reading lists and progress. One-level replies.
- Local single-instance MySQL, not a distributed storage or compute platform.
- No email verification/reset, public moderation, account-deletion UI, backup automation or public hosting.
- App DB credentials should be limited to DML after initialization for deployments beyond local learning. The disposable test account needs schema privileges for experiments.
- Local HTTP uses `COOKIE_SECURE=0`; HTTPS deployments require secure-cookie and proxy configuration review.
- The DB-backed rate limiter is a minimal IP-window safeguard, not a production abuse-prevention system.
- Learning mastery is still unverified. Code generation and passing tests do not establish personal authorship or independent understanding.

## Debugging evidence

Initial real import exposed quoted semicolons in fictional text; the SQL runner now uses sqlparse and has rollback/quoted-semicolon regression coverage. Initial authenticated tests exposed a CSRF time-limit type mismatch; configuration now uses seconds. Both failures were fixed before the final native run. This report retains the failures as engineering context without publishing local paths or private credentials.
