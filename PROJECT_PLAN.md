# Project scope and delivery status

Updated 2026-09-13. The initial teaching checkpoint was superseded by the user's explicit request to implement the project and publish it on GitHub.

Core scope: paper discovery → author/detail pages → private reading lists → reading progress → reviews and discussion. Stack: Flask + Jinja + MySQL 8.4. This project remains independent of PaperTrail and PaperRank; no C++ search engine, ingestion queue, or model training is included.

Implemented: relational schema and fictional fixture; parameterized search and pagination; accounts and revocable sessions; per-user authorization; transactional list CRUD/batch membership; optimistic progress versions; review/post/reply CRUD; tests, benchmark, deployment configuration and documentation.

Evidence and precise validation status are in docs/TECHNICAL_REPORT.md. The complete source is available for study, but personal mastery remains unverified until the learner can demonstrate and explain it.

Community features implemented: votes on reviews/posts/public lists, filtered rating leaderboards, direct coauthor network and opt-in list publishing. Public hosting now uses the user-approved Sites + D1 edition under web/, while preserving Flask + MySQL as the learning/reference edition. Render/Aiven remains an unused alternative; there is no need to complete those provider logins for the live Sites edition. External ingestion and ML training remain outside this project. SQL transactions and direct aggregates are used instead of unnecessary trigger-maintained counters.

Follow docs/LEARNING_GUIDE.md to learn step by step, docs/ARCHITECTURE.md for relationships/constraints, and docs/DEMO.md for acceptance and interview discussion.

Sites edition deployed publicly: https://ml-research-navigator.lyujianchen182.chatgpt.site . Deployment and anonymous HTTP verification are recorded in docs/DEPLOYMENT.md. The course now has 18 lessons, with explicit MySQL/D1 and authentication differences.
