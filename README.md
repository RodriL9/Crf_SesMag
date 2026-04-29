# Community Resource Finder (CRF)

Full-stack web application for locating **food, health, jobs, housing, legal, and government** community resources by ZIP code or city—with **optional** accounts for saving listings, requesting coverage, flagging stale data, and staff messaging.

**Course context:** CPS 3500 · Programming World Wide Web

---

## Why SESMag?

Development followed **SESMag** (**SocioeconomicMag**), the framework from Agarwal et al. (2023). It emphasizes not only technical access, but **privacy anxiety**, **plain language**, **unreliable devices**, **risk perception**, and **confidence** when something goes wrong.

| Persona | Role | Emphasis |
|--------|------|-----------|
| **DAV** | Lower-SES focus user | Guests can search and save locally without signing in; category-first browsing; visible privacy framing; anonymous flagging; no GPS required for core search |
| **ASH** | Signed-in resident | Saved resources synced to the server, ZIP/city coverage requests, notifications when saved listings change, staff messaging |
| **FEE** | Staff / admin | Curates **`resources`** in PostgreSQL, reviews **`resource_submissions`** (flags, ZIP requests), user admin, **`/api/admin/*`** guarded by JWT **and** role on the server |

The app intentionally keeps the **guest path** strong—SESMag warns that funneling DAV through registration first recreates exclusion.

---

## Architecture

```
Angular 17 SPA (frontend/crf-app)  ──HTTPS/JSON──▶  Express API (backend/src)
                                                         │
                                                         ▼
                                                  PostgreSQL (pg)
```

- **Frontend:** Angular 17, standalone **`AppComponent`**, `HttpClient`, template-driven forms, custom CSS (no Bootstrap/Tailwind). Screen flow is mostly **`viewMode`** state; **`app.routes.ts`** is empty by design so shared search/auth context stays in one shell. **`@angular/service-worker`** registers in **production** builds for cached shell assets.
- **Backend:** Node.js **Express**, `helmet`, `cors` (configured **`FRONTEND_URL`**), **`express-validator`**, `express-rate-limit` (stricter on **`/api/auth`**), bcrypt-hashed passwords, **JWT** bearer auth, Gmail-backed verification mail, optional **Google OAuth** sign-in.
- **Data:** PostgreSQL relational schema (**`users`**, **`resources`**, **`categories`**, **`saved_resources`**, **`resource_audit_log`**, **`resource_submissions`**, messaging tables). Initial listings are seeded and extended with **Google Places** (server-side **`GOOGLE_PLACES_API_KEY`** only).

---

## Repository layout

```
CRF_SESMAG/
├── backend/                 # Express API · db init & Places seed scripts
│   ├── .env.example
│   ├── db/schema/           # SQL migrations
│   └── src/app.js           # Route mounts · /api/*
├── frontend/crf-app/       # Angular CLI project
└── README.md                  # You are here
```

---

## Quick start (local)

### 1. Database & API

```bash
cd backend
cp .env.example .env            # Fill DB_*, JWT_*, FRONTEND_URL, Google/Gmail keys as needed
npm install
npm run init-db                 # Apply schema / categories
npm run seed                    # Optional: Places bulk seed (needs GOOGLE_PLACES_API_KEY)
npm run dev                     # Default http://localhost:8080
```

### 2. Angular client

```bash
cd frontend/crf-app
npm install
npm start                          
```

Configure the Angular app to call your backend base URL (`environment`/proxy) as needed for local dev.

### 3. Health check

Visit **`GET http://localhost:8080/api/health`** — expect **`{ "status": "ok" }`**.

---

## Google Cloud setup (summary)

| Concern | Notes |
|---------|--------|
| **Places API** | Text Search + Details for seed/import; restrict key appropriately |
| **Geocoding** | Used validate U.S. ZIPs before certain submissions/imports |
| **OAuth client** | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` for **`POST /api/auth/google`** |
| **Gmail** | Sender + refresh token for verification / transactional email |

Exact env names live in **`backend/.env.example`**.

---

## API surface (mounted in `backend/src/app.js`)

| Prefix | Auth | Purpose |
|--------|------|---------|
| `GET /api/health` | — | Liveness |
| `/api/auth` | Public (+ rate limit) | Register, login, Google, email verification |
| `/api/resources`, `/api/categories` | Mostly public | Search, listings, categories |
| `/api/saved`, `/api/notifications`, `/api/account` | JWT user | Saves, audit-driven notifications, profile / delete |
| `/api/submissions` | JWT optional | Flags, ZIP-style requests (`authOptional` for anonymous suggestions/flags where enabled) |
| `/api/messages` | JWT | User ↔ staff threads |
| `/api/admin` | JWT **+ admin** | Resources CRUD, import ZIP via Places, submission review, members, inbox |

Detailed handlers live under **`backend/src/routes/`** and **`backend/src/controllers/`**.

---

## Authors

**Rodrigo Leites-Mena** · **Freily Garcia**

---

## License / academic use

Provided for CPS 3500 coursework; 
