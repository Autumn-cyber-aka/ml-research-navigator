# Learning and implementation log

## 2026-09-07 — initial design

Prepared an independent schema draft and learning plan after reading the referenced public report and schema. Only static checks were possible then. No original implementation or dataset was copied.

## 2026-09-13 — full implementation authorized

The learner requested a complete implementation and GitHub publication, superseding the exercise-only checkpoint. AI assisted with Flask routes, schema evolution, templates/CSS, tests, benchmark and documentation.

Real MySQL 8.4.11 initialized in an isolated local directory. Schema and fictional fixture imported successfully. The initial importer split quoted semicolons incorrectly; replaced naive splitting with sqlparse and added a regression test. The first authenticated test run exposed a CSRF timeout type mismatch; changed it to seconds and reran the suite.

Application behavior is tested independently from learner understanding. Current raw test results and query measurements live in docs/evidence. Screenshot inspection was not performed: automatic approval review rejected it because browser visual testing had not been explicitly requested. Basic browser page loading and HTTP/template checks were performed.

## Learner record — still to complete

- What I personally implemented or changed:
- Which requests I can trace from HTML through Flask to SQL:
- My explanation of batch rollback and concurrent writes:
- A test I wrote and the failure it prevents:
- My reproduction of the benchmark, including limitations:
- What AI helped with:

Do not treat generated code or passing tests as evidence that the learner can independently explain the implementation.
