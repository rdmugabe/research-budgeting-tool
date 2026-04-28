# Research Budgeting Tool

Web app for clinical-trial site budgeting at an Academic Medical Center. Takes
a client-supplied Schedule of Activity (SOA) visit grid plus quantity
assumptions and produces (a) a per-visit Rate-Coverage breakdown and (b) a
Final Budget Presentation, both reproducible across negotiation rounds.

Status: **MVP scaffolding** — backend skeleton, data model, and PRA seed
importer in place. No frontend or auth yet.

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

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e .
.venv/bin/pip install httpx                   # for TestClient
.venv/bin/python -m app.seed.import_pra        # seeds price master + fixed fees
.venv/bin/uvicorn app.main:app --reload        # http://localhost:8000
```

Open `http://localhost:8000/docs` for the interactive API docs.

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

1. SOA upload endpoint + parser (match by procedure code, surface unmapped rows).
2. Quantities CRUD endpoint.
3. Pricing engine service (per-visit + trial roll-up, sponsor/medicare split).
4. xlsx export (Final Budget Presentation, PRA workbook).
5. Next.js frontend with spreadsheet-style SOA editor.
6. Auth (multi-user) before any cloud deploy.
7. Move from `Base.metadata.create_all` to Alembic migrations.
