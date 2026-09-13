from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from navigator.db import connect, migrate_community
from conftest import make_list, post, scalar


def test_public_list_opt_in_and_private_progress(app, alice, bob):
    lid = make_list(alice, "A shared path")
    assert bob.get(f"/shared/lists/{lid}").status_code == 404
    assert b"A shared path" not in bob.get("/community/lists").data
    assert post(alice, f"/lists/{lid}/papers", {"paper_ids": "1"}).status_code == 302
    assert post(alice, "/papers/1/status", {"status": "read", "version": 0}).status_code == 302
    version = scalar(app, "SELECT version FROM reading_lists WHERE list_id=%s", (lid,))
    assert post(bob, f"/lists/{lid}/visibility", {"visibility": "public", "version": version}).status_code == 404
    assert post(alice, f"/lists/{lid}/visibility", {"visibility": "public", "version": version}).status_code == 302
    public = bob.get(f"/shared/lists/{lid}")
    assert public.status_code == 200 and b"Tiny Forest Classifiers" in public.data
    assert b"Finished" not in public.data and b"alice@example.test" not in public.data
    assert bob.get(f"/lists/{lid}").status_code == 404
    assert post(bob, f"/lists/{lid}/papers", {"paper_ids": "2"}).status_code == 404
    assert b"A shared path" in bob.get("/community/lists").data
    assert post(alice, f"/lists/{lid}/visibility", {"visibility": "private", "version": version}).status_code == 409
    assert post(alice, f"/lists/{lid}/visibility", {"visibility": "private", "version": version+1}).status_code == 302
    assert bob.get(f"/shared/lists/{lid}").status_code == 404
    assert post(bob, f"/votes/list/{lid}", {"action": "like"}).status_code == 404
    assert scalar(app, "SELECT COUNT(*) FROM reading_states") == 1


def test_review_helpfulness_idempotent_and_owned_votes(app, alice, bob):
    post(alice, "/papers/1/reviews", {"rating": 5, "body": "Clear explanation"})
    rid = scalar(app, "SELECT review_id FROM reviews LIMIT 1")
    route = f"/votes/review/{rid}"
    assert post(alice, route, {"action": "like"}).status_code == 400
    assert post(bob, route, {"action": "like"}).status_code == 302
    assert post(bob, route, {"action": "like"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM review_votes") == 1
    assert b"1 helpful votes" in bob.get("/papers/1").data
    assert post(bob, route, {"action": "unlike"}).status_code == 302
    assert post(bob, route, {"action": "unlike"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM review_votes") == 0
    assert post(bob, route, {"action": "toggle"}).status_code == 400
    assert post(bob, "/votes/arbitrary/1", {"action": "like"}).status_code == 404
    assert post(bob, "/votes/review/999999", {"action": "like"}).status_code == 404
    assert bob.post(route, data={"action": "like"}).status_code == 400
    post(bob, route, {"action": "like"})
    post(alice, f"/reviews/{rid}/delete")
    assert scalar(app, "SELECT COUNT(*) FROM review_votes") == 0


def test_post_and_public_list_votes(app, alice, bob):
    r = post(alice, "/papers/1/posts", {"title": "Question", "body": "Why this approach?"})
    pid = int(r.location.rsplit("/", 1)[1])
    assert post(bob, f"/votes/post/{pid}", {"action": "like"}).status_code == 302
    assert b"1 likes" in bob.get(r.location).data
    assert post(bob, f"/votes/post/{pid}", {"action": "unlike"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM post_votes") == 0
    lid = make_list(alice)
    assert post(alice, f"/lists/{lid}/visibility", {"visibility": "public", "version": 1}).status_code == 302
    assert post(bob, f"/votes/list/{lid}", {"action": "like"}).status_code == 302
    assert post(bob, f"/votes/list/{lid}", {"action": "like"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM list_votes") == 1
    assert b"1 likes" in bob.get(f"/shared/lists/{lid}").data
    assert post(bob, f"/votes/list/{lid}", {"action": "unlike"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM list_votes") == 0


def test_ranking_filters_and_empty_state(app, alice, bob):
    assert b"Not enough reviews" in alice.get("/leaderboard").data
    post(alice, "/papers/1/reviews", {"rating": 5, "body": "A"})
    post(bob, "/papers/1/reviews", {"rating": 3, "body": "B"})
    post(alice, "/papers/2/reviews", {"rating": 5, "body": "C"})
    r = alice.get("/leaderboard")
    assert r.status_code == 200 and b"Tiny Forest Classifiers" in r.data
    assert b"Reading Graph Representations" not in r.data
    assert b"4.00/5" in r.data
    r = alice.get("/leaderboard?minimum=1")
    assert r.data.index(b"Reading Graph Representations") < r.data.index(b"Tiny Forest Classifiers")
    assert b"Reading Graph Representations" not in alice.get("/leaderboard?minimum=1&year=2025").data
    assert alice.get("/leaderboard?minimum=0").status_code == 400
    assert alice.get("/leaderboard?year=bad").status_code == 400


def test_coauthors_are_direct_and_counted_once(client, app):
    r = client.get("/authors/1/network")
    assert r.status_code == 200 and b"Sample Researcher B" in r.data
    assert b"Sample Researcher H" in r.data
    assert b"Sample Researcher C" not in r.data
    assert client.get("/authors/99999/network").status_code == 404
    conn = connect(app.config)
    with conn.cursor() as c:
        c.execute("INSERT INTO authors(author_id,display_name) VALUES(999,'Solo researcher')")
    conn.close()
    assert b"No coauthors" in client.get("/authors/999/network").data


def test_migration_is_repeatable_and_preserves_lists(app, alice):
    lid = make_list(alice)
    post(alice, f"/lists/{lid}/papers", {"paper_ids": "1,2"})
    conn = connect(app.config)
    try:
        # Reconstruct the old schema in the disposable test DB, retaining real fixture rows.
        with conn.cursor() as cursor:
            for table in ("review_votes", "post_votes", "list_votes"):
                cursor.execute(f"DROP TABLE {table}")
            cursor.execute("ALTER TABLE reading_lists DROP COLUMN is_public")
        migrate_community(conn)
        migrate_community(conn)
    finally:
        conn.close()
    assert scalar(app, "SELECT is_public FROM reading_lists WHERE list_id=%s", (lid,)) == 0
    assert scalar(app, "SELECT COUNT(*) FROM list_papers WHERE list_id=%s", (lid,)) == 2


def test_concurrent_same_user_vote_is_one_row(app, alice, bob):
    r = post(alice, "/papers/1/posts", {"title": "Question", "body": "Why?"})
    pid = int(r.location.rsplit("/", 1)[1])
    from conftest import token
    csrf_token = token(bob)
    cookie = bob.get_cookie("navigator_session").value
    barrier = Barrier(2)
    def submit():
        client = app.test_client()
        client.set_cookie("navigator_session", cookie)
        barrier.wait(timeout=10)
        return client.post(f"/votes/post/{pid}", data={"csrf_token": csrf_token,"action":"like"}).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(submit), pool.submit(submit)]
        assert [f.result(timeout=15) for f in futures] == [302,302]
    assert scalar(app, "SELECT COUNT(*) FROM post_votes") == 1
