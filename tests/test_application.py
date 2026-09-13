import pytest
from bs4 import BeautifulSoup
import pymysql
from werkzeug.security import check_password_hash

from navigator import create_app
from navigator.db import connect, run_script
from conftest import make_list, post, register, scalar


def test_requires_secret():
    with pytest.raises(RuntimeError):
        create_app({"SECRET_KEY": ""})


@pytest.mark.parametrize("path", ["/", "/papers", "/papers/1", "/authors", "/authors/1", "/login",
                                 "/register", "/papers/1/discussion", "/health"])
def test_public_pages(client, path):
    assert client.get(path).status_code == 200


def test_search_filters_and_pagination(client):
    soup = BeautifulSoup(client.get("/papers").data, "html.parser")
    assert len(soup.select(".paper-row")) == 12
    second = BeautifulSoup(client.get("/papers?page=2").data, "html.parser")
    assert len(second.select(".paper-row")) == 4
    first_ids = {x["href"] for x in soup.select(".paper-main h2 a")}
    second_ids = {x["href"] for x in second.select(".paper-main h2 a")}
    assert first_ids.isdisjoint(second_ids)
    result = client.get("/papers?q=Tiny&author=Researcher+A&year=2025")
    assert len(BeautifulSoup(result.data, "html.parser").select(".paper-row")) == 1
    assert b"Tiny Forest Classifiers" in result.data
    assert b"No papers found" in client.get("/papers?q=%27+OR+1%3D1+--").data
    assert b"No papers found" in client.get("/papers?q=%25").data
    assert b"No papers found" in client.get("/papers?q=_").data
    assert client.get("/papers?page=0").status_code == 400
    assert client.get("/papers?year=abc").status_code == 400
    assert client.get("/papers?q=" + "x"*201).status_code == 400
    assert client.get("/papers/9999").status_code == 404
    assert client.get("/authors/9999").status_code == 404


def test_registration_password_session_and_logout(app, client):
    register(client)
    hashed = scalar(app, "SELECT password_hash FROM users WHERE email='alice@example.test'")
    assert hashed.startswith("scrypt:")
    assert check_password_hash(hashed, "correct-horse-12345")
    stolen_cookie = client.get_cookie("navigator_session").value
    assert client.get("/workspace").status_code == 200
    assert post(client, "/logout").status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM auth_sessions") == 0
    client.set_cookie("navigator_session", stolen_cookie)
    assert client.get("/workspace").status_code == 302
    assert post(client, "/login", {"email": "alice@example.test", "password": "incorrect"}).status_code == 401
    assert post(client, "/login", {"email": "alice@example.test", "password": "correct-horse-12345"}).status_code == 302


def test_csrf_and_cookie_headers(app, client):
    response = client.get("/register")
    cookie = response.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]
    assert client.post("/register", data={"email": "any@example.test"}).status_code == 400
    register(client)
    assert client.post("/lists", data={"name": "CSRF attack"}).status_code == 400
    assert scalar(app, "SELECT COUNT(*) FROM reading_lists") == 0


def test_duplicate_email_and_invalid_password(client):
    assert post(client, "/register", {"email": "a@example.test", "display_name": "A", "password": "short"}).status_code == 400
    register(client)
    response = post(client, "/register", {"email": "ALICE@example.test", "display_name": "A",
                                          "password": "another-safe-password"})
    assert response.status_code == 409


