# edirilibap — Tagkawayan Ride & Pabili 🛺

A local **tricycle-hailing + market-delivery (pabili)** platform built specifically for **Tagkawayan, Quezon**. It combines passenger transport and "pabili" (market/errand delivery) in one friendly mobile app, with dedicated experiences for **Customers**, **Drivers**, and an **Admin** dashboard.

- **Customer**: book a tricycle ride (landmark pickup/drop-off + live fare), request a pabili (browse local stores or type a shopping list), track orders, rate drivers, and pay Cash or GCash (manual reference).
- **Driver**: apply with documents for admin approval, go online, accept ride/pabili jobs, advance job status, confirm GCash payments, and view earnings & ratings.
- **Admin**: review & approve/reject driver applications (with uploaded documents), manage users, review complaints and suspend drivers, and monitor stats.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend (mobile)** | Expo (React Native) + Expo Router, TypeScript |
| **Backend (API)** | FastAPI (Python), Motor (async MongoDB driver) |
| **Database** | MongoDB |
| **Auth** | JWT (email+password or phone+name), bcrypt hashing |
| **File storage** | Emergent Managed Object Storage (driver documents) |

### Project structure
```
.
├── backend/                # FastAPI app
│   ├── server.py           # All API routes (/api/*)
│   ├── requirements.txt
│   └── .env                # Backend environment variables (not committed)
├── frontend/               # Expo (React Native) app
│   ├── app/                # Expo Router screens (file-based routing)
│   ├── src/                # Shared components, theme, api client, auth
│   ├── assets/             # Icons, splash, images
│   ├── app.json            # Expo config (name, icon, splash, plugins)
│   ├── package.json
│   └── .env                # Frontend environment variables (not committed)
└── README.md
```

---

## ✅ Prerequisites (all operating systems)

Install these before you begin:

- **Node.js 20 LTS** and a package manager (**Yarn 1.x** — this project uses Yarn)
- **Python 3.11+** and `pip`
- **MongoDB 6+** (local install, or a free MongoDB Atlas cluster)
- **Git**
- **Expo Go** app on your phone (App Store / Google Play) for on-device testing
- (Optional) **Watchman** on macOS for faster file watching

---

## 💻 Installation by OS

### 🍎 macOS

```bash
# 1. Install Homebrew (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install core tools
brew install node@20 yarn python@3.11 git watchman
brew tap mongodb/brew && brew install mongodb-community@7.0

# 3. Start MongoDB
brew services start mongodb-community@7.0
```

### 🪟 Windows (PowerShell)

The easiest route is **winget** (built into Windows 10/11):

```powershell
# 1. Install core tools
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.11
winget install Git.Git
winget install MongoDB.Server

# 2. Enable Yarn (bundled with Node via Corepack)
corepack enable

# 3. Start MongoDB (installed as a Windows service named "MongoDB")
net start MongoDB
```
> Tip: Use **Git Bash** or **PowerShell** for the commands below. For a Linux-like experience you can also use **WSL2** and follow the Linux steps.

### 🐧 Linux (Ubuntu/Debian)

```bash
# 1. Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Yarn, Python, Git
sudo corepack enable          # enables yarn
sudo apt-get install -y python3 python3-pip python3-venv git

# 3. MongoDB (see official docs for your distro), then:
sudo systemctl start mongod
```

---

## ⚙️ Configuration (environment variables)

Create the two `.env` files (they are **not** committed to git).

**`backend/.env`**
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="edirilibap"
JWT_SECRET="change-this-to-a-long-random-string"
JWT_EXP_HOURS="720"
ADMIN_EMAIL="admin@tagkawayan.ph"
ADMIN_PASSWORD="admin12345"
ADMIN_NAME="Tagkawayan Admin"
# Required only for driver document uploads (Emergent Object Storage):
EMERGENT_LLM_KEY="your-emergent-key"
```

**`frontend/.env`**
```env
EXPO_PUBLIC_BACKEND_URL="http://localhost:8001"
```
> On a physical phone, replace `localhost` with your computer's LAN IP (e.g. `http://192.168.1.10:8001`) so Expo Go can reach the backend. Android emulator uses `http://10.0.2.2:8001`.

