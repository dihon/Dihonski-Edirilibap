# Database Schema (`schema/`)

This folder contains the **MariaDB / MySQL** target schema for the edirilibap
(Tagkawayan Ride & Pabili) app.

- **`schema.sql`** — full DDL: creates the `edirilibap` database and all tables
  (`users`, `landmarks`, `stores`, `store_items`, `rides`, `orders`,
  `order_items`, `ratings`, `complaints`) with indexes and foreign keys.

## Apply to your MariaDB
```bash
mysql -h <HOST> -u <USER> -p < schema/schema.sql
```

## Keep it in sync
Whenever the app's data model changes, `schema.sql` is updated in the same
change so this file always reflects the current structure. A matching data
snapshot is exported to the [`data/`](../data) folder.

> The app currently runs on MongoDB (the platform-managed database). This schema
> is the migration target for moving to a MariaDB/MySQL instance.