def test_two_users_lists_and_atomic_batch(app, alice, bob):
    list_id = make_list(alice)
    base = f"/lists/{list_id}"
    assert post(alice, base+"/papers", {"paper_ids": "1,1,2"}).status_code == 302
    assert post(alice, base+"/papers", {"paper_ids": "1,2"}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM list_papers WHERE list_id=%s", (list_id,)) == 2
    assert post(alice, base+"/papers", {"paper_ids": "3,99999"}).status_code == 400
    assert scalar(app, "SELECT COUNT(*) FROM list_papers WHERE list_id=%s", (list_id,)) == 2
    assert bob.get(base).status_code == 404
    assert post(bob, base+"/papers", {"paper_ids": "3"}).status_code == 404
    assert post(bob, base+"/edit", {"name": "Stolen", "description": "", "version": 2}).status_code == 404
    assert post(bob, base+"/delete", {"version": 2}).status_code == 404
    assert post(bob, base+"/papers/1/remove").status_code == 404
    assert post(bob, "/papers/3/add-to-list", {"list_id": list_id}).status_code == 404
    assert b"Reading notes" not in bob.get("/lists").data
    assert post(alice, base+"/edit", {"name": "New name", "description": "", "version": 1}).status_code == 409
    version = scalar(app, "SELECT version FROM reading_lists WHERE list_id=%s", (list_id,))
    assert post(alice, base+"/edit", {"name": "New name", "description": "", "version": version}).status_code == 302
    assert post(alice, base+"/papers/1/remove").status_code == 302
    version = scalar(app, "SELECT version FROM reading_lists WHERE list_id=%s", (list_id,))
    assert post(alice, base+"/delete", {"version": version}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM list_papers WHERE list_id=%s", (list_id,)) == 0
    assert scalar(app, "SELECT COUNT(*) FROM papers") == 16


def test_state_is_independent_and_optimistic(app, alice, bob):
    assert post(alice, "/papers/1/status", {"status": "reading", "version": 0}).status_code == 302
    assert post(alice, "/papers/1/status", {"status": "read", "version": 1}).status_code == 302
    assert post(alice, "/papers/1/status", {"status": "want", "version": 1}).status_code == 409
    assert post(alice, "/papers/1/status", {"status": "garbage", "version": 2}).status_code == 400
    assert post(alice, "/papers/9999/status", {"status": "read", "version": 0}).status_code == 404
    assert post(bob, "/papers/1/status", {"status": "want", "version": 0, "user_id": 1}).status_code == 302
    assert scalar(app, "SELECT status FROM reading_states s JOIN users u USING(user_id) WHERE u.email='alice@example.test'") == 'read'
    lid = make_list(alice)
    post(alice, f"/lists/{lid}/papers", {"paper_ids": "1"})
    response = alice.get("/lists")
    assert b"1 papers" in response.data and b"1 finished" in response.data
    post(alice, f"/lists/{lid}/papers/1/remove")
    assert scalar(app, "SELECT COUNT(*) FROM reading_states") == 2
    assert b"Tiny Forest Classifiers" in alice.get("/workspace?status=read").data
    assert b"Tiny Forest Classifiers" not in bob.get("/workspace?status=read").data


def test_review_crud_authorization_and_xss(app, alice, bob):
    assert post(alice, "/papers/1/reviews", {"rating": 5, "body": "<script>alert(1)</script>"}).status_code == 302
    rid = scalar(app, "SELECT review_id FROM reviews LIMIT 1")
    assert b"&lt;script&gt;" in alice.get("/papers/1").data
    assert b"<script>alert" not in alice.get("/papers/1").data
    assert post(alice, "/papers/1/reviews", {"rating": 4, "body": "duplicate"}).status_code == 409
    assert post(bob, f"/reviews/{rid}/edit", {"rating": 1, "body": "stolen", "version": 1}).status_code == 404
    assert post(bob, f"/reviews/{rid}/delete").status_code == 404
    assert post(alice, f"/reviews/{rid}/edit", {"rating": 4, "body": "Revised", "version": 1}).status_code == 302
    assert post(alice, f"/reviews/{rid}/edit", {"rating": 3, "body": "Stale", "version": 1}).status_code == 409
    assert post(alice, "/papers/2/reviews", {"rating": 6, "body": "invalid"}).status_code == 400
    assert post(alice, f"/reviews/{rid}/delete").status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM reviews") == 0


def test_posts_replies_and_cascade(app, alice, bob):
    r = post(alice, "/papers/1/posts", {"title": "A question", "body": "What are the assumptions?"})
    assert r.status_code == 302
    path = r.location
    assert alice.get(path).status_code == 200
    assert post(bob, path+"/replies", {"body": "Check the split."}).status_code == 302
    reply = scalar(app, "SELECT reply_id FROM replies LIMIT 1")
    assert post(bob, path+"/edit", {"title": "Stolen", "body": "x", "version": 1}).status_code == 404
    assert post(bob, path+"/delete").status_code == 404
    assert post(alice, f"/replies/{reply}/edit", {"body": "Stolen", "version": 1}).status_code == 404
    assert post(alice, f"/replies/{reply}/delete").status_code == 404
    assert post(bob, f"/replies/{reply}/edit", {"body": "Check the held-out split.", "version": 1}).status_code == 302
    assert post(bob, f"/replies/{reply}/edit", {"body": "stale", "version": 1}).status_code == 409
    assert post(alice, path+"/edit", {"title": "Updated question", "body": "Updated", "version": 1}).status_code == 302
    assert post(bob, f"/replies/{reply}/delete").status_code == 302
    assert post(bob, path+"/replies", {"body": "Another reply"}).status_code == 302
    assert post(alice, path+"/delete").status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM replies") == 0
    assert alice.get(path).status_code == 404


def test_database_constraints_and_restrict(app, alice):
    conn = connect(app.config)
    statements = [
        ("INSERT INTO paper_authors VALUES(1,3,1,CURRENT_TIMESTAMP)", ()),
        ("INSERT INTO paper_authors VALUES(1,3,0,CURRENT_TIMESTAMP)", ()),
        ("INSERT INTO list_papers(list_id,paper_id) VALUES(99999,1)", ()),
        ("DELETE FROM papers WHERE paper_id=1", ()),
        ("INSERT INTO authors(display_name) VALUES(' ')", ()),
    ]
    try:
        with conn.cursor() as c:
            for statement, args in statements:
                with pytest.raises(pymysql.MySQLError):
                    c.execute(statement, args)
    finally:
        conn.close()


def test_expired_session(app, alice):
    conn = connect(app.config)
    with conn.cursor() as c:
        c.execute("UPDATE auth_sessions SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 SECOND")
    conn.close()
    assert alice.get("/workspace").status_code == 302


def test_anonymous_write_cannot_create_data(app, client):
    assert post(client, "/lists", {"name": "No owner", "description": ""}).status_code == 302
    assert scalar(app, "SELECT COUNT(*) FROM reading_lists") == 0


def test_rate_limit(app, client):
    # Fill the same window without doing 30 deliberately expensive password hashes.
    from navigator.auth import token_hash
    conn = connect(app.config)
    with conn.cursor() as c:
        c.executemany("INSERT INTO login_attempts(client_hash) VALUES(%s)", [(token_hash("127.0.0.1"),)]*30)
    conn.close()
    assert post(client, "/login", {"email": "none@example.test", "password": "anything"}).status_code == 429


def test_sql_import_quoted_semicolon_and_rollback(app, tmp_path):
    script = tmp_path / "test.sql"
    script.write_text("START TRANSACTION; INSERT INTO authors(author_id,display_name) VALUES(999,'Semi;colon'); COMMIT;")
    conn = connect(app.config)
    run_script(conn, script)
    assert scalar(app, "SELECT display_name FROM authors WHERE author_id=999") == "Semi;colon"
    script.write_text("START TRANSACTION; INSERT INTO authors(author_id,display_name) VALUES(998,'Rollback'); "
                      "INSERT INTO paper_authors(paper_id,author_id,author_order) VALUES(99999,998,1); COMMIT;")
    with pytest.raises(pymysql.IntegrityError):
        run_script(conn, script)
    assert scalar(app, "SELECT COUNT(*) FROM authors WHERE author_id=998") == 0
    conn.close()


def test_init_and_seed_refuse_existing_data(app):
    runner = app.test_cli_runner()
    assert runner.invoke(args=["init-db"]).exit_code != 0
    assert runner.invoke(args=["seed"]).exit_code != 0
    assert runner.invoke(args=["prune-sessions"]).exit_code == 0


def test_authenticated_pages_and_single_add(app, alice):
    lid = make_list(alice)
    assert alice.get(f"/lists/{lid}").status_code == 200
    assert alice.get("/papers/1").status_code == 200
    assert post(alice, "/papers/1/add-to-list", {"list_id": lid}).status_code == 302
    detail = alice.get(f"/lists/{lid}")
    assert detail.status_code == 200 and b"Tiny Forest Classifiers" in detail.data
    assert post(alice, f"/lists/{lid}/papers", {"paper_ids": ""}).status_code == 400
    assert alice.get("/workspace?status=invalid").status_code == 400
    assert alice.get("/authors?q="+"x"*201).status_code == 400
    assert alice.get("/papers/99999/discussion").status_code == 404
    assert alice.get(f"/lists/{lid}/delete").status_code == 405
    assert post(alice, f"/lists/{lid}/delete", {"version": 1}).status_code == 409


def test_db_status_rating_checks_and_foreign_keys(app, alice):
    uid = scalar(app, "SELECT user_id FROM users LIMIT 1")
    conn = connect(app.config)
    try:
        with conn.cursor() as c:
            for sql, values in [
                ("INSERT INTO reading_states(user_id,paper_id,status) VALUES(%s,1,'invalid')", (uid,)),
                ("INSERT INTO reading_states(user_id,paper_id,status) VALUES(%s,999999,'want')", (uid,)),
                ("INSERT INTO reviews(user_id,paper_id,rating,body) VALUES(%s,1,6,'bad')", (uid,)),
                ("INSERT INTO reviews(user_id,paper_id,rating,body) VALUES(%s,1,3,' ')", (uid,)),
                ("INSERT INTO replies(user_id,post_id,body) VALUES(%s,999999,'bad')", (uid,)),
            ]:
                with pytest.raises(pymysql.MySQLError):
                    c.execute(sql, values)
    finally:
        conn.close()


def test_secure_cookie_setting():
    import secrets
    secure_app = create_app({"SECRET_KEY": secrets.token_urlsafe(48), "SESSION_COOKIE_SECURE": True})
    response = secure_app.test_client().get("/login")
    assert "Secure" in response.headers["Set-Cookie"]
    assert "Strict-Transport-Security" in response.headers
