# Research Budgeting Tool

Web app for clinical-trial site budgeting at an Academic Medical Center. Takes
a client-supplied Schedule of Activity (SOA) visit grid plus quantity
assumptions and produces (a) a per-visit Rate-Coverage breakdown and (b) a
Final Budget Presentation, both reproducible across negotiation rounds.

Status: **MVP feature-complete**. Backend (data model, SOA upload + parser,
pricing engine, budget rounds with overrides, xlsx exporters, audit log,
JWT auth, Alembic migrations, Postgres-ready). Frontend (trials list,
trial detail with SOA upload + quantities, round detail with computed
budget + overrides + exports, side-by-side round comparison, price-master
admin, fixed-fees admin, audit-log viewer, sign-in / register flow).

## Layout

```
research-budgeting-tool/
├── backend/        FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── models/        SQLAlchemy ORM models
│   │   ├── schemas/       Pydantic schemas
│   │   ├── routes/        FastAPI routers
│   │   ├── services/      pricing engine, xlsx I/O, auth, audit
│   │   └── seed/          one-shot importers
│   ├── alembic/           DB migrations
│   └── pyproject.toml
├── frontend/       Next.js 14 (App Router) + Tailwind
│   └── src/
│       ├── app/           pages
│       ├── components/    shared components (AuthBar)
│       └── lib/           API client + types
├── samples/        Reference xlsx files (SOA, PRA, Final Budget)
└── docker-compose.yml      Postgres for cloud-mirror local dev
```

## Local setup (SQLite)

### Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/alembic upgrade head                  # apply schema
.venv/bin/python -m app.seed.import_pra         # seed price master + fixed fees
.venv/bin/uvicorn app.main:app --reload         # http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API docs.

### Frontend
```bash
cd frontend
npm install
npm run dev                                     # http://localhost:3000
```

The first registered user automatically becomes ADMIN. Subsequent users are
ANALYST. (Auth is currently optional on most endpoints — sign in to attribute
audit-log entries; the app still works anonymously locally.)

Note: on macOS use `127.0.0.1`, not `localhost`, if other services are
already bound to port 8000 over IPv6.

## Postgres setup (cloud-mirror)

```bash
docker compose up -d                            # start postgres
cp backend/.env.example backend/.env
# edit backend/.env to set:
#   DATABASE_URL=postgresql+psycopg://rbt:rbt@localhost:5432/rbt
#   JWT_SECRET=<a-real-secret>
cd backend
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed.import_pra
.venv/bin/uvicorn app.main:app --reload
```

## Domain model

- **PriceMasterVersion** — immutable snapshot of all procedures + AMC prices.
  Drafts are editable; once published, prices are locked. Trials peg to a
  specific version so historical budgets stay reproducible.
- **Procedure / ProcedurePrice** — per-line-item: code, category, coverage
  status (QCT-Covered / Research-Required / Shared), Medicare rate, AMC base
  charge, OH %, sponsor/medicare share for Shared lines.
- **FixedFeeTemplate / FixedFee** — versioned site-fee + pass-through table
  (identical across clients in MVP).
- **Trial** — one client engagement, pegged to a price-master and fixed-fee
  version.
- **TrialSOACell** — the (procedure × visit) cells the client marked applicable.
- **TrialQuantity** — per-visit enrollment + completion counts.
- **BudgetRound + BudgetRoundOverride** — frozen negotiation snapshots with
  optional per-line price/fee overrides.
- **AuditLog** — append-only edit log (auto-attributed to the signed-in user).
- **User** — email/password auth with ADMIN/ANALYST/VIEWER roles.

## Pricing rules

- AMC total = `amc_base_charge × (1 + overhead_pct)` (default OH 40%).
- Stipends are excluded from OH (`excluded_from_oh = true`).
- For SHARED lines, sponsor/medicare split is stored per-procedure
  (e.g. PI = 60/40 by default).
- Trial cost rolls up by visit: for each applicable cell, multiply
  procedure total by that visit's `completion_count`.
- Fixed fees and pass-throughs are added on top from the active template.

## Key endpoints

- **Auth**: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- **Price master**: `GET /price-master/versions`, `POST /price-master/versions`
  (clone), `POST .../publish`, `PUT .../procedures/{id}`
- **Trials**: `POST /trials`, `POST /trials/{id}/soa` (xlsx upload),
  `PUT /trials/{id}/quantities`
