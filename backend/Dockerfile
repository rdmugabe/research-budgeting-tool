# Build context expected to be the repository root so the samples/ folder is
# available for the optional seed step.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install the Python package first so the pip layer caches across code changes.
COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# Copy the rest of the backend (app + alembic) plus the samples used by the
# one-shot seed importer.
COPY backend/ ./
COPY samples/ /samples/

# Tell the seed importer where to find the sample workbooks at runtime.
ENV SAMPLES_DIR=/samples

# Render assigns $PORT (default 10000); fall back to 8000 for local docker runs.
ENV PORT=8000
EXPOSE 8000

# Apply migrations at startup, then run the server.
# Seed import is a manual one-shot — after the first deploy, run via the
# Render shell:  python -m app.seed.import_pra
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
