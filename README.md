# <img src="https://api.iconify.design/ph/drop-fill.svg?color=%2393B7BE" alt="Drip icon" width="34" align="top"> Drip

Stack sats on a slow drip. A self-hosted bitcoin savings bot with a web dashboard,
built to run on a Raspberry Pi.

It buys BTC-EUR every week through the Coinbase Advanced Trade API and sizes each buy
to the market: fear and oversold conditions buy more, greed buys less. It **always
buys** - the score only sets the amount. Dry run is the default; live trading is an
explicit, confirmed opt-in.

![Drip dashboard](docs/screenshot-dashboard.png)

*Example history, not a real account.*

The dashboard also researches its own strategy - what each indicator contributed,
whether the score predicts anything, and what a different scoring would have done -
and reports your cost basis against the market and how old each lot is.

## Install

Requires 64-bit Raspberry Pi OS with [Docker and the compose plugin](https://docs.docker.com/engine/install/debian/).

```bash
git clone https://github.com/leuteritz/Drip.git
cd Drip
cp backend/.env.example backend/.env   # can stay empty for dry-run mode
docker compose up -d --build
```

The dashboard is then at `http://<pi-address>:8080`. To update:
`git pull && docker compose up -d --build`. SQLite lives in the `drip-data` volume and
survives updates.

The API has **no authentication** - keep it inside your home network and do not
forward the port to the internet.

## Strategy

Three indicators are scored once a week, and the total picks the multiplier applied to
your base amount.

- **Fear & Greed** - below 25: `+3` · below 45: `+2` · 55 or above: `-2`
- **RSI (14, Wilder)** - below 30: `+3` · below 45: `+1` · above 70: `-2`
- **Price vs. 350-day MA** - below the average: `+2`

| Score | 5 or more | 3 to 4 | 1 to 2 | -1 to 0 | below -1 |
|---|---|---|---|---|---|
| **Buy** | 1.5x | 1.25x | 1.0x | 0.75x | 0.5x |

## Environment

Secrets live in `backend/.env`, which is never committed. Without Coinbase keys
everything still works in dry-run mode - market data comes from public endpoints.

| Variable | Required | Description |
|---|---|---|
| `COINBASE_API_KEY` | for live trading | Key name from your CDP key file, e.g. `organizations/xxx/apiKeys/yyy`. Create one at https://portal.cdp.coinbase.com/access/api with the Trade permission. |
| `COINBASE_API_SECRET` | for live trading | The EC private key from the same file, on one line with line breaks written as `\n`. |
| `DISCORD_WEBHOOK_URL` | optional | Webhook for buy notifications and the weekly digest. |
| `DRIP_PORT` | optional | Host port for the dashboard, default 8080. Lives in the **root** `.env`. |

## License

[MIT](LICENSE). This is not financial advice - with live mode enabled the bot trades
real money. Use at your own risk and test in dry-run mode first.
