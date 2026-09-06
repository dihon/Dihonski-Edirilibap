-- ============================================================================
-- edirilibap (Tagkawayan Ride & Pabili) — MariaDB / MySQL target schema
-- ----------------------------------------------------------------------------
-- This DDL mirrors the application's current data model (presently stored in
-- MongoDB). It is the migration target for a MariaDB/MySQL database.
-- Keep this file in sync whenever the data model changes.
--   Engine: InnoDB   Charset: utf8mb4
-- ============================================================================

CREATE DATABASE IF NOT EXISTS edirilibap
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE edirilibap;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Users (customers, drivers, admins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                    CHAR(36)     NOT NULL PRIMARY KEY,
  name                  VARCHAR(160) NOT NULL,
  email                 VARCHAR(190) NULL,
  phone                 VARCHAR(32)  NULL,
  password              VARCHAR(255) NULL,               -- bcrypt hash (email accounts only)
  role                  ENUM('customer','driver','admin') NOT NULL DEFAULT 'customer',
  online                TINYINT(1)   NOT NULL DEFAULT 0,
  driver_status         ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none',
  banned                TINYINT(1)   NOT NULL DEFAULT 0,
  ban_reason            VARCHAR(255) NULL,
  rating_avg            DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  rating_count          INT          NOT NULL DEFAULT 0,
  tricycle_no           VARCHAR(40)  NULL,
  driver_docs           JSON         NULL,               -- { id_card, orcr, tricycle_photo } object-storage paths
  rejection_reason      VARCHAR(255) NULL,
  pending_deletion      TINYINT(1)   NOT NULL DEFAULT 0,
  deletion_requested_at DATETIME     NULL,
  applied_at            DATETIME     NULL,
  created_at            DATETIME     NOT NULL,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  KEY idx_users_role (role),
  KEY idx_users_driver_status (driver_status),
  KEY idx_users_pending_deletion (pending_deletion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Landmarks (pickup / drop-off points, used for fare zones)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landmarks (
  id    CHAR(36)     NOT NULL PRIMARY KEY,
  name  VARCHAR(160) NOT NULL,
  zone  INT          NOT NULL DEFAULT 2,
  KEY idx_landmarks_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Stores + items (pabili catalog)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stores (
  id        CHAR(36)     NOT NULL PRIMARY KEY,
  name      VARCHAR(160) NOT NULL,
  category  VARCHAR(80)  NULL,
  image     TEXT         NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS store_items (
  id        CHAR(36)      NOT NULL PRIMARY KEY,
  store_id  CHAR(36)      NOT NULL,
  name      VARCHAR(160)  NOT NULL,
  price     DECIMAL(10,2) NULL,
  unit      VARCHAR(40)   NULL,
  KEY idx_store_items_store (store_id),
  CONSTRAINT fk_store_items_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Rides (tricycle hailing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rides (
  id                  CHAR(36)      NOT NULL PRIMARY KEY,
  customer_id         CHAR(36)      NOT NULL,
  customer_name       VARCHAR(160)  NULL,
  customer_phone      VARCHAR(32)   NULL,
  pickup              VARCHAR(160)  NOT NULL,
  dropoff             VARCHAR(160)  NOT NULL,
  passengers          INT           NOT NULL DEFAULT 1,
  note                TEXT          NULL,
  fare                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method      ENUM('cash','gcash') NOT NULL DEFAULT 'cash',
  payment_status      ENUM('cash_on_delivery','unpaid','submitted','confirmed') NOT NULL DEFAULT 'cash_on_delivery',
  gcash_ref           VARCHAR(80)   NULL,
  status              ENUM('requested','accepted','arriving','in_progress','completed','cancelled') NOT NULL DEFAULT 'requested',
  driver_id           CHAR(36)      NULL,
  driver_name         VARCHAR(160)  NULL,
  driver_phone        VARCHAR(32)   NULL,
  driver_tricycle     VARCHAR(40)   NULL,
  driver_rating       DECIMAL(3,2)  NULL,
  driver_rating_count INT           NULL,
  rated               TINYINT(1)    NOT NULL DEFAULT 0,
  rating_stars        INT           NULL,
  complaint_filed     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at          DATETIME      NOT NULL,
  updated_at          DATETIME      NOT NULL,
  KEY idx_rides_customer (customer_id),
  KEY idx_rides_driver (driver_id),
  KEY idx_rides_status (status),
  KEY idx_rides_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Pabili orders + items (preset store carts or free-text lists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                  CHAR(36)      NOT NULL PRIMARY KEY,
  customer_id         CHAR(36)      NOT NULL,
  customer_name       VARCHAR(160)  NULL,
  customer_phone      VARCHAR(32)   NULL,
  kind                ENUM('preset','custom') NOT NULL,
  store_id            CHAR(36)      NULL,
  store_name          VARCHAR(160)  NULL,
  custom_list         TEXT          NULL,
  note                TEXT          NULL,
  delivery_address    VARCHAR(255)  NOT NULL,
  items_total         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  service_fee         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estimated_total     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_method      ENUM('cash','gcash') NOT NULL DEFAULT 'cash',
  payment_status      ENUM('cash_on_delivery','unpaid','submitted','confirmed') NOT NULL DEFAULT 'cash_on_delivery',
  gcash_ref           VARCHAR(80)   NULL,
  status              ENUM('requested','accepted','shopping','delivering','completed','cancelled') NOT NULL DEFAULT 'requested',
  driver_id           CHAR(36)      NULL,
  driver_name         VARCHAR(160)  NULL,
  driver_phone        VARCHAR(32)   NULL,
  driver_tricycle     VARCHAR(40)   NULL,
  driver_rating       DECIMAL(3,2)  NULL,
  driver_rating_count INT           NULL,
  rated               TINYINT(1)    NOT NULL DEFAULT 0,
  rating_stars        INT           NULL,
  complaint_filed     TINYINT(1)    NOT NULL DEFAULT 0,
  created_at          DATETIME      NOT NULL,
  updated_at          DATETIME      NOT NULL,
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_driver (driver_id),
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id        CHAR(36)      NOT NULL PRIMARY KEY,
  order_id  CHAR(36)      NOT NULL,
  name      VARCHAR(160)  NOT NULL,
  qty       INT           NOT NULL DEFAULT 1,
  price     DECIMAL(10,2) NULL,
  unit      VARCHAR(40)   NULL,
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Ratings (customer -> driver, per completed job)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ratings (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  driver_id      CHAR(36)     NOT NULL,
  customer_id    CHAR(36)     NOT NULL,
  customer_name  VARCHAR(160) NULL,
  job_id         CHAR(36)     NOT NULL,
  job_type       ENUM('ride','pabili') NOT NULL,
  stars          INT          NOT NULL,
  comment        TEXT         NULL,
  created_at     DATETIME     NOT NULL,
  KEY idx_ratings_driver (driver_id),
  KEY idx_ratings_job (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Complaints (customer -> driver)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS complaints (
  id             CHAR(36)     NOT NULL PRIMARY KEY,
  customer_id    CHAR(36)     NOT NULL,
  customer_name  VARCHAR(160) NULL,
  driver_id      CHAR(36)     NOT NULL,
  driver_name    VARCHAR(160) NULL,
  job_id         CHAR(36)     NOT NULL,
  job_type       ENUM('ride','pabili') NOT NULL,
  category       ENUM('rude','scammer','unprofessional','abusive','drunk','need_police_action') NOT NULL,
  description    TEXT         NULL,
  status         ENUM('open','reviewed') NOT NULL DEFAULT 'open',
  created_at     DATETIME     NOT NULL,
  KEY idx_complaints_driver (driver_id),
  KEY idx_complaints_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
