# Build context expected to be the repository root so the samples/ folder is
# available for the optional seed step.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Copy the backend source first because pyproject.toml declares
# packages = ["app"], so pip needs the app/ directory present at install time.
COPY backend/ ./
COPY samples/ /samples/

RUN pip install --upgrade pip && pip install .

# Tell the seed importer where to find the sample workbooks at runtime.
ENV SAMPLES_DIR=/samples

# Render assigns $PORT (default 10000); fall back to 8000 for local docker runs.
ENV PORT=8000
EXPOSE 8000

# Apply migrations at startup, then run the server.
# Seed import is a manual one-shot — after the first deploy, run locally
# pointed at the cloud DB:  python -m app.seed.import_pra
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