---

## ▶️ Running the app (development)

Open **two terminals** — one for the backend, one for the frontend.

### 1) Backend (FastAPI)

```bash
cd backend

# Create & activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the API (seeds landmarks, stores, admin & sample drivers on first run)
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```
API base URL: `http://localhost:8001/api`

### 2) Frontend (Expo)

```bash
cd frontend

# Install dependencies
yarn install

# Start the Expo dev server
yarn start
```
Then:
- Press **`w`** to open in a web browser, **or**
- Scan the **QR code** with the **Expo Go** app on your phone.

Handy scripts:
```bash
yarn android   # open on Android emulator/device
yarn ios        # open on iOS simulator (macOS only)
yarn web        # run in browser
yarn lint       # lint the project
```

---

## 🧪 Default test accounts

| Role | How to log in |
|---|---|
| **Admin** | Email tab → `admin@tagkawayan.ph` / `admin12345` |
| **Driver** | Phone tab → `Mang Tonyo` / `+639171112201` |
| **Customer** | Sign up fresh (phone+name or email+password) |

---

## 🏗️ Compiling & building for production

This project is built and deployed with **Expo Application Services (EAS)**.

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Type-check (compile TypeScript)
```bash
cd frontend
npx tsc --noEmit
```

### Build native binaries
```bash
cd frontend

# Android (APK for testing, or AAB for the Play Store)
eas build --platform android --profile preview      # installable .apk
eas build --platform android --profile production    # .aab for Play Store

# iOS (requires an Apple Developer account) — macOS not required, EAS builds in the cloud
eas build --platform ios --profile production
```

### Publish an over-the-air (OTA) update
```bash
eas update --branch production --message "Update"
```

### Backend (production)
Run the FastAPI app with a production server:
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```
Point `EXPO_PUBLIC_BACKEND_URL` (in `frontend/.env`) at your deployed backend URL before building.

> **Note:** If you built this app on the **Emergent** platform, you can deploy and generate iOS/Android builds directly from the **Publish** button (top-right) → Deploy → Generate builds — no manual EAS setup needed.

---

## 🔐 Notes on security & storage

- Never commit `.env` files or secrets. Keep `JWT_SECRET`, admin credentials, and `EMERGENT_LLM_KEY` on the backend only.
- Driver documents are stored in object storage and served only to the owning user and admins through the backend (`/api/files/...`).
- Payment is Cash-on-Delivery or **manual GCash** (customer submits a reference number; driver/admin confirms) — no automatic payment gateway in this version.

---

## 🗑️ Account Deletion API

Lets a user delete their account (required by the App Store & Google Play), identified by **email or phone number**.

**Endpoint**
```
POST /api/account/delete
Authorization: Bearer <token>     # the logged-in user's JWT
Content-Type: application/json
```

**Request body** (provide at least one)
```json
{ "email": "user@example.com" }
// or
{ "phone": "+639170000000" }
```

**Rules**
- A regular user can delete **only their own** account (the email/phone must match the logged-in user).
- An **admin** can delete **any** account by email or phone.
- The **last remaining admin** account cannot be deleted (prevents lockout).
- Deleting an account also removes that user's **ratings** and **complaints**; ride/order history is retained.

**Responses**
| Code | Meaning |
|---|---|
| `200` | `{ "ok": true, "deleted_id": "<user id>" }` |
| `403` | A non-admin tried to delete another user's account |
| `404` | No account found for the given email/phone |
| `400` | Attempt to delete the last admin account |
| `422` | Neither email nor phone was provided |

**Examples**
```bash
# Self-service (delete your own account by phone)
curl -X POST "$API/account/delete" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+639170000000"}'

# Admin deletes a user by email
curl -X POST "$API/account/delete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

---

## 📄 License

Private project for Tagkawayan, Quezon. All rights reserved.