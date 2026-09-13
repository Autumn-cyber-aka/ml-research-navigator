import math

from flask import Blueprint, abort, flash, g, redirect, render_template, request, url_for

from .auth import field, login_required
from .db import execute, query, transaction
from .services import batch_add, change_status, owned_list, remove_paper

bp = Blueprint("main", __name__)
PAGE_SIZE = 12


def number(value, *, minimum=1, maximum=2**63-1):
    try:
        result = int(value)
    except (ValueError, TypeError):
        abort(400, description="Expected a whole number.")
    if not minimum <= result <= maximum:
        abort(400, description="Number is outside the allowed range.")
    return result


def page_number():
    return number(request.args.get("page", "1"), maximum=10000)


def like(value):
    # Treat search as literal substring, with an explicit SQL escape character.
    return "%" + value.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%"


def catalogue_filters():
    term = request.args.get("q", "").strip()
    author = request.args.get("author", "").strip()
    year = request.args.get("year", "").strip()
    if len(term) > 200 or len(author) > 200:
        abort(400, description="Search text must be at most 200 characters.")
    clauses, params = [], []
    if term:
        clauses.append("(p.title LIKE %s ESCAPE '!' OR p.abstract LIKE %s ESCAPE '!')")
        params.extend([like(term), like(term)])
    if author:
        clauses.append("EXISTS (SELECT 1 FROM paper_authors pa JOIN authors a ON a.author_id=pa.author_id "
                       "WHERE pa.paper_id=p.paper_id AND a.display_name LIKE %s ESCAPE '!')")
        params.append(like(author))
    if year:
        clauses.append("p.publication_year=%s")
        params.append(number(year, minimum=1900, maximum=2100))
    return " AND ".join(clauses) or "1=1", params, {"q": term, "author": author, "year": year}


def attach_authors(papers):
    if not papers:
        return papers
    ids = [p["paper_id"] for p in papers]
    rows = query("SELECT pa.paper_id,a.author_id,a.display_name FROM paper_authors pa "
                 "JOIN authors a ON a.author_id=pa.author_id WHERE pa.paper_id IN (" +
                 ",".join(["%s"] * len(ids)) + ") ORDER BY pa.paper_id,pa.author_order", ids)
    by_id = {p["paper_id"]: p for p in papers}
    for p in papers:
        p["authors"] = []
    for row in rows:
        by_id[row["paper_id"]]["authors"].append(row)
    return papers


