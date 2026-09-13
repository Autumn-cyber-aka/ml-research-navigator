import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, render_template, request, url_for
from flask_wtf.csrf import CSRFProtect
import pymysql
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

csrf = CSRFProtect()


def create_app(test_config=None):
    load_dotenv()
    app = Flask(__name__)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        MYSQL_UNIX_SOCKET=os.environ.get("MYSQL_UNIX_SOCKET"),
        MYSQL_SSL_CA=os.environ.get("MYSQL_SSL_CA"),
        TRUST_PROXY=os.environ.get("TRUST_PROXY", "0") == "1",
        MYSQL_HOST=os.environ.get("MYSQL_HOST", "127.0.0.1"),
        MYSQL_PORT=os.environ.get("MYSQL_PORT", "3306"),
        MYSQL_USER=os.environ.get("MYSQL_USER", "navigator"),
        MYSQL_PASSWORD=os.environ.get("MYSQL_PASSWORD", ""),
        MYSQL_DATABASE=os.environ.get("MYSQL_DATABASE", "navigator"),
        SESSION_COOKIE_NAME="navigator_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "1") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
        MAX_CONTENT_LENGTH=128 * 1024,
        WTF_CSRF_TIME_LIMIT=7200,
    )
    if test_config:
        app.config.update(test_config)
    if not app.config["SECRET_KEY"] or len(app.config["SECRET_KEY"]) < 32:
        raise RuntimeError("Set SECRET_KEY to a randomly generated value of at least 32 characters.")
    if app.config["TRUST_PROXY"]:
        # Enable only behind one trusted proxy; do not trust forwarded host headers.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
    csrf.init_app(app)
    from . import db, auth, routes, community
    db.init_app(app)
    app.register_blueprint(auth.bp)
    app.register_blueprint(routes.bp)
    app.register_blueprint(community.bp)
    app.before_request(auth.load_user)

    @app.context_processor
    def helpers():
        def page_url(page):
            args = dict(request.args)
            args.update(request.view_args or {})
            args["page"] = page
            return url_for(request.endpoint, **args)
        return {"page_url": page_url, "status_labels": {"want": "Want to read", "reading": "Reading", "read": "Finished"}}

    @app.after_request
    def headers(response):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        if app.config["SESSION_COOKIE_SECURE"]:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        return render_template("error.html", code=error.code, message=error.description), error.code

    @app.errorhandler(pymysql.IntegrityError)
    def integrity_error(_error):
        return render_template("error.html", code=409,
                               message="This change conflicts with an existing record or relationship."), 409

    @app.errorhandler(pymysql.OperationalError)
    def db_error(error):
        # Do not log SQL values or credentials. Deadlocks/timeouts may be retried by the user.
        app.logger.warning("Database operation failed (code %s)", error.args[0])
        return render_template("error.html", code=503,
                               message="The database is temporarily unavailable or busy. Please retry."), 503

    return app
