"""Optional community features. Public sharing is always explicit and reversible."""
import math

from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for

from .auth import login_required
from .db import execute, query, transaction
from .routes import PAGE_SIZE, attach_authors, number, page_number
from .services import owned_list

bp = Blueprint("community", __name__)
VOTE_TARGETS = {
    "review": ("reviews", "review_votes", "review_id", "user_id"),
    "post": ("posts", "post_votes", "post_id", "user_id"),
    "list": ("reading_lists", "list_votes", "list_id", "owner_id"),
}


def attach_votes(kind, rows):
    if not rows:
        return rows
    _, votes, key, _ = VOTE_TARGETS[kind]
    ids = [r[key] for r in rows]
    uid = g.user["user_id"] if g.user else 0
    counts = query(f"SELECT {key},COUNT(*) AS votes,SUM(user_id=%s) AS voted FROM {votes} "
                   f"WHERE {key} IN (" + ",".join(["%s"]*len(ids)) + f") GROUP BY {key}", [uid]+ids)
    mapping = {r[key]: r for r in counts}
    for row in rows:
        stats = mapping.get(row[key], {})
        row["votes"] = stats.get("votes", 0)
        row["voted"] = bool(stats.get("voted", False))
    return rows


@bp.post("/votes/<kind>/<int:target_id>")
@login_required
def vote(kind, target_id):
    if kind not in VOTE_TARGETS:
        abort(404)
    action = request.form.get("action")
    if action not in {"like", "unlike"}:
        abort(400, description="Choose like or unlike.")
    table, votes, key, owner = VOTE_TARGETS[kind]
    with transaction():
        row = query(f"SELECT * FROM {table} WHERE {key}=%s FOR UPDATE", (target_id,), one=True)
        if not row or (kind == "list" and not row["is_public"]):
            abort(404)
        if row[owner] == g.user["user_id"]:
            abort(400, description="You cannot vote on your own content.")
        if action == "like":
            execute(f"INSERT INTO {votes}({key},user_id) VALUES(%s,%s) "
                    f"ON DUPLICATE KEY UPDATE user_id={votes}.user_id", (target_id, g.user["user_id"]))
        else:
            execute(f"DELETE FROM {votes} WHERE {key}=%s AND user_id=%s", (target_id, g.user["user_id"]))
    if kind == "review":
        destination = url_for("main.paper_detail", paper_id=row["paper_id"])
    elif kind == "post":
        destination = url_for("main.post_detail", post_id=target_id)
    else:
        destination = url_for("community.shared_list", list_id=target_id)
    return redirect(destination)


@bp.post("/lists/<int:list_id>/visibility")
@login_required
def visibility(list_id):
    value = request.form.get("visibility")
    if value not in {"public", "private"}:
        abort(400)
    with transaction():
        row = owned_list(list_id, g.user["user_id"], lock=True)
        if number(request.form.get("version")) != row["version"]:
            abort(409, description="The list changed. Reload before changing visibility.")
        execute("UPDATE reading_lists SET is_public=%s,version=version+1 WHERE list_id=%s",
                (value == "public", list_id))
    flash("List is now public. Reading progress remains private." if value == "public" else
          "List is now private; its shared link is no longer accessible.", "success")
    return redirect(url_for("main.list_detail", list_id=list_id))


@bp.get("/community/lists")
def shared_lists():
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM reading_lists WHERE is_public=TRUE", one=True)["n"]
    rows = query("SELECT l.*,u.display_name,(SELECT COUNT(*) FROM list_papers lp WHERE lp.list_id=l.list_id) "
                 "AS paper_count FROM reading_lists l JOIN users u ON u.user_id=l.owner_id "
                 "WHERE l.is_public=TRUE ORDER BY l.updated_at DESC,l.list_id DESC LIMIT %s OFFSET %s",
                 (PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("shared_lists.html", lists=attach_votes("list", rows), page=page,
                           pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/shared/lists/<int:list_id>")
def shared_list(list_id):
    row = query("SELECT l.*,u.display_name FROM reading_lists l JOIN users u ON u.user_id=l.owner_id "
                "WHERE l.list_id=%s AND l.is_public=TRUE", (list_id,), one=True)
    if not row:
        abort(404)
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM list_papers WHERE list_id=%s", (list_id,), one=True)["n"]
    papers = query("SELECT p.* FROM list_papers lp JOIN papers p ON p.paper_id=lp.paper_id "
                   "WHERE lp.list_id=%s ORDER BY lp.created_at DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                   (list_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    # Deliberately no reading_states join: public viewers never receive the owner's progress.
    return render_template("shared_list.html", item=attach_votes("list", [row])[0],
                           papers=attach_authors(papers), page=page, pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/leaderboard")
def leaderboard():
    minimum = number(request.args.get("minimum", "2"), maximum=1000)
    year = request.args.get("year", "").strip()
    params = []
    where = ""
    if year:
        where = "WHERE p.publication_year=%s"
        params.append(number(year, minimum=1900, maximum=2100))
    params.append(minimum)
    page = page_number()
    # Aggregate ratings and helpful votes separately to avoid multiplying review rows.
    base = ("FROM papers p JOIN (SELECT paper_id,COUNT(*) AS review_count,AVG(rating) AS average_rating "
            "FROM reviews GROUP BY paper_id) r ON r.paper_id=p.paper_id " + where +
            (" AND " if where else " WHERE ") + "r.review_count >= %s")
    total = query("SELECT COUNT(*) AS n " + base, params, one=True)["n"]
    rows = query("SELECT p.*,r.review_count,ROUND(r.average_rating,2) AS displayed_rating " + base +
                 " ORDER BY r.average_rating DESC,r.review_count DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                 params + [PAGE_SIZE, (page-1)*PAGE_SIZE])
    return render_template("leaderboard.html", papers=attach_authors(rows), minimum=minimum, year=year,
                           page=page, pages=max(1, math.ceil(total/PAGE_SIZE)), total=total)


@bp.get("/authors/<int:author_id>/network")
def network(author_id):
    author = query("SELECT * FROM authors WHERE author_id=%s", (author_id,), one=True)
    if not author:
        abort(404)
    rows = query("SELECT a.author_id,a.display_name,COUNT(DISTINCT other.paper_id) AS shared_papers "
                 "FROM paper_authors mine JOIN paper_authors other ON other.paper_id=mine.paper_id "
                 "AND other.author_id<>mine.author_id JOIN authors a ON a.author_id=other.author_id "
                 "WHERE mine.author_id=%s GROUP BY a.author_id,a.display_name "
                 "ORDER BY shared_papers DESC,a.author_id LIMIT 25", (author_id,))
    truncated = len(rows) > 24
    rows = rows[:24]
    for i, row in enumerate(rows):
        angle = 2*math.pi*i/max(1, len(rows)) - math.pi/2
        row.update(x=round(400+280*math.cos(angle), 2), y=round(290+210*math.sin(angle), 2))
    return render_template("network.html", author=author, neighbors=rows, truncated=truncated)