- **Budget rounds**: `POST /trials/{id}/rounds`, `POST .../freeze`,
  `POST .../overrides`, `GET .../compute`
- **Exports**: `GET .../export/final-budget`, `GET .../export/pra`
- **Audit**: `GET /audit?entity_type=trial`

## Migrations

```bash
cd backend
.venv/bin/alembic revision --autogenerate -m "what changed"
.venv/bin/alembic upgrade head
```

## Deploy: AWS Amplify (frontend) + Render (backend + Postgres)

The recommended cheap host: ~**$0/mo** to start (free tiers), ~**$14/mo** at scale (Render Starter + Postgres). Frontend on AWS Amplify since you already have an account.

### One-time prep

1. Push this repo to GitHub.
2. Create accounts on [render.com](https://render.com) (free, no credit card needed for free tier).

### Backend on Render (Blueprint)

Render reads [`render.yaml`](render.yaml) and provisions both the web service and the Postgres database in one shot.

1. **Render dashboard** → **New** → **Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml`, shows the plan, click **Apply**. It provisions:
   - `rbt-backend` (Docker web service, free plan)
   - `rbt-postgres` (free Postgres database, 90-day retention)
   - Auto-wires `DATABASE_URL` and generates a strong `JWT_SECRET`
3. The first deploy will fail health checks until you set CORS — that's expected. Continue:
4. Open the deployed backend URL (something like `https://rbt-backend.onrender.com`) — copy it, you'll paste it into Amplify.
5. **Seed the price master** (one-time): Render dashboard → `rbt-backend` → **Shell** → run:
   ```bash
   python -m app.seed.import_pra
   ```

> **Free-tier caveats**: Render's free web service sleeps after 15 min of inactivity (~30s cold start on next request). Free Postgres is destroyed after 90 days. Bump the backend to Starter ($7/mo) and Postgres to Basic-256mb ($7/mo) before this becomes a real workflow — total ~$14/mo.

### Frontend on AWS Amplify

1. **AWS Amplify Console** → **New app** → **Host web app** → connect GitHub → pick this repo.
2. Amplify auto-detects the [`amplify.yml`](amplify.yml) at the repo root. Review the build settings — it sets `appRoot: frontend`, runs `npm ci && npm run build`, ships `.next/`.
3. Add the **environment variable**:
   ```
   NEXT_PUBLIC_API_URL = https://rbt-backend.onrender.com
   ```
   (paste the Render URL from above; no trailing slash)
4. Click **Save and deploy**. Build takes ~2 min.
5. Amplify gives you a URL like `https://main.dxxxxx.amplifyapp.com`. Copy it.

### Wire CORS

Back in Render → `rbt-backend` → **Environment** → set:
```
CORS_ORIGINS = https://main.dxxxxx.amplifyapp.com
```
(Use the exact Amplify URL. Add a trailing comma + a second URL if you have a custom domain too.)

Render auto-redeploys. Within ~1 min, the frontend can talk to the backend.

### First-run sanity check

1. Open the Amplify URL.
2. Click **Sign in** → **Register**. The first registered user becomes `ADMIN` automatically.
3. Open the **Price Master** tab — you should see the seeded version with 65 procedures.
4. Create a trial, upload [samples/Client SOA Example.xlsx](samples/Client%20SOA%20Example.xlsx), set quantities (Fill all = 100), create a round, click **Compute**. Grand total should populate.

### What it costs

| Component | Free tier | Real usage |
|---|---|---|
| Render web service | $0 (sleeps after 15 min) | $7/mo (Starter) |
| Render Postgres | $0 (90-day retention) | $7/mo (Basic-256mb) |
| AWS Amplify hosting | $0 first 12 months (1000 build min, 5 GB stored, 15 GB served) | $1–3/mo after free tier |
| **Total** | **$0–3/mo** | **~$15–17/mo** |

### Operational notes

- **Migrations** run automatically on every deploy via the Dockerfile's `CMD` (`alembic upgrade head`).
- **Logs**: Render dashboard → service → Logs. Live tail.
- **Secrets**: never commit `.env` or `JWT_SECRET`. Render's `generateValue: true` gives you a strong random one on first deploy; rotate it via the dashboard if it's ever exposed.
- **Updating prices**: don't run the seed importer again — instead, use the in-app **Price Master** admin UI to clone the current version, edit the procedures that changed, and publish. Old trials stay pinned to the version they were quoted against.
