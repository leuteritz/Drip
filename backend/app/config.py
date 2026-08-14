"""Application configuration - loads secrets from backend/.env."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"


class AppConfig(BaseSettings):
    coinbase_api_key: str = ""
    coinbase_api_secret: str = ""
    discord_webhook_url: str = ""
    # The optional lock's bootstrap, and the way back in after locking yourself
    # out: set it here, restart the backend, and the dashboard is reachable
    # again. Empty means no lock, which is what Drip has always been. Hashed at
    # resolve time, never stored - see `auth.py`.
    drip_password: str = ""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def api_secret_normalized(self) -> str:
        # The PEM key is stored single-line in .env with literal \n sequences
        return self.coinbase_api_secret.replace("\\n", "\n")

    @property
    def has_coinbase_credentials(self) -> bool:
        return bool(self.coinbase_api_key and self.coinbase_api_secret)


config = AppConfig()
