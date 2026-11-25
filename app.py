#!/usr/bin/env python3
"""Сесія — локальний застосунок для підготовки до іспитів із базою SQLite."""
import json, os, sqlite3, sys, threading, mimetypes, urllib.parse, datetime as dt
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB = Path(os.environ.get("SP_DB", BASE / "data.db"))
FILES = Path(os.environ.get("SP_FILES", BASE / "materials")).resolve()
HOST = os.environ.get("SP_HOST", "127.0.0.1")
PORT = int(os.environ.get("SP_PORT", "8095"))
INTERVALS = [0, 1, 2, 4, 8, 16, 32]  # days for Leitner boxes 0..6
STATUSES = ("todo", "ready", "submitted")
lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY, key TEXT UNIQUE, name TEXT, form TEXT, credits REAL,
  teacher TEXT, color TEXT, exam_date TEXT, notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, subject TEXT, title TEXT, kind TEXT, status TEXT,
  file TEXT, note TEXT, due TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY, subject TEXT, title TEXT, url TEXT);
CREATE TABLE IF NOT EXISTS cards(id INTEGER PRIMARY KEY, subject TEXT, q TEXT, a TEXT, box INTEGER DEFAULT 0,
  due TEXT, wrong INTEGER DEFAULT 0, right INTEGER DEFAULT 0, source TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, card INTEGER, ok INTEGER, at TEXT);
