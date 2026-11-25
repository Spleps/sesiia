#!/usr/bin/env python3
"""Імпортує з stdin рядки «питання :: відповідь» для вказаного предмета."""
import hashlib, json, os, sys, urllib.request
SUBJ = {"phys", "chem", "hist", "math", "info", "eng", "nsp", "pe"}
subj = sys.argv[1] if len(sys.argv) > 1 else ""
if subj not in SUBJ:
    sys.exit(f"предмет має бути одним з: {' '.join(sorted(SUBJ))}")
src = sys.argv[2] if len(sys.argv) > 2 else "photo"
recs = []
for line in sys.stdin.read().splitlines():
    if "::" in line:
        q, a = (x.strip() for x in line.split("::", 1))
        if q and a:
            recs.append({"subject": subj, "q": q, "a": a, "source": src,
                         "key": f"{src}:{subj}:" + hashlib.sha1(q.encode()).hexdigest()[:16]})
if not recs:
    sys.exit("немає рядків формату «питання :: відповідь»")
req = urllib.request.Request(os.environ.get("SP_URL", "http://127.0.0.1:8095").rstrip("/") + "/api/cards/upsert", json.dumps(recs).encode(), {"Content-Type": "application/json"})
r = json.loads(urllib.request.urlopen(req, timeout=20).read())
print(f"Сесія: додано {r['added']}, оновлено {r['updated']} карток ({subj})")
