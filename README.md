# <img src="https://api.iconify.design/ph/drop-fill.svg?color=%2393B7BE" alt="Drip icon" width="34" align="top"> Drip

Stack sats on a slow drip. A self-hosted bitcoin savings bot with a web dashboard,
built to run on a Raspberry Pi.

## Features

- Buys bitcoin automatically every week through the Coinbase Advanced Trade API
- Sizes every buy to the market: fear and oversold conditions increase the amount,
  greed decreases it (0.5x to 1.5x of your base amount)
- Web dashboard with the price chart, your buys on the curve, live indicator gauges
  and a profit/loss summary
- Strategy comparison chart: Drip's weighted buying vs. plain DCA over time
- Everything configurable in the browser: amount, buy day and time, pause for any
  number of days or weeks, dry-run or live mode, Discord notifications
- Dry run is the default; live trading must be enabled explicitly and asks for
  confirmation
- Full buy history with score, RSI, Fear & Greed and order id per buy

## Installation: Docker on a Raspberry Pi

Requires a 64-bit Raspberry Pi OS with [Docker and the compose plugin](https://docs.docker.com/engine/install/debian/) installed.

```bash
git clone https://github.com/leuteritz/Drip.git
cd Drip

# Create your environment file (see below; can stay empty for dry-run mode)
cp backend/.env.example backend/.env
nano backend/.env

# Build and start both containers
docker compose up -d --build
```

The dashboard is now available at `http://<pi-address>:8080`.

Two containers run behind the scenes: `drip-frontend` (nginx, serves the UI and
proxies API calls) and `drip-backend` (FastAPI, scheduler and trading logic). The
SQLite database lives in the `drip-data` volume and survives updates.

To update after pulling new code:

```bash
git pull
docker compose up -d --build
```

The API has no authentication - keep it inside your home network and do not forward
the port to the internet.

## Strategy

Drip always buys; the score only sizes the amount. It is smart DCA, not market
timing. Once a week, three indicators are combined into a score:

| Indicator | Condition | Points |
|---|---|---|
| Fear & Greed | below 25 (extreme fear) | +3 |
| | below 45 (fear) | +2 |
| | 55 or above (greed) | -2 |
| RSI (14, Wilder) | below 30 (strongly oversold) | +3 |
| | below 45 (slightly oversold) | +1 |
| | above 70 (overbought) | -2 |
| Price vs. 350-day MA | price below the average | +2 |

The score picks the multiplier applied to your base amount:

| Score | Multiplier | Signal |
|---|---|---|
| 5 or more | 1.5x | Strong buy signal |
| 3 to 4 | 1.25x | Good buy signal |
| 1 to 2 | 1.0x | Normal buy signal |
| -1 to 0 | 0.75x | Weak buy signal |
| below -1 | 0.5x | Minimum buy |

## Environment variables

All secrets live in `backend/.env` (never committed). Without Coinbase keys the app
still works fully in dry-run mode - market data comes from public endpoints.

| Variable | Required | Description |
|---|---|---|
| `COINBASE_API_KEY` | for live trading | Key name from your CDP key file, e.g. `organizations/xxx/apiKeys/yyy`. Create one at https://portal.cdp.coinbase.com/access/api with the Trade permission. |
| `COINBASE_API_SECRET` | for live trading | The EC private key from the same file, on one line with line breaks written as `\n`. |
| `DISCORD_WEBHOOK_URL` | optional | Webhook for buy notifications. Leave empty to disable. |

Example:

```env
COINBASE_API_KEY=organizations/xxxx/apiKeys/yyyy
COINBASE_API_SECRET=-----BEGIN EC PRIVATE KEY-----\nMHcC...\n-----END EC PRIVATE KEY-----\n
DISCORD_WEBHOOK_URL=
```

## License

[MIT](LICENSE). This is not financial advice - with live mode enabled the bot trades
real money. Use at your own risk and test in dry-run mode first.
