# Research Budgeting Tool

Web app for clinical-trial site budgeting at an Academic Medical Center. Takes
a client-supplied Schedule of Activity (SOA) visit grid plus quantity
assumptions and produces (a) a per-visit Rate-Coverage breakdown and (b) a
Final Budget Presentation, both reproducible across negotiation rounds.

Status: **MVP** — backend (data model, SOA upload + parser, pricing engine,
budget rounds with overrides, xlsx exporters) and a Next.js frontend
(trials list, trial detail with SOA upload + quantities, round detail with
computed budget + overrides + exports) are in place. **No auth yet** —
runs locally only.

## Layout

```
research-budgeting-tool/
├── backend/        FastAPI + SQLAlchemy
│   ├── app/
│   │   ├── models/        SQLAlchemy ORM models
│   │   ├── schemas/       Pydantic schemas
│   │   ├── routes/        FastAPI routers
│   │   ├── services/      pricing engine, xlsx I/O (TODO)
│   │   └── seed/          one-shot importers
│   └── pyproject.toml
├── frontend/       Next.js (TODO)
└── samples/        Reference xlsx files (SOA, PRA, Final Budget)
```

## Local setup

### Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/python -m app.seed.import_pra        # seeds price master + fixed fees
.venv/bin/uvicorn app.main:app --reload        # http://127.0.0.1:8000
```

Open `http://127.0.0.1:8000/docs` for the interactive API docs.

### Frontend
```bash
cd frontend
npm install
npm run dev                                    # http://localhost:3000
```

Note: on macOS use `127.0.0.1`, not `localhost`, if other services are
already bound to port 8000 over IPv6.

## Domain model

- **PriceMasterVersion** — immutable snapshot of all procedures + AMC prices.
  New version = new row; old trials stay pegged to the version they were
  quoted against.
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
- **AuditLog** — append-only edit log.

## Pricing rules

- AMC total = `amc_base_charge × (1 + overhead_pct)` (default OH 40%).
- Stipends are excluded from OH (`excluded_from_oh = true`).
- For SHARED lines, sponsor/medicare split is stored per-procedure
  (e.g. PI = 60/40 by default).
- Trial cost rolls up by visit: for each applicable cell, multiply
  procedure total by that visit's `completion_count`.
- Fixed fees and pass-throughs are added on top from the active template.

## Next milestones

1. Auth (multi-user) — required before cloud deploy.
2. Migrate from `Base.metadata.create_all` to Alembic.
3. Postgres for cloud deploy (data model is already Postgres-compatible).
4. Side-by-side round comparison view in the UI.
5. Admin UI for editing the price master (currently only seed-importable).
6. Audit log surfacing in the UI.
