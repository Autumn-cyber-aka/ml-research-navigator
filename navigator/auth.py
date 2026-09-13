import hashlib
import secrets
from functools import wraps

from flask import Blueprint, abort, flash, g, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from .db import execute, query, transaction

bp = Blueprint("auth", __name__)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def load_user():
    g.user = None
    token = session.get("auth_token")
    if token:
        g.user = query(
            "SELECT u.user_id, u.display_name, u.email FROM auth_sessions s "
            "JOIN users u ON u.user_id=s.user_id WHERE s.token_hash=%s "
            "AND s.expires_at > UTC_TIMESTAMP()", (token_hash(token),), one=True)
        if not g.user:
            session.clear()


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not g.user:
            return redirect(url_for("auth.login"))
        return view(*args, **kwargs)
    return wrapped


def field(name, maximum, minimum=1):
    value = request.form.get(name, "").strip()
    if not minimum <= len(value) <= maximum:
        abort(400, description=f"{name.replace('_', ' ').capitalize()} must be {minimum}–{maximum} characters.")
    return value


def revoke_session():
    old = session.get("auth_token")
    if old:
        execute("DELETE FROM auth_sessions WHERE token_hash=%s", (token_hash(old),))
    session.clear()


def sign_in(user_id):
    revoke_session()
    token = secrets.token_urlsafe(32)
    execute("INSERT INTO auth_sessions(token_hash,user_id,expires_at) "
            "VALUES (%s,%s,UTC_TIMESTAMP() + INTERVAL 12 HOUR)", (token_hash(token), user_id))
    session["auth_token"] = token
    session.permanent = True


def throttle():
    # Shared DB-backed fixed window across WSGI workers. No proxy-header trust.
    key = token_hash(request.remote_addr or "unknown")
    with transaction():
        execute("INSERT INTO login_attempts (client_hash) VALUES (%s)", (key,))
    count = query("SELECT COUNT(*) AS n FROM login_attempts WHERE client_hash=%s "
                  "AND attempted_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE", (key,), one=True)["n"]
    if count > 30:
        abort(429, description="Too many sign-in attempts. Try again in 15 minutes.")


@bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        throttle()
        name = field("display_name", 100)
        email = field("email", 254).lower()
        if email.count("@") != 1 or any(c.isspace() for c in email) or not all(email.split("@")):
            abort(400, description="Enter a valid email address.")
        password = request.form.get("password", "")
        if not 12 <= len(password) <= 128:
            abort(400, description="Use a password between 12 and 128 characters.")
        user_id = execute("INSERT INTO users(email,display_name,password_hash) VALUES(%s,%s,%s)",
                          (email, name, generate_password_hash(password, method="scrypt")))
        sign_in(user_id)
        flash("Your workspace is ready.", "success")
        return redirect(url_for("main.papers"))
    return render_template("auth.html", registering=True)


@bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        throttle()
        email = field("email", 254).lower()
        password = request.form.get("password", "")
        if len(password) > 128:
            abort(400)
        user = query("SELECT * FROM users WHERE email=%s", (email,), one=True)
        # Hash on the missing-user path to avoid a trivially fast account-existence signal.
        stored = user["password_hash"] if user else generate_password_hash("unavailable-account")
        valid = check_password_hash(stored, password)
        if not user or not valid:
            return render_template("auth.html", registering=False, error="Email or password is incorrect."), 401
        sign_in(user["user_id"])
        return redirect(url_for("main.workspace"))
    return render_template("auth.html", registering=False)


@bp.post("/logout")
@login_required
def logout():
    revoke_session()
    flash("Signed out.", "success")
    return redirect(url_for("main.papers"))
