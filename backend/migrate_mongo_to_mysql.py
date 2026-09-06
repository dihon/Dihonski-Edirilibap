"""One-time migration: copy all documents from the local MongoDB into MariaDB.
Safe to re-run: uses INSERT ... ON DUPLICATE KEY UPDATE (upsert by id)."""
import os
import json
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient
import pymysql

load_dotenv(Path(__file__).parent / '.env')

COLLECTIONS = ['users', 'rides', 'orders', 'stores', 'landmarks', 'ratings', 'complaints', 'config']

mc = MongoClient(os.environ['MONGO_URL'])
mdb = mc[os.environ['DB_NAME']]

my = pymysql.connect(
    host=os.environ['MYSQL_HOST'], port=int(os.environ['MYSQL_PORT']),
    user=os.environ['MYSQL_USER'], password=os.environ['MYSQL_PASSWORD'],
    db=os.environ['MYSQL_DB'], charset='utf8mb4', autocommit=True,
)

with my.cursor() as cur:
    for name in COLLECTIONS:
        cur.execute(
            f"CREATE TABLE IF NOT EXISTS `{name}` ("
            "`id` VARCHAR(64) NOT NULL PRIMARY KEY, `doc` JSON NOT NULL) "
            "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        )
        docs = list(mdb[name].find({}, {'_id': 0}))
        migrated = 0
        for d in docs:
            _id = d.get('id')
            if not _id:
                continue
            cur.execute(
                f"INSERT INTO `{name}` (id, doc) VALUES (%s, %s) "
                "ON DUPLICATE KEY UPDATE doc=VALUES(doc)",
                (_id, json.dumps(d, default=str)),
            )
            migrated += 1
        print(f"{name}: {migrated}/{len(docs)} migrated")

my.close()
mc.close()
print("Migration complete.")
