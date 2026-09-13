from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from werkzeug.exceptions import Conflict

from navigator.db import query
from navigator.services import batch_add, change_status
from conftest import make_list, post, scalar


def test_concurrent_duplicate_batch_add(app, alice):
    lid = make_list(alice)
    uid = scalar(app, "SELECT user_id FROM users WHERE email='alice@example.test'")
    barrier = Barrier(2)

    def add():
        with app.app_context():
            barrier.wait(timeout=10)
            return batch_add(lid, uid, [1, 2])

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(add), pool.submit(add)]
        results = [f.result(timeout=15) for f in futures]
    assert sorted(results) == [0, 2]
    assert scalar(app, "SELECT COUNT(*) FROM list_papers WHERE list_id=%s", (lid,)) == 2


def test_concurrent_progress_update_rejects_one_stale_writer(app, alice):
    uid = scalar(app, "SELECT user_id FROM users WHERE email='alice@example.test'")
    assert post(alice, "/papers/1/status", {"status": "want", "version": 0}).status_code == 302
    barrier = Barrier(2)

    def update(status):
        with app.app_context():
            barrier.wait(timeout=10)
            try:
                change_status(uid, 1, status, 1)
                return "saved"
            except Conflict:
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(update, "reading"), pool.submit(update, "read")]
        results = [f.result(timeout=15) for f in futures]
    assert sorted(results) == ["conflict", "saved"]
    with app.app_context():
        row = query("SELECT version,status FROM reading_states WHERE user_id=%s AND paper_id=1", (uid,), one=True)
        assert row["version"] == 2 and row["status"] in {"reading", "read"}
