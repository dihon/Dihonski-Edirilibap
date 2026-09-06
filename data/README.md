# Data Snapshot (`data/`)

A JSON export of all application data, one file per collection/table. Regenerated
by `scripts/export_data.py` and committed to the repo as the latest snapshot.

| File | Contents |
|---|---|
| `users.json` | Accounts (customers, drivers, admins). **Password hashes are stripped.** |
| `landmarks.json` | Pickup/drop-off points and fare zones |
| `stores.json` | Pabili stores with their items |
| `rides.json` | Tricycle ride records |
| `orders.json` | Pabili orders (with items) |
| `ratings.json` | Driver ratings |
| `complaints.json` | Complaints filed against drivers |
| `_manifest.json` | Record counts per collection |

## Regenerate the snapshot
```bash
python scripts/export_data.py
```

## Load into MariaDB
1. Create the schema first: `mysql -u USER -p < schema/schema.sql`
2. Import the JSON (embedded arrays such as `stores.items` / `orders.items`
   map to `store_items` / `order_items`). Use your preferred ETL, or a small
   loader script, to insert these records.

> Note: this is a point-in-time snapshot of the **preview** database. The
> production database is separate and diverges after deployment.
