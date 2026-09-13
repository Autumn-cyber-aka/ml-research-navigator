"""Small explicit SQL layer: one connection per request, no hidden ORM."""
from contextlib import contextmanager
from pathlib import Path

import ssl

import click
import pymysql
import sqlparse
from flask import current_app, g


def connect(config):
    tls = None
    if config.get("MYSQL_SSL_CA"):
        tls = ssl.create_default_context(cafile=config["MYSQL_SSL_CA"])
        tls.minimum_version = ssl.TLSVersion.TLSv1_2
    return pymysql.connect(
        host=config["MYSQL_HOST"], port=int(config["MYSQL_PORT"]),
        unix_socket=config.get("MYSQL_UNIX_SOCKET") or None,
        user=config["MYSQL_USER"], password=config["MYSQL_PASSWORD"],
        database=config["MYSQL_DATABASE"], charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, autocommit=True,
        connect_timeout=5, read_timeout=10, write_timeout=10,
        ssl=tls,
        init_command="SET time_zone = '+00:00'",
    )


def get_db():
    if "db" not in g:
        g.db = connect(current_app.config)
    return g.db


def query(sql, args=(), *, one=False):
    with get_db().cursor() as cur:
        cur.execute(sql, args)
        return cur.fetchone() if one else cur.fetchall()


def execute(sql, args=()):
    with get_db().cursor() as cur:
        cur.execute(sql, args)
        return cur.lastrowid


@contextmanager
def transaction():
    conn = get_db()
    conn.begin()
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise


def run_script(conn, path):
    # Split trusted project SQL without treating semicolons inside text as delimiters.
    text = "\n".join(line for line in Path(path).read_text().splitlines()
                     if not line.lstrip().startswith("--"))
    try:
        with conn.cursor() as cur:
            for statement in sqlparse.split(text):
                if statement.strip():
                    cur.execute(statement)
    except BaseException:
        conn.rollback()
        raise


def migrate_community(conn):
    """Add community tables without deleting existing data; safe after partial DDL failure."""
    root = Path(__file__).resolve().parents[1]
    with conn.cursor() as cur:
        cur.execute("SHOW COLUMNS FROM reading_lists LIKE 'is_public'")
        if not cur.fetchone():
            cur.execute("ALTER TABLE reading_lists ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE")
        text = (root / "sql/migrations/002_community.sql").read_text()
        for statement in sqlparse.split(text):
            cleaned = sqlparse.format(statement, strip_comments=True).strip()
            if cleaned.startswith("CREATE TABLE "):
                cur.execute(cleaned.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1))


def init_app(app):
    @app.cli.command("migrate-db")
    def migrate_command():
        """Apply additive community migration. Existing reading lists stay private."""
        migrate_community(get_db())
        click.echo("Community schema ready; existing lists remain private.")

    @app.teardown_appcontext
    def close_db(_error):
        conn = g.pop("db", None)
        if conn:
            conn.close()

    @app.cli.command("init-db")
    def init_db_command():
        """Initialize an EMPTY dedicated database. Never erase existing tables."""
        conn = get_db()
        if query("SHOW TABLES"):
            raise click.ClickException("Database is not empty; init refused. Use a new dedicated database.")
        run_script(conn, Path(app.root_path).parent / "sql/schema.sql")
        click.echo("Schema initialized. DDL implicitly commits; on failure inspect the partial schema.")

    @app.cli.command("seed")
    def seed_command():
        """Load fictional paper metadata only, without accounts."""
        if query("SELECT COUNT(*) AS n FROM papers", one=True)["n"]:
            raise click.ClickException("Papers exist; seed refused.")
        run_script(get_db(), Path(app.root_path).parent / "sql/fixture.sql")
        click.echo("Fictional catalogue loaded. No accounts or organic activity fabricated.")

    @app.cli.command("prune-sessions")
    def prune_sessions():
        execute("DELETE FROM auth_sessions WHERE expires_at <= UTC_TIMESTAMP()")
        execute("DELETE FROM login_attempts WHERE attempted_at < UTC_TIMESTAMP() - INTERVAL 1 DAY")
        click.echo("Expired sessions and old login attempts removed.")
