"""A minimal Motor(MongoDB)-compatible async layer backed by MariaDB/MySQL.

Each "collection" is a table with columns: id VARCHAR PRIMARY KEY, doc JSON.
Documents are stored as JSON so the existing document-shaped application code
(which uses uuid `id` fields and nested structures) works unchanged.

Only the subset of the Mongo API used by this app is implemented:
  find_one, find(+sort/skip/limit/to_list), insert_one, insert_many,
  update_one(+upsert), update_many, find_one_and_update,
  delete_one, delete_many, count_documents.
Supported filter operators: implicit equality, $or, $in, $nin, $exists, $regex(+$options i).
Supported update operator: $set (with upsert).
"""
import os
import re
import json
import asyncio
import aiomysql

# Collections this app uses (tables auto-created on startup)
COLLECTIONS = ['users', 'rides', 'orders', 'stores', 'landmarks', 'ratings', 'complaints', 'config']

_pool = None
_pool_lock = asyncio.Lock()


async def get_pool():
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = await aiomysql.create_pool(
                    host=os.environ['MYSQL_HOST'],
                    port=int(os.environ.get('MYSQL_PORT', '3306')),
                    user=os.environ['MYSQL_USER'],
                    password=os.environ['MYSQL_PASSWORD'],
                    db=os.environ['MYSQL_DB'],
                    autocommit=True,
                    charset='utf8mb4',
                    minsize=1,
                    maxsize=10,
                    pool_recycle=280,
                )
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


async def init_tables():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            for name in COLLECTIONS:
                await cur.execute(
                    f"CREATE TABLE IF NOT EXISTS `{name}` ("
                    "`id` VARCHAR(64) NOT NULL PRIMARY KEY, "
                    "`doc` JSON NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
                )


# --------------------------- filter / update helpers ---------------------------

def _match_value(cond, value):
    """Evaluate a single field condition against a document value."""
    if isinstance(cond, dict) and any(k.startswith('$') for k in cond):
        for op, arg in cond.items():
            if op == '$in':
                if value not in arg:
                    return False
            elif op == '$nin':
                if value in arg:
                    return False
            elif op == '$exists':
                exists = value is not _MISSING
                if bool(arg) != exists:
                    return False
            elif op == '$regex':
                flags = re.IGNORECASE if 'i' in (cond.get('$options') or '') else 0
                if value is _MISSING or value is None:
                    return False
                if not re.search(arg, str(value), flags):
                    return False
            elif op == '$options':
                continue
            else:
                return False
        return True
    # plain equality
    if value is _MISSING:
        return cond is None
    return value == cond


_MISSING = object()


def _matches(doc, flt):
    for key, cond in flt.items():
        if key == '$or':
            if not any(_matches(doc, sub) for sub in cond):
                return False
            continue
        if key == '$and':
            if not all(_matches(doc, sub) for sub in cond):
                return False
            continue
        value = doc.get(key, _MISSING)
        if not _match_value(cond, value):
            return False
    return True


def _apply_projection(doc, projection):
    if not projection:
        return doc
    # exclusion projection only (values == 0). Always ignore _id (never stored).
    excl = [k for k, v in projection.items() if v in (0, False) and k != '_id']
    if not excl:
        return doc
    return {k: v for k, v in doc.items() if k not in excl}


def _apply_update(doc, update):
    out = dict(doc)
    if '$set' in update:
        out.update(update['$set'])
    # (only $set is used by the app)
    return out


class _Result:
    def __init__(self, matched=0, modified=0, upserted_id=None):
        self.matched_count = matched
        self.modified_count = modified
        self.upserted_id = upserted_id


class _InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _InsertManyResult:
    def __init__(self, ids):
        self.inserted_ids = ids


# --------------------------- cursor ---------------------------

class Cursor:
    def __init__(self, collection, flt, projection):
        self._coll = collection
        self._flt = flt or {}
        self._proj = projection
        self._sort = None
        self._skip = 0
        self._limit = 0

    def sort(self, key, direction=1):
        self._sort = (key, direction)
        return self

    def skip(self, n):
        self._skip = int(n or 0)
        return self

    def limit(self, n):
        self._limit = int(n or 0)
        return self

    async def to_list(self, length=None):
        rows = await self._coll._load()
        docs = [d for d in rows if _matches(d, self._flt)]
        if self._sort:
            key, direction = self._sort

            def sort_key(d):
                v = d.get(key)
                return (v is None, v if v is not None else '')

            docs.sort(key=sort_key, reverse=(direction == -1))
        if self._skip:
            docs = docs[self._skip:]
        if self._limit:
            docs = docs[:self._limit]
        if length is not None and length >= 0:
            docs = docs[:length]
        return [_apply_projection(d, self._proj) for d in docs]


