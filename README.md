# <img src="https://api.iconify.design/ph/drop-fill.svg?color=%2393B7BE" alt="Drip icon" width="34" align="top"> Drip

Stack sats on a slow drip.

Drip is a self-hosted bitcoin savings bot with a web dashboard, built to run on a
Raspberry Pi. It buys bitcoin on a weekly schedule through the Coinbase Advanced Trade
API, and it sizes each buy to the market: a score computed from the Fear & Greed index,
the RSI (14, Wilder) and the 350-day moving average multiplies your base amount by
0.5x to 1.5x. More when the market is fearful and oversold, less when it is greedy.

## Features

- Dashboard with the bitcoin price chart, your buys marked on the curve, live
  indicator gauges and a profit/loss summary at a glance
- Strategy comparison: Drip's weighted buying vs. plain DCA over time, so you can see
  whether the multiplier actually earns its keep
- Configure everything in the browser: base amount, buy day and time, dry-run or live
  mode, Discord notifications
- Pause the faucet for any number of days or weeks; the schedule resumes on its own
- Full buy history with score, RSI, Fear & Greed and order id per buy
- Dry run is the default; live trading has to be switched on explicitly and asks for
  confirmation
- Secrets live only in `.env`, never in the repository

## Tech stack

| Layer    | Technology |
|----------|------------|
| Backend  | Python 3.11+, FastAPI, APScheduler, SQLite (SQLModel) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, Recharts |
| Trading  | [coinbase-advanced-py](https://github.com/coinbase/coinbase-advanced-py) |

The frontend is built into `backend/static/` and served by the backend, so the Pi runs
a single process on port 8000 and does not need Node.js.

## Development setup

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then fill it in, see below
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 2. Frontend (dev server with hot reload)

```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, /api is proxied to the backend
```

### 3. Configure `.env`

Create an API key at https://portal.cdp.coinbase.com/access/api with the Trade
permission. From the downloaded `cdp_api_key.json`, copy:

```env
COINBASE_API_KEY=organizations/xxxx/apiKeys/yyyy
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----\nMHcC...\n-----END EC PRIVATE KEY-----\n
DISCORD_WEBHOOK_URL=            # optional
```

Without keys, everything except real orders still works: market data comes from
Coinbase's public endpoints, which is ideal for trying Drip out in dry-run mode.

### Import an old purchase CSV (optional)

```bash
cd backend
python scripts/import_csv.py [--include-errors] [path/to/purchases.csv]
```

## Deploying on a Raspberry Pi

```bash
# 1. Build the frontend on your PC (or any machine with Node):
cd frontend && npm install && npm run build   # output lands in backend/static/

# 2. Copy the repo to the Pi, then:
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env && nano .env

# 3. Test run:
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The dashboard is then reachable on your home network at `http://<pi-address>:8000`.

### Run as a systemd service (autostart)

`/etc/systemd/system/drip.service`:

```ini
[Unit]
Description=Drip bitcoin savings bot
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/drip/backend
ExecStart=/home/pi/drip/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now drip
```

Note: the API has no authentication. It is meant for your private home network only,
so do not forward the port to the internet.

## How the strategy works

| Indicator | Condition | Points |
|---|---|---|
| Fear & Greed | below 25 (extreme fear) | +3 |
| | below 45 (fear) | +2 |
| | 55 or above (greed) | -2 |
| RSI (14) | below 30 (strongly oversold) | +3 |
| | below 45 (slightly oversold) | +1 |
| | above 70 (overbought) | -2 |
| Price vs. 350d MA | price below the average | +2 |

| Score | Multiplier | Signal |
|---|---|---|
| 5 or more | 1.5x | Strong buy signal |
| 3 to 4 | 1.25x | Good buy signal |
| 1 to 2 | 1.0x | Normal buy signal |
| -1 to 0 | 0.75x | Weak buy signal |
| below -1 | 0.5x | Minimum buy |

Drip always buys; the score only sizes the amount. It is smart DCA, not market timing.

## Disclaimer

This is not financial advice. Use at your own risk: with live mode enabled the bot
trades real money. Test thoroughly in dry-run mode first.
