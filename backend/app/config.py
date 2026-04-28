from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = f"sqlite:///{BACKEND_DIR / 'app.db'}"
    samples_dir: Path = PROJECT_ROOT / "samples"
    uploads_dir: Path = PROJECT_ROOT / "uploads"
    exports_dir: Path = PROJECT_ROOT / "exports"

    default_overhead_pct: float = 0.40


settings = Settings()
settings.uploads_dir.mkdir(parents=True, exist_ok=True)
settings.exports_dir.mkdir(parents=True, exist_ok=True)