@bp.get("/")
@bp.get("/papers")
def papers():
    where, params, filters = catalogue_filters()
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM papers p WHERE " + where, params, one=True)["n"]
    items = query("SELECT p.* FROM papers p WHERE " + where +
                  " ORDER BY p.publication_year DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                  params + [PAGE_SIZE, (page - 1) * PAGE_SIZE])
    return render_template("papers.html", papers=attach_authors(items), total=total, filters=filters,
                           page=page, pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/papers/<int:paper_id>")
def paper_detail(paper_id):
    paper = query("SELECT * FROM papers WHERE paper_id=%s", (paper_id,), one=True)
    if not paper:
        abort(404)
    attach_authors([paper])
    state = None
    lists = []
    own_review = None
    if g.user:
        state = query("SELECT * FROM reading_states WHERE user_id=%s AND paper_id=%s",
                      (g.user["user_id"], paper_id), one=True)
        lists = query("SELECT list_id,name FROM reading_lists WHERE owner_id=%s ORDER BY name",
                      (g.user["user_id"],))
        own_review = query("SELECT * FROM reviews WHERE user_id=%s AND paper_id=%s",
                           (g.user["user_id"], paper_id), one=True)
    page = page_number()
    reviews = query("SELECT r.*,u.display_name FROM reviews r JOIN users u ON u.user_id=r.user_id "
                    "WHERE r.paper_id=%s ORDER BY r.created_at DESC,r.review_id DESC LIMIT %s OFFSET %s",
                    (paper_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    stats = query("SELECT COUNT(*) AS n,ROUND(AVG(rating),1) AS average FROM reviews WHERE paper_id=%s",
                  (paper_id,), one=True)
    posts = query("SELECT p.*,u.display_name FROM posts p JOIN users u ON u.user_id=p.user_id "
                  "WHERE p.paper_id=%s ORDER BY p.post_id DESC LIMIT 5", (paper_id,))
    return render_template("paper.html", paper=paper, state=state, lists=lists, reviews=reviews,
                           own_review=own_review, stats=stats, posts=posts, page=page,
                           pages=max(1, math.ceil(stats["n"]/PAGE_SIZE)))


@bp.get("/authors")
def authors():
    term = request.args.get("q", "").strip()
    if len(term) > 200:
        abort(400)
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM authors WHERE display_name LIKE %s ESCAPE '!'",
                  (like(term),), one=True)["n"]
    rows = query("SELECT a.*, (SELECT COUNT(*) FROM paper_authors pa WHERE pa.author_id=a.author_id) "
                 "AS paper_count FROM authors a WHERE a.display_name LIKE %s ESCAPE '!' "
                 "ORDER BY a.display_name,a.author_id LIMIT %s OFFSET %s", (like(term), PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("authors.html", authors=rows, q=term, total=total, page=page,
                           pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/authors/<int:author_id>")
def author_detail(author_id):
    author = query("SELECT * FROM authors WHERE author_id=%s", (author_id,), one=True)
    if not author:
        abort(404)
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM paper_authors WHERE author_id=%s", (author_id,), one=True)["n"]
    rows = query("SELECT p.* FROM papers p JOIN paper_authors pa ON pa.paper_id=p.paper_id "
                 "WHERE pa.author_id=%s ORDER BY p.publication_year DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                 (author_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("author.html", author=author, papers=attach_authors(rows), page=page,
                           pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/workspace")
@login_required
def workspace():
    uid = g.user["user_id"]
    status = request.args.get("status", "")
    if status and status not in {"want", "reading", "read"}:
        abort(400)
    page = page_number()
    clause = " AND s.status=%s" if status else ""
    args = [uid] + ([status] if status else [])
    total = query("SELECT COUNT(*) AS n FROM reading_states s WHERE s.user_id=%s" + clause, args, one=True)["n"]
    rows = query("SELECT p.*,s.status,s.version FROM reading_states s JOIN papers p ON p.paper_id=s.paper_id "
                 "WHERE s.user_id=%s" + clause + " ORDER BY s.updated_at DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                 args + [PAGE_SIZE, (page-1)*PAGE_SIZE])
    counts = query("SELECT status,COUNT(*) AS n FROM reading_states WHERE user_id=%s GROUP BY status", (uid,))
    summary = {"want": 0, "reading": 0, "read": 0}
    summary.update({r["status"]: r["n"] for r in counts})
    return render_template("workspace.html", papers=attach_authors(rows), counts=summary, status=status,
                           page=page, pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.post("/papers/<int:paper_id>/status")
@login_required
def save_status(paper_id):
    change_status(g.user["user_id"], paper_id, request.form.get("status"),
                  number(request.form.get("version"), minimum=0))
    flash("Reading progress saved.", "success")
    return redirect(url_for("main.paper_detail", paper_id=paper_id))


@bp.route("/lists", methods=["GET", "POST"])
@login_required
def lists():
    uid = g.user["user_id"]
    if request.method == "POST":
        list_id = execute("INSERT INTO reading_lists(owner_id,name,description) VALUES(%s,%s,%s)",
                          (uid, field("name", 150), field("description", 2000, 0)))
        return redirect(url_for("main.list_detail", list_id=list_id))
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM reading_lists WHERE owner_id=%s", (uid,), one=True)["n"]
    # Preaggregate by list, so multiple authors never inflate paper counts.
    rows = query("SELECT l.*,COUNT(lp.paper_id) AS paper_count," 
                 "SUM(CASE WHEN s.status='read' THEN 1 ELSE 0 END) AS finished "
                 "FROM reading_lists l LEFT JOIN list_papers lp ON lp.list_id=l.list_id "
                 "LEFT JOIN reading_states s ON s.paper_id=lp.paper_id AND s.user_id=l.owner_id "
                 "WHERE l.owner_id=%s GROUP BY l.list_id ORDER BY l.updated_at DESC,l.list_id DESC "
                 "LIMIT %s OFFSET %s", (uid, PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("lists.html", lists=rows, page=page, pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.get("/lists/<int:list_id>")
@login_required
def list_detail(list_id):
    item = owned_list(list_id, g.user["user_id"])
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM list_papers WHERE list_id=%s", (list_id,), one=True)["n"]
    rows = query("SELECT p.*,s.status FROM list_papers lp JOIN papers p ON p.paper_id=lp.paper_id "
                 "LEFT JOIN reading_states s ON s.paper_id=p.paper_id AND s.user_id=%s "
                 "WHERE lp.list_id=%s ORDER BY lp.created_at DESC,p.paper_id DESC LIMIT %s OFFSET %s",
                 (g.user["user_id"], list_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("list.html", item=item, papers=attach_authors(rows), total=total,
                           page=page, pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.post("/lists/<int:list_id>/edit")
@login_required
def edit_list(list_id):
    name, description = field("name", 150), field("description", 2000, 0)
    version = number(request.form.get("version"))
    with transaction():
        item = owned_list(list_id, g.user["user_id"], lock=True)
        if item["version"] != version:
            abort(409, description="This list changed. Reload before editing.")
        execute("UPDATE reading_lists SET name=%s,description=%s,version=version+1 WHERE list_id=%s",
                (name, description, list_id))
    flash("List updated.", "success")
    return redirect(url_for("main.list_detail", list_id=list_id))


@bp.post("/lists/<int:list_id>/delete")
@login_required
def delete_list(list_id):
    with transaction():
        item = owned_list(list_id, g.user["user_id"], lock=True)
        if number(request.form.get("version")) != item["version"]:
            abort(409, description="This list changed. Reload before deleting.")
        execute("DELETE FROM reading_lists WHERE list_id=%s", (list_id,))
    flash("List deleted. Your reading progress is unchanged.", "success")
    return redirect(url_for("main.lists"))


@bp.post("/lists/<int:list_id>/papers")
@login_required
def add_papers(list_id):
    values = request.form.get("paper_ids", "").replace(",", " ").split()
    if not 1 <= len(values) <= 100:
        abort(400, description="Enter between 1 and 100 paper IDs.")
    ids = [number(v) for v in values]
    added = batch_add(list_id, g.user["user_id"], ids)
    flash(f"Added {added} paper(s). Existing entries were kept once.", "success")
    return redirect(url_for("main.list_detail", list_id=list_id))


@bp.post("/papers/<int:paper_id>/add-to-list")
@login_required
def add_to_list(paper_id):
    list_id = number(request.form.get("list_id"))
    batch_add(list_id, g.user["user_id"], [paper_id])
    flash("Paper saved to your list.", "success")
    return redirect(url_for("main.paper_detail", paper_id=paper_id))


@bp.post("/lists/<int:list_id>/papers/<int:paper_id>/remove")
@login_required
def remove_from_list(list_id, paper_id):
    remove_paper(list_id, g.user["user_id"], paper_id)
    return redirect(url_for("main.list_detail", list_id=list_id))


@bp.post("/papers/<int:paper_id>/reviews")
@login_required
def create_review(paper_id):
    rating = number(request.form.get("rating"), maximum=5)
    body = field("body", 5000)
    execute("INSERT INTO reviews(paper_id,user_id,rating,body) VALUES(%s,%s,%s,%s)",
            (paper_id, g.user["user_id"], rating, body))
    flash("Review published.", "success")
    return redirect(url_for("main.paper_detail", paper_id=paper_id))


def owned_content(table, key, record_id, *, lock=False):
    # table/key only come from fixed internal call sites, never client input.
    row = query(f"SELECT * FROM {table} WHERE {key}=%s AND user_id=%s" + (" FOR UPDATE" if lock else ""),
                (record_id, g.user["user_id"]), one=True)
    if not row:
        abort(404)
    return row


@bp.post("/reviews/<int:review_id>/edit")
@login_required
def edit_review(review_id):
    with transaction():
        row = owned_content("reviews", "review_id", review_id, lock=True)
        if number(request.form.get("version")) != row["version"]:
            abort(409, description="Review changed. Reload before saving.")
        execute("UPDATE reviews SET rating=%s,body=%s,version=version+1 WHERE review_id=%s",
                (number(request.form.get("rating"), maximum=5), field("body", 5000), review_id))
    return redirect(url_for("main.paper_detail", paper_id=row["paper_id"]))


@bp.post("/reviews/<int:review_id>/delete")
@login_required
def delete_review(review_id):
    with transaction():
        row = owned_content("reviews", "review_id", review_id, lock=True)
        execute("DELETE FROM reviews WHERE review_id=%s", (review_id,))
    return redirect(url_for("main.paper_detail", paper_id=row["paper_id"]))


@bp.get("/papers/<int:paper_id>/discussion")
def discussions(paper_id):
    paper = query("SELECT * FROM papers WHERE paper_id=%s", (paper_id,), one=True)
    if not paper:
        abort(404)
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM posts WHERE paper_id=%s", (paper_id,), one=True)["n"]
    posts = query("SELECT p.*,u.display_name FROM posts p JOIN users u ON u.user_id=p.user_id "
                  "WHERE p.paper_id=%s ORDER BY p.post_id DESC LIMIT %s OFFSET %s",
                  (paper_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("discussions.html", paper=paper, posts=posts, page=page,
                           pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.post("/papers/<int:paper_id>/posts")
@login_required
def create_post(paper_id):
    post_id = execute("INSERT INTO posts(paper_id,user_id,title,body) VALUES(%s,%s,%s,%s)",
                      (paper_id, g.user["user_id"], field("title", 200), field("body", 10000)))
    return redirect(url_for("main.post_detail", post_id=post_id))


@bp.get("/posts/<int:post_id>")
def post_detail(post_id):
    post = query("SELECT p.*,u.display_name,pa.title AS paper_title FROM posts p "
                 "JOIN users u ON u.user_id=p.user_id JOIN papers pa ON pa.paper_id=p.paper_id "
                 "WHERE p.post_id=%s", (post_id,), one=True)
    if not post:
        abort(404)
    page = page_number()
    total = query("SELECT COUNT(*) AS n FROM replies WHERE post_id=%s", (post_id,), one=True)["n"]
    replies = query("SELECT r.*,u.display_name FROM replies r JOIN users u ON u.user_id=r.user_id "
                    "WHERE r.post_id=%s ORDER BY r.reply_id LIMIT %s OFFSET %s",
                    (post_id, PAGE_SIZE, (page-1)*PAGE_SIZE))
    return render_template("post.html", post=post, replies=replies, page=page,
                           pages=max(1, math.ceil(total/PAGE_SIZE)))


@bp.post("/posts/<int:post_id>/edit")
@login_required
def edit_post(post_id):
    with transaction():
        row = owned_content("posts", "post_id", post_id, lock=True)
        if number(request.form.get("version")) != row["version"]:
            abort(409, description="Post changed. Reload before saving.")
        execute("UPDATE posts SET title=%s,body=%s,version=version+1 WHERE post_id=%s",
                (field("title", 200), field("body", 10000), post_id))
    return redirect(url_for("main.post_detail", post_id=post_id))


@bp.post("/posts/<int:post_id>/delete")
@login_required
def delete_post(post_id):
    with transaction():
        row = owned_content("posts", "post_id", post_id, lock=True)
        execute("DELETE FROM posts WHERE post_id=%s", (post_id,))
    return redirect(url_for("main.paper_detail", paper_id=row["paper_id"]))


@bp.post("/posts/<int:post_id>/replies")
@login_required
def create_reply(post_id):
    execute("INSERT INTO replies(post_id,user_id,body) VALUES(%s,%s,%s)",
            (post_id, g.user["user_id"], field("body", 5000)))
    return redirect(url_for("main.post_detail", post_id=post_id))


@bp.post("/replies/<int:reply_id>/edit")
@login_required
def edit_reply(reply_id):
    with transaction():
        row = owned_content("replies", "reply_id", reply_id, lock=True)
        if number(request.form.get("version")) != row["version"]:
            abort(409, description="Reply changed. Reload before saving.")
        execute("UPDATE replies SET body=%s,version=version+1 WHERE reply_id=%s", (field("body", 5000), reply_id))
    return redirect(url_for("main.post_detail", post_id=row["post_id"]))


@bp.post("/replies/<int:reply_id>/delete")
@login_required
def delete_reply(reply_id):
    with transaction():
        row = owned_content("replies", "reply_id", reply_id, lock=True)
        execute("DELETE FROM replies WHERE reply_id=%s", (reply_id,))
    return redirect(url_for("main.post_detail", post_id=row["post_id"]))


@bp.get("/health")
def health():
    query("SELECT 1 AS ok", one=True)
    return {"status": "ok"}
