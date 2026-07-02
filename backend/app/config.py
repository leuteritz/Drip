"""Anwendungskonfiguration - laedt Secrets aus backend/.env"""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
STATIC_DIR = BACKEND_DIR / "static"


class AppConfig(BaseSettings):
    coinbase_api_key: str = ""
    coinbase_api_secret: str = ""
    discord_webhook_url: str = ""
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def api_secret_normalized(self) -> str:
        # Im .env steht der PEM-Key einzeilig mit literalen \n-Sequenzen
        return self.coinbase_api_secret.replace("\\n", "\n")

    @property
    def has_coinbase_credentials(self) -> bool:
        return bool(self.coinbase_api_key and self.coinbase_api_secret)


config = AppConfig()
