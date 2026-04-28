from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routes import price_master, trial

# MVP: create tables on startup. Switch to Alembic before any non-local deploy.
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Research Budgeting Tool", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(price_master.router)
app.include_router(trial.router)
