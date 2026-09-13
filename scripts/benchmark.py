"""Reproducible synthetic multi-table index experiment. Dedicated test DB only."""
import argparse
import json
import os
from pathlib import Path
import platform
import statistics
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from navigator import create_app  # noqa: E402
from navigator.db import connect  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--rows", type=int, default=30000)
parser.add_argument("--output", type=Path, default=Path("docs/evidence/benchmark.json"))
args = parser.parse_args()
if not 1000 <= args.rows <= 200000:
    parser.error("--rows must be between 1000 and 200000")
app = create_app({"MYSQL_DATABASE": os.environ.get("TEST_MYSQL_DATABASE", "navigator_test")})
if app.config["MYSQL_DATABASE"] != "navigator_test":
    raise SystemExit("Only the dedicated navigator_test database is allowed.")
conn = connect(app.config)
query_sql = """SELECT p.paper_id,p.title,pa.author_order,a.display_name
FROM (SELECT paper_id,title FROM bench_papers WHERE publication_year=%s
      ORDER BY paper_id DESC LIMIT 20) p
JOIN bench_paper_authors pa ON pa.paper_id=p.paper_id
JOIN bench_authors a ON a.author_id=pa.author_id
ORDER BY p.paper_id DESC,pa.author_order"""
with conn.cursor() as c:
    c.execute("SELECT VERSION() AS version,@@transaction_isolation AS isolation_level")
    server = c.fetchone()
    # Refuse to replace any existing experiment. Preserve the previous raw evidence.
    c.execute("SHOW TABLES LIKE 'bench_papers'")
    if c.fetchone():
        raise SystemExit("Benchmark tables already exist. Preserve results and use a fresh dedicated test database.")
    c.execute("CREATE TABLE bench_papers(paper_id BIGINT PRIMARY KEY,title VARCHAR(150) NOT NULL,publication_year INT NOT NULL) ENGINE=InnoDB")
    c.execute("CREATE TABLE bench_authors(author_id BIGINT PRIMARY KEY,display_name VARCHAR(100) NOT NULL) ENGINE=InnoDB")
    c.execute("CREATE TABLE bench_paper_authors(paper_id BIGINT NOT NULL,author_id BIGINT NOT NULL,author_order INT NOT NULL,PRIMARY KEY(paper_id,author_id),FOREIGN KEY(paper_id) REFERENCES bench_papers(paper_id),FOREIGN KEY(author_id) REFERENCES bench_authors(author_id)) ENGINE=InnoDB")
    c.executemany("INSERT INTO bench_authors VALUES(%s,%s)", [(i, f"Synthetic author {i}") for i in range(1,201)])
    for start in range(1, args.rows+1, 1000):
        ids = range(start, min(start+1000, args.rows+1))
        c.executemany("INSERT INTO bench_papers VALUES(%s,%s,%s)",
                      [(i, f"Synthetic benchmark paper {i}", 1970+i%57) for i in ids])
        c.executemany("INSERT INTO bench_paper_authors VALUES(%s,%s,%s)",
                      [(i, (i+j)%200+1, j+1) for i in ids for j in range(2)])
    c.execute("ANALYZE TABLE bench_papers,bench_authors,bench_paper_authors")

    def measure():
        c.execute("EXPLAIN FORMAT=JSON " + query_sql, (2026,))
        plan = json.loads(next(iter(c.fetchone().values())))
        c.execute("EXPLAIN ANALYZE " + query_sql, (2026,))
        analyze = next(iter(c.fetchone().values()))
        # Warm cache, identical query and response materialization in both cases.
        for _ in range(3):
            c.execute(query_sql, (2026,))
            c.fetchall()
        times = []
        for _ in range(20):
            t = time.perf_counter_ns()
            c.execute(query_sql, (2026,))
            result = c.fetchall()
            times.append((time.perf_counter_ns()-t)/1e6)
        return {"explain_json": plan, "explain_analyze": analyze, "milliseconds": times,
                "median_ms": statistics.median(times), "returned_rows": len(result),
                "result": result}

    before = measure()
    c.execute("CREATE INDEX bench_year_id ON bench_papers(publication_year,paper_id)")
    c.execute("ANALYZE TABLE bench_papers")
    after = measure()
    assert before["result"] == after["result"]
result = {"recorded_at": datetime.now(timezone.utc).isoformat(), "python": platform.python_version(),
          "os": platform.system(), "machine": platform.machine(), "mysql": server,
          "paper_rows": args.rows, "author_rows": 200, "relationship_rows": args.rows*2,
          "source": "Deterministic synthetic data; no real papers or users", "query": query_sql,
          "parameters": [2026], "warmups": 3, "repeats": 20, "before": before, "after": after,
          "notes": "Client wall-clock includes transfer/materialization; warm local cache, single client. Estimated cost is not elapsed milliseconds. Small isolated experiment, not production throughput."}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2)+"\n")
print(f"Recorded {args.rows} papers, {args.rows*2} relations. Before median {before['median_ms']:.3f} ms; after {after['median_ms']:.3f} ms. Results identical.")
conn.close()
