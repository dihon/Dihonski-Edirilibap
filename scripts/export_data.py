"""Export all MongoDB collections to JSON files under /app/data.
Run: python scripts/export_data.py
Keep the /app/data folder committed to the repo as the latest data snapshot.
"""
import os
import json
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

COLLECTIONS = ["users", "landmarks", "stores", "rides", "orders", "ratings", "complaints"]

summary = {}
for name in COLLECTIONS:
    docs = list(db[name].find({}, {"_id": 0}))
    # Never export password hashes in the data snapshot
    if name == "users":
        for d in docs:
            d.pop("password", None)
    (OUT / f"{name}.json").write_text(json.dumps(docs, indent=2, default=str, ensure_ascii=False))
    summary[name] = len(docs)
    print(f"exported {name}: {len(docs)} docs")

(OUT / "_manifest.json").write_text(json.dumps({"collections": summary}, indent=2))
print("done ->", OUT)
