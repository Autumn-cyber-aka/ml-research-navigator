# A 7–10 minute demonstration

Use fictional data. Create two local test accounts yourself; do not reuse a real password. Start with an empty application activity database.

1. Open the library. Search `Tiny`, author `Sample Researcher A`, year `2025`. Show exactly one result. Clear filters and show the second page.
2. Open paper #1, follow an author to their profile, then return.
3. Register account A. Create list `Evaluation reading`. On its detail page, add `1, 2, 2`: show two members.
4. Add `3, 999999`: show the error, return to the list and show paper #3 was not added. Explain the transaction boundary and rollback.
5. Mark paper #1 `Reading`, then `Finished`. Remove it from the list and show the reading progress still exists.
6. Open paper #1 in two tabs. Save a change in one, then submit the stale version in the other. Explain the 409 conflict and reload.
7. Write a review, edit it, start a discussion and add a reply. Explain why averages are computed instead of maintained by a trigger.
8. In another browser session sign in as B. Attempt to open A's list URL: show 404. Show B's own workspace separately. Tests also cover forged writes, not just hidden buttons.
9. Run the integration tests. Open `docs/evidence/benchmark.json`; point to the query, actual row counts and all timing samples. Explain why cost and milliseconds differ.
10. Close with limitations: local single MySQL, fictional catalogue, no model training, no production load claim; identify what you personally reviewed or changed and where AI assisted.

## Interview questions to practice

- Why can author names repeat, while `(paper_id,author_order)` must not?
- What exactly is atomic in batch_add, and what is protected by the unique key?
- What happens if a process dies before commit? After commit but before the HTTP response?
- Why does a repeated successful batch request not create duplicates?
- Why is a foreign key not an authorization check?
- How does the optimistic version check differ from the list row lock?
- Why does author search use EXISTS? What would direct JOIN pagination break?
- Why did the optimizer's estimated cost increase even while elapsed time decreased in this experiment?
- How would you evaluate a deep-pagination bottleneck before adding infrastructure?
- Which distributed-systems claims would be inaccurate for this application?

## Community extension (another 3–5 minutes)

1. A explicitly publishes one list; B opens its `/shared/lists/…` page and likes it. Verify that A's reading progress is absent. A makes it private again; B's old shared link returns 404.
2. B marks A's review helpful, removes the vote, then votes again. Explain the composite primary key and retry-safe operation; show the concurrent-vote test.
3. A and B rate the same paper 5 and 3. The default minimum-two-reviews leaderboard shows average 4 with count 2. Helpful votes do not change this average.
4. Open an author's coauthor network and equivalent table. Explain the self-join, DISTINCT paper count and 24-direct-neighbor cap.
5. Read `docs/DEPLOYMENT.md` before showing any public URL. A configuration file is not evidence of successful hosting. Explain the trusted proxy and database TLS boundary only to the depth you understand.
