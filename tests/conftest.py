"""All tests use REAL MySQL. No SQLite substitution and no silent skipping."""
import os
from pathlib import Path
import secrets

import pytest
from bs4 import BeautifulSoup
from dotenv import load_dotenv

from navigator import create_app
from navigator.db import connect, run_script, migrate_community

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def app():
    load_dotenv(ROOT / ".env")
    config = dict(TESTING=True, SECRET_KEY=secrets.token_urlsafe(48), SESSION_COOKIE_SECURE=False,
                  MYSQL_DATABASE=os.environ.get("TEST_MYSQL_DATABASE", "navigator_test"))
    if config["MYSQL_DATABASE"] != "navigator_test":
        pytest.fail("Tests erase fixture rows. Only a dedicated database named navigator_test is allowed.")
    application = create_app(config)
    conn = connect(application.config)
    with conn.cursor() as c:
        c.execute("SHOW TABLES")
        tables = c.fetchall()
    if not tables:
        run_script(conn, ROOT / "sql/schema.sql")
    migrate_community(conn)
    conn.close()
    return application


@pytest.fixture(autouse=True)
def reset_database(app):
    conn = connect(app.config)
    # Dedicated test database only, child-first. Never disable referential integrity.
    with conn.cursor() as c:
        for table in ["review_votes", "post_votes", "list_votes", "replies", "posts", "reviews", "auth_sessions", "login_attempts", "list_papers",
                      "reading_lists", "reading_states", "users", "paper_authors", "authors", "papers"]:
            c.execute(f"DELETE FROM {table}")
    run_script(conn, ROOT / "sql/fixture.sql")
    conn.close()
    yield


@pytest.fixture
def client(app):
    return app.test_client()


def token(client, path="/login"):
    response = client.get(path)
    assert response.status_code == 200, (path, response.status_code)
    node = BeautifulSoup(response.data, "html.parser").select_one('input[name="csrf_token"]')
    assert node, path
    return node["value"]


def post(client, path, data=None, source="/login", follow=False):
    payload = dict(data or {})
    payload["csrf_token"] = token(client, source)
    return client.post(path, data=payload, follow_redirects=follow)


def register(client, name="Alice", email="alice@example.test"):
    result = post(client, "/register", {"display_name": name, "email": email,
                                       "password": "correct-horse-12345"}, source="/register")
    assert result.status_code == 302
    return result


@pytest.fixture
def alice(client):
    register(client)
    return client


@pytest.fixture
def bob(app):
    c = app.test_client()
    register(c, "Bob", "bob@example.test")
    return c


def scalar(app, sql, args=()):
    conn = connect(app.config)
    try:
        with conn.cursor() as c:
            c.execute(sql, args)
            return next(iter(c.fetchone().values()))
    finally:
        conn.close()


def make_list(client, name="Reading notes"):
    response = post(client, "/lists", {"name": name, "description": "Test collection"})
    assert response.status_code == 302
    return int(response.location.rsplit("/", 1)[1])