# --------------------------- collection ---------------------------

class Collection:
    def __init__(self, db, name):
        self._db = db
        self.name = name

    async def _load(self):
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(f"SELECT doc FROM `{self.name}`")
                rows = await cur.fetchall()
        out = []
        for (doc,) in rows:
            if isinstance(doc, (bytes, bytearray)):
                doc = doc.decode('utf-8')
            out.append(json.loads(doc) if isinstance(doc, str) else doc)
        return out

    async def find_one(self, flt=None, projection=None):
        flt = flt or {}
        # fast path: primary-key lookup
        if list(flt.keys()) == ['id'] and isinstance(flt['id'], str):
            pool = await get_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(f"SELECT doc FROM `{self.name}` WHERE id=%s", (flt['id'],))
                    row = await cur.fetchone()
            if not row:
                return None
            doc = row[0]
            if isinstance(doc, (bytes, bytearray)):
                doc = doc.decode('utf-8')
            return _apply_projection(json.loads(doc) if isinstance(doc, str) else doc, projection)
        for d in await self._load():
            if _matches(d, flt):
                return _apply_projection(d, projection)
        return None

    def find(self, flt=None, projection=None):
        return Cursor(self, flt, projection)

    async def count_documents(self, flt=None):
        flt = flt or {}
        if not flt:
            pool = await get_pool()
            async with pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(f"SELECT COUNT(*) FROM `{self.name}`")
                    return (await cur.fetchone())[0]
        return sum(1 for d in await self._load() if _matches(d, flt))

    async def _insert(self, doc):
        pool = await get_pool()
        _id = doc.get('id')
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    f"INSERT INTO `{self.name}` (id, doc) VALUES (%s, %s)",
                    (_id, json.dumps(doc, default=str)),
                )
        return _id

    async def insert_one(self, doc):
        _id = await self._insert(doc)
        return _InsertOneResult(_id)

    async def insert_many(self, docs):
        ids = []
        for d in docs:
            ids.append(await self._insert(d))
        return _InsertManyResult(ids)

    async def _save(self, doc):
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    f"UPDATE `{self.name}` SET doc=%s WHERE id=%s",
                    (json.dumps(doc, default=str), doc.get('id')),
                )

    async def update_one(self, flt, update, upsert=False):
        for d in await self._load():
            if _matches(d, flt):
                new = _apply_update(d, update)
                await self._save(new)
                return _Result(matched=1, modified=1)
        if upsert:
            base = {k: v for k, v in flt.items() if not k.startswith('$') and not isinstance(v, dict)}
            new = _apply_update(base, update)
            if 'id' not in new:
                import uuid
                new['id'] = str(uuid.uuid4())
            await self._insert(new)
            return _Result(matched=0, modified=0, upserted_id=new['id'])
        return _Result(matched=0, modified=0)

    async def update_many(self, flt, update):
        n = 0
        for d in await self._load():
            if _matches(d, flt):
                await self._save(_apply_update(d, update))
                n += 1
        return _Result(matched=n, modified=n)

    async def find_one_and_update(self, flt, update):
        for d in await self._load():
            if _matches(d, flt):
                await self._save(_apply_update(d, update))
                return d  # pre-update document (Mongo default)
        return None

    async def _delete(self, _id):
        pool = await get_pool()
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(f"DELETE FROM `{self.name}` WHERE id=%s", (_id,))

    async def delete_one(self, flt):
        for d in await self._load():
            if _matches(d, flt):
                await self._delete(d.get('id'))
                return _Result(matched=1, modified=1)
        return _Result(matched=0, modified=0)

    async def delete_many(self, flt):
        n = 0
        for d in await self._load():
            if _matches(d, flt):
                await self._delete(d.get('id'))
                n += 1
        return _Result(matched=n, modified=n)


class Database:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        coll = self._collections.get(name)
        if coll is None:
            coll = Collection(self, name)
            self._collections[name] = coll
        return coll


db = Database()
