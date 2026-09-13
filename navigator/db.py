"""Small explicit SQL layer: one connection per request, no hidden ORM."""
from contextlib import contextmanager
from pathlib import Path

import click
import pymysql
import sqlparse
from flask import current_app, g


def connect(config):
    return pymysql.connect(
        host=config["MYSQL_HOST"], port=int(config["MYSQL_PORT"]),
        unix_socket=config.get("MYSQL_UNIX_SOCKET") or None,
        user=config["MYSQL_USER"], password=config["MYSQL_PASSWORD"],
        database=config["MYSQL_DATABASE"], charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor, autocommit=True,
        connect_timeout=5, read_timeout=10, write_timeout=10,
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


def init_app(app):
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