CREATE TABLE IF NOT EXISTS deleted_keys(key TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY, subject TEXT, title TEXT, kind TEXT, points REAL, max REAL, date TEXT, note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS absences(id INTEGER PRIMARY KEY, subject TEXT, date TEXT, topic TEXT, status TEXT DEFAULT 'todo', file TEXT DEFAULT '', note TEXT DEFAULT '');
"""

def today():
    return dt.date.today().isoformat()

from contextlib import contextmanager

@contextmanager
def conn():
    """Commit on success, roll back on error, always close (no leaked SQLite handles)."""
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()

def rows(c, sql, *a):
    return [dict(r) for r in c.execute(sql, a)]

def migrate(c):
    cols = [r[1] for r in c.execute("PRAGMA table_info(cards)")]
    for col in ("q_view", "a_view", "f_view", "src_a"):  # edited wording; shown while the source answer is still src_a
        if col not in cols:
            c.execute(f"ALTER TABLE cards ADD COLUMN {col} TEXT")
    for t in ("cards", "items"):
        cols = [r[1] for r in c.execute(f"PRAGMA table_info({t})")]
        if "key" not in cols:
            c.execute(f"ALTER TABLE {t} ADD COLUMN key TEXT")
            c.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {t}_key ON {t}(key)")
    if not c.execute("SELECT 1 FROM subjects WHERE key='new'").fetchone() and c.execute("SELECT COUNT(*) FROM subjects").fetchone()[0]:
        c.execute("INSERT INTO subjects(key,name,form,credits,teacher,color) VALUES('new','Вхідні завдання','',0,'перевір і перенеси в предмет або видали','#9a6bd6')")

def upsert(table, recs):
    """Insert new records by unique key; for existing ones update content but keep progress/status."""
    added = updated = 0
    with lock, conn() as c:
        for r in recs:
            k = r.get("key")
            if not k or c.execute("SELECT 1 FROM deleted_keys WHERE key=?", (k,)).fetchone():
                continue
            row = c.execute(f"SELECT id FROM {table} WHERE key=?", (k,)).fetchone()
            if table == "cards":
                if row:
                    c.execute("UPDATE cards SET q_view=CASE WHEN q=? THEN q_view END, subject=?, q=?, a=? WHERE id=?",
                              (r["q"], r["subject"], r["q"], r["a"], row["id"])); updated += 1
                else:
                    c.execute("INSERT INTO cards(subject,q,a,due,source,key) VALUES(?,?,?,?,?,?)",
                              (r["subject"], r["q"], r["a"], today(), r.get("source", ""), k)); added += 1
            else:
                if row:
                    c.execute("UPDATE items SET note=?, due=? WHERE id=?", (r.get("note", ""), r.get("due"), row["id"])); updated += 1
                else:
                    c.execute("INSERT INTO items(subject,title,kind,status,file,note,due,updated,key) VALUES(?,?,?,?,?,?,?,?,?)",
                              (r.get("subject", "new"), r["title"], r.get("kind", ""), r.get("status", "todo"), r.get("file", ""),
                               r.get("note", ""), r.get("due"), today(), k)); added += 1
    return {"added": added, "updated": updated}

def init():
    with conn() as c:
        c.executescript(SCHEMA)
        migrate(c)
        if c.execute("SELECT v FROM meta WHERE k='seeded'").fetchone():
            return
        seed = json.loads((BASE / "seed.json").read_text())
        c.execute("INSERT INTO meta VALUES('session_start',?)", (seed["session"]["start"],))
        c.execute("INSERT INTO meta VALUES('session_end',?)", (seed["session"]["end"],))
        for s in seed["subjects"]:
            c.execute("INSERT INTO subjects(key,name,form,credits,teacher,color) VALUES(?,?,?,?,?,?)",
                      (s["key"], s["name"], s["form"], s["credits"], s["teacher"], s["color"]))
        for subj, title, url in seed["materials"]:
            c.execute("INSERT INTO materials(subject,title,url) VALUES(?,?,?)", (subj, title, url))
        for subj, title, kind, status, f, note in seed["items"]:
            c.execute("INSERT INTO items(subject,title,kind,status,file,note,updated) VALUES(?,?,?,?,?,?,?)",
                      (subj, title, kind, status, f, note, today()))
        cards = BASE / "cards.json"
        if cards.exists():
            for subj, lst in json.loads(cards.read_text()).items():
                for q, a in lst:
                    c.execute("INSERT INTO cards(subject,q,a,due,source) VALUES(?,?,?,?,?)", (subj, q, a, today(), "seed"))
        c.execute("INSERT INTO meta VALUES('seeded','1')")
    with conn() as c:
        migrate(c)

def state():
    with conn() as c:
        meta = {r["k"]: r["v"] for r in rows(c, "SELECT * FROM meta")}
        subj = rows(c, "SELECT * FROM subjects ORDER BY CASE form WHEN 'Е' THEN 0 WHEN 'ЗД' THEN 1 ELSE 2 END, id")
        items = rows(c, "SELECT * FROM items ORDER BY subject, id")
        mats = rows(c, "SELECT * FROM materials ORDER BY subject, id")
        t = today()
        stats = {r["subject"]: r for r in rows(c, """SELECT subject, COUNT(*) total,
            SUM(due<=?) due, SUM(box>=4) learned FROM cards GROUP BY subject""", t)}
        rev = rows(c, "SELECT substr(at,1,10) d, COUNT(*) n, SUM(ok) ok FROM reviews GROUP BY d ORDER BY d DESC LIMIT 14")
        grades = rows(c, "SELECT * FROM grades ORDER BY subject, date, id")
        absences = rows(c, "SELECT * FROM absences ORDER BY date, id")
    return {"meta": meta, "today": t, "subjects": subj, "items": items, "materials": mats,
            "cardStats": stats, "reviews": rev, "grades": grades, "absences": absences}

def theme(subject, q):
    if " — " in q:
        return q.split(" — ")[0]
    if subject == "hist" and ":" in q:
        return q.split(":")[0]
    return "Загальні питання"

def weak(days=21):
    """Error rate per topic from recent reviews; topics with at least 2 answers, worst first."""
    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    agg = {}
    with conn() as c:
        for r in c.execute("""SELECT cards.subject, cards.q, reviews.ok FROM reviews JOIN cards ON cards.id = reviews.card
                              WHERE reviews.at >= ?""", (since,)):
            k = (r["subject"], theme(r["subject"], r["q"]))
            a = agg.setdefault(k, [0, 0]); a[0] += 1; a[1] += 1 - r["ok"]
        cards = {}
        for r in c.execute("SELECT subject, q, box FROM cards"):
            k = (r["subject"], theme(r["subject"], r["q"]))
            v = cards.setdefault(k, [0, 0]); v[0] += 1; v[1] += r["box"] >= 4
    out = [{"subject": s, "theme": t, "answers": n, "wrong": w, "rate": round(w / n, 2),
            "cards": cards.get((s, t), [0, 0])[0], "learned": cards.get((s, t), [0, 0])[1]}
           for (s, t), (n, w) in agg.items() if n >= 2 and w]
    return sorted(out, key=lambda x: (-x["rate"], -x["wrong"]))

def due_cards(subject, limit):
    with conn() as c:
        q = "SELECT * FROM cards WHERE due<=?" + (" AND subject=?" if subject else "") + " ORDER BY box, RANDOM() LIMIT ?"
        args = [today()] + ([subject] if subject else []) + [limit]
        return rows(c, q, *args)

def review(card_id, ok, event=None):
    with lock, conn() as c:
        r = c.execute("SELECT box FROM cards WHERE id=?", (card_id,)).fetchone()
        if not r:
            return None
        if event:
            c.execute("CREATE TABLE IF NOT EXISTS review_events(event TEXT PRIMARY KEY)")
            if not c.execute("INSERT OR IGNORE INTO review_events VALUES(?)", (event,)).rowcount:
                return {"box": 0, "duplicate": True}
        box = min(r["box"] + 1, len(INTERVALS) - 1) if ok else 0
        due = (dt.date.today() + dt.timedelta(days=INTERVALS[box] if ok else 0)).isoformat()
        c.execute("UPDATE cards SET box=?, due=?, right=right+?, wrong=wrong+? WHERE id=?",
                  (box, due, int(ok), int(not ok), card_id))
        c.execute("INSERT INTO reviews(card,ok,at) VALUES(?,?,?)", (card_id, int(ok), dt.datetime.now().isoformat(timespec="seconds")))
        return {"box": box, "due": due}

EDIT = {"items": ("subject", "title", "kind", "status", "file", "note", "due"),
        "subjects": ("exam_date", "notes", "teacher"),
        "materials": ("subject", "title", "url"),
        "cards": ("subject", "q", "a"),
        "grades": ("subject", "title", "kind", "points", "max", "date", "note"),
        "absences": ("subject", "date", "topic", "status", "file", "note")}
LISTS = ("items", "materials", "cards", "grades", "absences")

class H(BaseHTTPRequestHandler):
    server_version = "SessionPrep/1"

    def log_message(self, fmt, *a):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _safe(self, fn):
        try:
            fn()
        except (ValueError, KeyError, TypeError, IndexError) as e:  # bad JSON, id, limit, missing field
            self.send(400, {"error": f"хибний запит: {type(e).__name__}"})
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"ERROR {self.command} {self.path}: {e!r}\n")
            self.send(500, {"error": "помилка сервера"})

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def do_GET(self):
        self._safe(self._get)

    def _get(self):
        u = urllib.parse.urlparse(self.path)
        p, qs = u.path, urllib.parse.parse_qs(u.query)
        if p in ("/", "/index.html"):
            return self.send(200, (BASE / "static/index.html").read_bytes(), "text/html; charset=utf-8")
        if p.startswith("/static/"):
            f = (BASE / "static" / Path(p).name)
            if f.suffix not in (".js", ".css", ".json") or not f.is_file():
                return self.send(404, {"error": "не знайдено"})
            return self.send(200, f.read_bytes(), {".js": "text/javascript", ".css": "text/css", ".json": "application/json"}[f.suffix] + "; charset=utf-8")
        if p == "/api/tickets":
            return self.send(200, (BASE / "tickets.json").read_bytes())
        if p == "/api/weak":
            return self.send(200, weak(int(qs.get("days", ["21"])[0])))
        if p == "/api/state":
            return self.send(200, state())
        if p == "/api/cards/due":
            return self.send(200, due_cards(qs.get("subject", [""])[0], int(qs.get("limit", ["30"])[0])))
        if p == "/api/cards":
            with conn() as c:
                s = qs.get("subject", [""])[0]
                return self.send(200, rows(c, "SELECT * FROM cards" + (" WHERE subject=?" if s else "") + " ORDER BY id", *([s] if s else [])))
        if p.startswith("/files/"):
            rel = urllib.parse.unquote(p[len("/files/"):])
            f = (FILES / rel).resolve()
            if not str(f).startswith(str(FILES) + os.sep) or not f.is_file():
                return self.send(404, {"error": "файл не знайдено на сервері"})
            ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
            if f.suffix == ".md":
                ctype = "text/plain; charset=utf-8"
            disp = "inline" if ctype.startswith(("text/", "image/")) or ctype == "application/pdf" else "attachment"
            return self.send(200, f.read_bytes(), ctype,
                             {"Content-Disposition": f"{disp}; filename*=UTF-8''{urllib.parse.quote(f.name)}"})
        self.send(404, {"error": "не знайдено"})

    def do_POST(self):
        self._safe(self._post)

    def _post(self):
        p = urllib.parse.urlparse(self.path).path
        b = self.body()
        if p.startswith("/api/cards/") and p.endswith("/review"):
            r = review(int(p.split("/")[3]), bool(b.get("ok")), b.get("event"))
            return self.send(200 if r else 404, r or {"error": "картку не знайдено"})
        if p in ("/api/cards/upsert", "/api/items/upsert"):
            return self.send(200, upsert(p.split("/")[2], b if isinstance(b, list) else b.get("records", [])))
        if p == "/api/meta":
            with lock, conn() as c:
                for k, v in b.items():
                    c.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", (k, str(v)))
            return self.send(200, {"ok": True})
        if p == "/api/cards/import":
            subj, text = b.get("subject"), b.get("text", "")
            n = 0
            with lock, conn() as c:
                for line in text.splitlines():
                    if "::" in line:
                        q, a = (x.strip() for x in line.split("::", 1))
                        if q and a:
                            c.execute("INSERT INTO cards(subject,q,a,due,source) VALUES(?,?,?,?,?)", (subj, q, a, today(), "import"))
                            n += 1
            return self.send(200, {"added": n})
        table = p.strip("/").split("/")[-1]
        if table in LISTS:
            cols = [k for k in EDIT[table] if k in b]
            if table == "items":
                b.setdefault("status", "todo"); cols = list(dict.fromkeys(cols + ["status"]))
            if table == "cards":
                cols += ["due"]; b["due"] = today()
            with lock, conn() as c:
                cur = c.execute(f"INSERT INTO {table}({','.join(cols)}) VALUES({','.join('?' * len(cols))})", [b[k] for k in cols])
            return self.send(200, {"id": cur.lastrowid})
        self.send(404, {"error": "не знайдено"})

    def do_PATCH(self):
        self._safe(self._patch)

    def _patch(self):
        parts = urllib.parse.urlparse(self.path).path.strip("/").split("/")
        if len(parts) == 3 and parts[1] in EDIT:
            b = self.body()
            cols = [k for k in EDIT[parts[1]] if k in b]
            if parts[1] == "items" and "status" in b and b["status"] not in STATUSES:
                return self.send(400, {"error": "невідомий стан"})
            if not cols:
                return self.send(400, {"error": "немає змін"})
            extra = ", updated=?" if parts[1] == "items" else ""
            if parts[1] == "cards":  # a manual edit replaces the stored nicer wording
                extra = (", q_view=NULL" if "q" in b else "") + (", a_view=NULL, f_view=NULL" if "a" in b else "")
            vals = [b[k] for k in cols] + ([today()] if extra else []) + [int(parts[2])]
            with lock, conn() as c:
                c.execute(f"UPDATE {parts[1]} SET {', '.join(k + '=?' for k in cols)}{extra} WHERE id=?", vals)
            return self.send(200, {"ok": True})
        self.send(404, {"error": "не знайдено"})

    def do_DELETE(self):
        self._safe(self._delete)

    def _delete(self):
        parts = urllib.parse.urlparse(self.path).path.strip("/").split("/")
        if len(parts) == 3 and parts[1] in LISTS:
            with lock, conn() as c:
                if parts[1] in ("items", "cards"):
                    c.execute(f"INSERT OR IGNORE INTO deleted_keys SELECT key FROM {parts[1]} WHERE id=? AND key IS NOT NULL", (int(parts[2]),))
                c.execute(f"DELETE FROM {parts[1]} WHERE id=?", (int(parts[2]),))
            return self.send(200, {"ok": True})
        self.send(404, {"error": "не знайдено"})

if __name__ == "__main__":
    init()
    print(f"Сесія · http://{HOST}:{PORT} · матеріали: {FILES}", flush=True)
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
