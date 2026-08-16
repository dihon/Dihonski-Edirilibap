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
- Verified: 26/26 backend pytest pass; all critical frontend flows pass.

## Backlog / Remaining
- **P1**: Online payment (GCash/card) integration; real map + GPS live tracking; SMS OTP for phone login (currently low-assurance).
- **P2**: Driver earnings summary; ratings/reviews; scheduled rides; promo/fare surge config in admin; push notifications (on request).

## Next Tasks
- Gather feedback on fare zones/pricing accuracy for Tagkawayan.
- Consider driver onboarding/verification flow.
