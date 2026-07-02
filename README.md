# ₿ Bitcoin Smart-DCA Bot

Ein selbst gehosteter Bitcoin-Sparplan-Bot mit Web-Oberfläche — gebaut für den Raspberry Pi.

Der Bot kauft **wöchentlich** Bitcoin über die Coinbase Advanced Trade API. Die Kaufmenge passt
sich automatisch der Marktlage an: Aus **Fear & Greed Index**, **RSI (14, Wilder)** und dem
**350-Tage-Moving-Average** wird ein Score berechnet, der den Basisbetrag mit **0,5× bis 1,5×**
multipliziert — bei Angst und überverkauftem Markt wird mehr gekauft, bei Gier weniger.

## Features

- 📊 **Dashboard** — BTC-Kursverlauf mit Kauf-Markern, Live-Indikatoren (RSI- & Fear&Greed-Gauge),
  Gewinn/Verlust auf einen Blick
- ⚖️ **Strategie-Vergleich** — Bot-Strategie vs. einfaches DCA als Verlaufs-Chart:
  lohnt sich der Score-Multiplikator wirklich?
- ⚙️ **Konfiguration im Browser** — Basisbetrag, Kauftag + Uhrzeit, Dry-Run/Live-Modus,
  Discord-Benachrichtigungen
- ⏸️ **Pausieren** — Käufe für X Tage/Wochen aussetzen, danach geht es automatisch weiter
- 📜 **Historie** — alle Käufe mit Score, RSI, Fear&Greed und Order-ID
- 🧪 **Dry-Run als Default** — echtes Geld fließt erst nach explizitem Umschalten (mit Bestätigungs-Dialog)
- 🔐 **Secrets nur in `.env`** — nichts Vertrauliches im Repository

## Tech-Stack

| Schicht  | Technologie |
|----------|-------------|
| Backend  | Python 3.11+, FastAPI, APScheduler, SQLite (SQLModel) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, Recharts |
| Trading  | [coinbase-advanced-py](https://github.com/coinbase/coinbase-advanced-py) |

Das Frontend wird nach `backend/static/` gebaut und vom Backend mit ausgeliefert —
auf dem Pi läuft **ein einziger Prozess** auf Port 8000, Node.js wird dort nicht benötigt.

## Setup (Entwicklung)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # und ausfüllen (siehe unten)
uvicorn app.main:app --reload
```

API-Doku: http://localhost:8000/docs

### 2. Frontend (Dev-Server mit Hot-Reload)

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, /api wird zum Backend geproxied
```

### 3. `.env` konfigurieren

API-Key unter https://portal.cdp.coinbase.com/access/api erstellen (Berechtigung: **Trade**).
Aus der heruntergeladenen `cdp_api_key.json` überträgst du:

```env
COINBASE_API_KEY=organizations/xxxx/apiKeys/yyyy
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----\nMHcC...\n-----END EC PRIVATE KEY-----\n
DISCORD_WEBHOOK_URL=            # optional
```

> Ohne Keys funktioniert alles außer echten Käufen — Marktdaten kommen über die
> öffentlichen Coinbase-Endpunkte, ideal zum Ausprobieren im Dry-Run.

### Alte CSV-Historie importieren (optional)

```bash
cd backend
python scripts/import_csv.py [--include-errors] [pfad/zur/bitcoin_purchases.csv]
```

## Deployment auf dem Raspberry Pi

```bash
# 1. Am PC (oder Pi mit Node) das Frontend bauen:
cd frontend && npm install && npm run build   # -> backend/static/

# 2. Repo/Dateien auf den Pi kopieren, dann:
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env

# 3. Testlauf:
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Danach ist die Oberfläche im Heimnetz erreichbar: `http://<pi-adresse>:8000`

### Als systemd-Service (Autostart)

`/etc/systemd/system/bitcoin-bot.service`:

```ini
[Unit]
Description=Bitcoin Smart-DCA Bot
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/bitcoin-bot/backend
ExecStart=/home/pi/bitcoin-bot/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now bitcoin-bot
```

> ⚠️ Die API hat **keine Authentifizierung** — sie ist für das private Heimnetz gedacht.
> Den Port nicht ins Internet freigeben (kein Port-Forwarding).

## Wie die Strategie funktioniert

| Indikator | Bedingung | Punkte |
|---|---|---|
| Fear & Greed | < 25 (Extreme Fear) | +3 |
| | < 45 (Fear) | +2 |
| | ≥ 55 (Greed) | −2 |
| RSI (14) | < 30 (stark überverkauft) | +3 |
| | < 45 (leicht überverkauft) | +1 |
| | > 70 (überkauft) | −2 |
| Kurs vs. 350d-MA | Kurs darunter | +2 |

| Score | Multiplikator | Signal |
|---|---|---|
| ≥ 5 | 1,5× | 🚀 Starkes Kaufsignal |
| ≥ 3 | 1,25× | ✅ Gutes Kaufsignal |
| ≥ 1 | 1,0× | 💰 Normales Kaufsignal |
| ≥ −1 | 0,75× | ⚠️ Schwaches Kaufsignal |
| < −1 | 0,5× | 🔻 Minimalkauf |

Der Bot kauft **immer** — der Score steuert nur die Menge (Smart-DCA statt Market-Timing).

## Disclaimer

Keine Anlageberatung. Nutzung auf eigenes Risiko — der Bot handelt mit echtem Geld,
wenn der Live-Modus aktiviert ist. Erst ausgiebig im Dry-Run testen.
