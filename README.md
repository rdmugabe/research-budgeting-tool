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
