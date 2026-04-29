from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'app.db'}"
    # Override via SAMPLES_DIR env var (used by the Docker image, where
    # samples live at /samples instead of the repo root).
    samples_dir: Path = PROJECT_ROOT / "samples"
    uploads_dir: Path = PROJECT_ROOT / "uploads"
    exports_dir: Path = PROJECT_ROOT / "exports"

    default_overhead_pct: float = 0.40
    jwt_secret: str = "dev-secret-change-me-before-cloud"

    # Comma-separated list of allowed origins for CORS. Use "*" to allow any
    # origin (only acceptable in trusted local-only setups).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.cors_origins or "").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
settings.exports_dir.mkdir(parents=True, exist_ok=True)
