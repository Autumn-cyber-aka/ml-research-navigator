# Resume evidence ledger

**Personal claims: TARGET / NOT YET VERIFIED.** The application has implementation/test evidence; the learner has not yet demonstrated independent understanding. Past-tense bullets below remain draft targets until that gate is satisfied.

- Built a research-paper management application with a Python backend and MySQL, supporting paper discovery, author profiles, reading lists, and reading progress.
- Designed a normalized relational schema and implemented transactional reading-list operations with database constraints and per-user authorization.
- Analyzed multi-table query plans, evaluated indexing strategies, and added integration tests for data integrity and access control.

| Claim | Software evidence | Learner gate |
|---|---|---|
| Application flow | Flask implementation, real-MySQL tests, reproducible deployment files | Personally run and demonstrate the complete flow |
| Constraints and authorization | Schema, two-account tests, batch rollback, concurrency tests | Explain PK/FK/unique constraints, locks, version checks and ownership |
| Performance analysis | Raw query, environment, EXPLAIN/ANALYZE and timing samples | Reproduce and explain estimates vs measured elapsed time |

AI assistance: initial implementation, tests, UI and documentation. Learner contribution: product direction and implementation authorization; code review, modifications and comprehension evidence still to be recorded.

Only upgrade to VERIFIED after completion plus a learner demonstration. Cite measured numbers only with their local/synthetic limitations. Do not use original-team metrics, fabricated users, publications, internships or production performance. “ML” does not imply model training. See docs/DEMO.md for the explanation checklist.
