# ML Research Navigator

**[Open the public website](https://ml-research-navigator.lyujianchen182.chatgpt.site)** · [零基础18课](docs/LEARNING_GUIDE.md)

The website uses the separate Sites + D1 edition; sign in with ChatGPT to save personal data. The Python + MySQL learning edition described below remains fully available.

A research-paper workspace built with **Python, Flask, server-rendered Jinja HTML, and MySQL 8.4**. Search papers and authors, maintain private reading lists, track reading progress, and discuss papers.

This is an **independent, AI-assisted learning implementation**, inspired by a public UIUC CS411 project. It is not that team's coursework. All bundled paper/author metadata is fictional. “ML” describes the subject area; this application does not train a machine-learning model.

## What works

- Literal keyword, author, and year filters; stable pagination; paper and author detail pages.
- Registration with scrypt password hashes, revocable server-side login sessions, CSRF protection, and secure-cookie configuration.
- Private reading-list CRUD, batch additions with deduplication and all-or-nothing rollback.
- Independent want/reading/read progress with optimistic version checks.
- One review per user per paper, ratings from 1–5, editable posts and one-level replies; ownership checks on every mutation.
- Helpful votes on reviews, posts and explicitly public reading lists; idempotent like/unlike.
- Paper rating leaderboard with minimum-review/year filters; direct coauthor SVG network and accessible table.
- MySQL integration tests including two-user isolation, database constraints, rollback, and two-connection concurrency.
- A reproducible multi-table indexing experiment with raw EXPLAIN, EXPLAIN ANALYZE, and timing samples.

The interface opens directly on the paper catalogue. No frontend build, React, TypeScript, external API, paid cloud, or API key is required.

## Quick start with Docker

Prerequisites: Docker Engine/Desktop with Compose v2 and Python 3 to generate configuration. This uses a local MySQL container and binds the app to **127.0.0.1** only. The database has no host port.

```bash
git clone https://github.com/Autumn-cyber-aka/ml-research-navigator.git
cd ml-research-navigator
python3 scripts/configure.py
docker compose up --build -d
```

Open **http://127.0.0.1:5055**. Register your own account. There are no pre-created passwords or fake user interactions.

`configure.py` writes random secrets into `.env` with restrictive permissions and refuses to overwrite an existing file. MySQL initializes the schema and fictional catalogue on the first start of an empty volume. Subsequent starts retain data.

```bash
docker compose logs app
docker compose down
```

Stopping containers preserves the named database volume. Do not remove that volume unless you intend to erase its data. Changing `.env` database passwords does not rotate credentials in an existing volume.

## Run without Docker

Use Python 3.12+ and a local MySQL 8.4 server. Have a local database administrator create a **dedicated** `navigator` database using `utf8mb4_0900_ai_ci` and an account permitted to initialize its schema. Do not use a shared or production database.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python scripts/configure.py
```

Edit the ignored `.env` so `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE` match your local database. For a Unix socket, add `MYSQL_UNIX_SOCKET=/path/to/mysql.sock`. Keep the generated `SECRET_KEY` private.

```bash
flask --app navigator init-db
flask --app navigator seed
gunicorn --bind 127.0.0.1:5055 --workers 2 'navigator:create_app()'
```

The initializer refuses a nonempty database. MySQL DDL implicitly commits: a failed schema import must be inspected, not assumed rolled back. The seed importer rolls back DML failures and refuses an already populated catalogue. After initialization the application needs SELECT/INSERT/UPDATE/DELETE, not schema-changing privileges; use a separate migration identity when deploying beyond a local demonstration.

Alternatively, `uv sync --frozen` uses the committed `uv.lock`. The requirements files are pinned exports of that lock.

## Public hosting and upgrading

The `web/` directory is the **Sites + D1 online edition**, authorized separately from the original Flask + MySQL learning implementation. It uses platform-owned ChatGPT sign-in and durable cloud data. Both editions support reading lists, progress, reviews/discussions, votes, rankings and coauthor exploration; their data is separate. See [deployment status](docs/DEPLOYMENT.md), [the two-edition beginner lesson](docs/lessons/11_TWO_EDITIONS.md), and [web setup](web/README.md). `render.yaml` remains an unused alternative for hosting the original MySQL edition.

For an existing database, update code and run `flask --app navigator migrate-db` with a migration identity before restarting the app. This additive migration preserves data and keeps all existing lists private. Docker users: `docker compose build app`, then `docker compose run --rm app flask --app navigator migrate-db`, then `docker compose up -d app`. Never delete your database volume to upgrade.

## Tests

```bash
# Separate ephemeral MySQL container; does not touch your app's data.
docker compose --profile test run --build --rm test
```

Without Docker, create a separate `navigator_test` database and grant the configured database account access to it, then run:

```bash
python -m pytest --cov=navigator --cov-report=term-missing -q
ruff check navigator tests scripts
```

Tests **delete fixture rows in `navigator_test`** and refuse a different database name. Never place valuable data there. No SQLite fallback or silent database-test skips are used. The GitHub workflow runs the Docker test path and saves raw output.

## Database experiment

```bash
# Use the dedicated test DB; not the application DB.
python scripts/benchmark.py
# Or, with Docker:
docker compose --profile test run --rm test python scripts/benchmark.py
```

The script creates `bench_*` tables and refuses to replace a previous experiment. Save the results and use a fresh test database for another run. Container output is ephemeral unless copied or mounted before removing the container; the committed native-run evidence is in [`docs/evidence/benchmark.json`](docs/evidence/benchmark.json).

The recorded run uses 30,000 synthetic papers, 200 authors, 60,000 relationships, three warm-ups and 20 timed runs per condition. It compares the same query before/after a year/ID index and verifies identical results. Estimated optimizer cost is **not** measured milliseconds. Read the [technical report](docs/TECHNICAL_REPORT.md) before citing results.

## Project map

```text
navigator/
  __init__.py       app factory, configuration, CSRF and error responses
  auth.py           accounts, password verification, revocable sessions
  db.py             connections, explicit SQL and transaction boundaries
  services.py       ownership, batch operations and version checks
  routes.py         HTTP input validation and application flows
  community.py      votes, public lists, ratings leaderboard and coauthor graph
  templates/        Jinja pages; escaped user text
  static/           CSS and favicon
sql/                schema and fictional fixture
scripts/            private configuration generator and benchmark
tests/              real-MySQL application and concurrency tests
docs/               architecture, tutorial, demonstration and evidence
```

Start learning with the [zero-prerequisite Chinese course](docs/LEARNING_GUIDE.md): 18 lessons covering files/terminals, a guided app tour, tables and SQL, Python basics, request tracing, a first edit, authentication, transactions, tests and interview practice, then community features and public deployment. Every chapter includes exercises and reference answers. Then use the [course index](docs/LEARNING_GUIDE.md), then read the [architecture](docs/ARCHITECTURE.md) and follow the [demo script](docs/DEMO.md).

## Scope and limitations

This is a portfolio application, not a production service or distributed database. No email verification/recovery, moderation, full-text relevance ranking, background ingestion or ML training is implemented. Reviews and posts are public. Reading lists are private by default and can be explicitly published by their owner; personal reading progress always stays private. Replies are one level deep. There is no account-deletion UI.

For public web hosting, use HTTPS and `COOKIE_SECURE=1`, configure a trusted reverse proxy deliberately, add operational monitoring/backups, and review abuse controls. The built-in DB-backed sign-in limit is a small local-demo safeguard, not a complete anti-abuse system. IP addresses are hashed without a salt for the window key; this is pseudonymization, not anonymization. Run `flask --app navigator prune-sessions` to delete expired sessions and old attempts.

GitHub publication shares **source code**, not a live hosted backend. Votes, leaderboards and coauthor graphs are implemented. Transactions and source-row aggregation provide the relevant consistency guarantees; redundant trigger-maintained counters are not used. Rating averages are computed from source rows instead of maintaining a redundant aggregate.

## Attribution and evidence

See [REFERENCE_NOTES.md](REFERENCE_NOTES.md) for the original report and schema references. No source implementation or dataset from that repository was copied. Repository visibility alone was not treated as reuse permission.

The implementation and initial tests were AI-assisted. Software verification and the learner's ability to explain the code are separate: [RESUME_EVIDENCE.md](RESUME_EVIDENCE.md) retains a demonstration gate before personal resume claims are marked verified. No real publications, active users, internships, or production performance are claimed.

Original implementation: MIT license. Third-party dependencies retain their respective licenses.
