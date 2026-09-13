"""Business boundaries: transactions, ownership, and optimistic version checks."""
from flask import abort

from .db import execute, get_db, query, transaction


def owned_list(list_id, user_id, *, lock=False):
    row = query("SELECT * FROM reading_lists WHERE list_id=%s AND owner_id=%s" +
                (" FOR UPDATE" if lock else ""), (list_id, user_id), one=True)
    if not row:
        abort(404, description="Reading list not found.")
    return row


def batch_add(list_id, user_id, paper_ids):
    """Serialize all changes to one list. Any missing paper rolls the entire batch back."""
    added = 0
    with transaction():
        owned_list(list_id, user_id, lock=True)
        for paper_id in dict.fromkeys(paper_ids):
            if not query("SELECT paper_id FROM papers WHERE paper_id=%s", (paper_id,), one=True):
                abort(400, description=f"Paper {paper_id} does not exist; no papers were added.")
            with get_db().cursor() as cur:
                cur.execute("INSERT INTO list_papers(list_id,paper_id) VALUES(%s,%s) "
                            "ON DUPLICATE KEY UPDATE paper_id=list_papers.paper_id", (list_id, paper_id))
                added += cur.rowcount == 1
        if added:
            execute("UPDATE reading_lists SET updated_at=CURRENT_TIMESTAMP,version=version+1 "
                    "WHERE list_id=%s", (list_id,))
    return added


def remove_paper(list_id, user_id, paper_id):
    with transaction():
        owned_list(list_id, user_id, lock=True)
        execute("DELETE FROM list_papers WHERE list_id=%s AND paper_id=%s", (list_id, paper_id))
        execute("UPDATE reading_lists SET updated_at=CURRENT_TIMESTAMP,version=version+1 "
                "WHERE list_id=%s", (list_id,))


def change_status(user_id, paper_id, status, expected_version):
    if status not in {"want", "reading", "read"}:
        abort(400, description="Choose want, reading, or read.")
    with transaction():
        if not query("SELECT paper_id FROM papers WHERE paper_id=%s", (paper_id,), one=True):
            abort(404)
        if expected_version == 0:
            # Unique (user_id,paper_id) is the final arbiter under simultaneous first writes.
            execute("INSERT INTO reading_states(user_id,paper_id,status) VALUES(%s,%s,%s)",
                    (user_id, paper_id, status))
        else:
            with get_db().cursor() as cur:
                cur.execute("UPDATE reading_states SET status=%s,version=version+1 "
                            "WHERE user_id=%s AND paper_id=%s AND version=%s",
                            (status, user_id, paper_id, expected_version))
                if cur.rowcount != 1:
                    abort(409, description="Reading progress changed in another tab. Reload before saving.")
