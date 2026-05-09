from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import price_master, trial, budget, audit, auth

# Schema is managed by Alembic — run `alembic upgrade head` before starting
# the app for the first time or after pulling new migrations.

app = FastAPI(title="Research Budgeting Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(price_master.router)
app.include_router(trial.router)
app.include_router(budget.router)
app.include_router(audit.router)
