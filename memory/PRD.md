# Tagkawayan Ride & Pabili — PRD

## Original Problem Statement
Build a mobile app: local tricycle-hailing + market-delivery platform specifically for Tagkawayan, Quezon — combining passenger transport and "pabili / market delivery".

## User Choices (locked)
- Roles: Customers + Drivers + Admin dashboard
- Auth: Phone + Name login AND Email + Password login (JWT)
- Pabili: Both preset store browsing AND custom typed shopping list
- Payment: Cash-on-delivery (online payment deferred)
- No AI features

## Architecture
- **Frontend**: Expo + expo-router (file-based). Route groups: `(auth)`, `(customer)`, `(driver)`, `(admin)`. Shared modules in `/src` (theme, api client, auth context, UI components). Keyboard via `react-native-keyboard-controller`. Images via `expo-image`.
- **Backend**: FastAPI + Motor (MongoDB), all routes `/api`-prefixed. JWT (bcrypt hashing). Idempotent seeding of landmarks, stores, admin, sample drivers on startup.
- **DB collections**: users, rides, orders, stores, landmarks (uuid `id` fields, `_id` excluded).

## User Personas
1. **Customer (local resident)** — books tricycle rides & requests market pabili; non-technical, needs big tap targets.
2. **Tricycle Driver** — goes online, accepts ride/pabili jobs, advances status, calls customer.
3. **Admin** — monitors stats, promotes users to driver/admin, views all orders.

## Core Requirements (static)
- Ride hailing with landmark pickup/dropoff + zone-based fare estimate.
- Pabili with preset store catalog (priced items + service fee) and free-text custom list.
- Real-time-ish order/ride tracking with status timeline (polling).
- Role-based navigation & backend authorization.

## Implemented (2026-06-16)
- JWT auth (phone+name & email+password), role routing, secure token storage.
- Customer: Home (2 service cards + recent activity), Book a Ride (picker, passengers, live fare), Pabili (browse stores + item cart, custom list), Activity list, Profile.
- Tracking screen: status timeline, driver card, call driver, cancel.
- Driver: online toggle, live requests feed, accept, My Jobs status advancement, call customer.
- Admin: Overview stats, Users management (role change + tricycle assignment), Orders list with filters, Profile.
- Backend: full ride & pabili lifecycles, driver requests/active/history, admin stats/users/orders. Seeded 20 Tagkawayan landmarks + 4 stores + admin + 2 drivers.

## Implemented (Round 2 — 2026-06-16)
- **Driver onboarding + approval**: customer applies from Profile, uploads 3 docs (Gov ID/License, OR/CR, Tricycle photo) to Emergent Object Storage; admin reviews thumbnails and Approves/Rejects (with reason). Only approved, non-banned drivers can go online.
- **Complaints**: customer files a complaint against the assigned driver after a completed trip — categories: rude, scammer, unprofessional, abusive, drunk, need_police_action + description. Admin reviews, marks reviewed, and can suspend/ban the driver.
- **Ratings & Trust**: customer rates driver 1–5 stars + comment after completion; driver rating aggregate shown on tracking driver card and driver Earnings.
- **Driver Earnings**: new Earnings tab — today / this week / all-time totals, job counts, and average rating.
- **GCash (manual)**: choose Cash or GCash at booking; GCash customer submits a reference number, driver/admin confirms receipt.
- Verified: 41/41 backend pytest pass; new admin/driver/customer flows pass frontend smoke test.

## Backlog / Remaining
- **P1**: Real gateway payment (PayMongo/Xendit for auto GCash); real map + GPS live tracking (build-time); SMS OTP for phone login.
- **P2**: Scheduled rides; promo/fare config in admin; complaint history for customers; driver payout reports; push notifications (on request).

## Next Tasks
- Gather feedback on fare zones/pricing accuracy for Tagkawayan.
- Consider driver onboarding/verification flow.

## Implemented (Round 3 — 2026-06)
- **Admin Pricing Config** (`(admin)/config.tsx`, new "Pricing" tab): base fare, per-zone rate, pabili base service fee, per-kg rate, per-item rate, ETA base/per-zone minutes — stored in `db.config` (id="pricing"), editable live. Endpoints: `GET/POST /api/admin/config`, public `GET /api/config`.
- **Dynamic fares**: `compute_fare` and pabili fee now read from config. Pabili delivery fee = base + per_kg×weight + per_item×item_count.
- **Pabili weight/item inputs**: custom list tab and preset store page collect weight (kg) & item count, show live delivery-fee preview.
- **ETA**: rides compute zone-distance ETA; orders use status-based ETA. Returned as `eta_minutes` from `GET /api/rides/{id}` & `/api/orders/{id}`. Tracking screen shows "Est. arrival ~X min" (auto-refreshes via existing 4s polling).
- **Order detail receipt**: tracking screen shows itemized fee breakdown (items + delivery fee) and declared weight/items for pabili; reachable by tapping any activity card.
- **Admin search boxes**: instant client-side search added to Users and Orders panels.

## Backlog (updated)
- MariaDB migration — user provided credentials (host dihonski.com, db tk_app). TCP 3306 reachable. NOT YET migrated (large effort; MongoDB still live).
- Trusted Badge for highly-rated drivers.
- Driver payout report export.
