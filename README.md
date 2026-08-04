# <img src="https://api.iconify.design/ph/drop-fill.svg?color=%2393B7BE" alt="Drip icon" width="34" align="top"> Drip

Stack sats on a slow drip. A self-hosted bitcoin savings bot with a web dashboard,
built to run on a Raspberry Pi.

It buys BTC-EUR every week through the Coinbase Advanced Trade API and sizes each buy
to the market: fear and oversold conditions buy more, greed buys less. It **always
buys** - the score only sets the amount. Dry run is the default; live trading is an
explicit, confirmed opt-in.

![Drip dashboard](docs/screenshot-dashboard.png)

*Example history, not a real account. Shown in the night theme; there is a day one too.*

Your stack is a tank of water, and it fizzes at the strength of the week's signal.
Underneath, the dashboard researches its own strategy, reports what you paid against
the market, and carries the rate you stack at forward to the next round number of sats.
Setting the drip happens on the next-buy card: click the amount, or the day and time.
One drop runs through it - beside the amount, on Buy, hollow on Test, which spends
nothing.
Everything else lives in three groups in the bar at the top - mode, tools, sections -
and `Ctrl+K` reaches all of it, keys included, so the Pi needs no shell after the first
install. Once a week the whole thing arrives on Discord.

## Install

Requires 64-bit Raspberry Pi OS with [Docker and the compose plugin](https://docs.docker.com/engine/install/debian/).

```bash
git clone https://github.com/leuteritz/Drip.git
cd Drip
cp backend/.env.example backend/.env   # can stay empty for dry-run mode
docker compose up -d --build
```

The dashboard is then at `http://<pi-address>:8080`. Paste your Coinbase key and
Discord webhook into **Setup** there. To update: `git pull && docker compose up -d
--build`; SQLite lives in the `drip-data` volume and survives it.

## On a wall

`http://<pi-address>:8080/#tank` is the whole thing on one screen, sized to read from
across the room. Point a spare monitor at it and leave it - it refreshes itself and
cannot spend money. `Ctrl+K` gets there, Esc comes back.

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

The dashboard shows this sum for the next buy: tap the drops under the amount.

## Weekly report

A single buy says nothing about whether the saving is going anywhere, so once a week
Drip reports itself to Discord: what you stacked, what the price did, how your stack
stands against plain DCA and against the market's own average, and what the signal
says now.

Twelve sections, each switchable. The preview is built by the code that builds the real
message, so it is exactly what arrives.

![The weekly report editor](docs/screenshot-weekly-report.png)

Needs a Discord webhook. Everything else works without one.

## Environment

Secrets go in under **Setup** in the dashboard, which stores them in Drip's own
database, or in `backend/.env`. A value set in the dashboard wins. Without Coinbase
keys everything still works in dry-run mode - market data comes from public endpoints.

| Variable | Required | Description |
|---|---|---|
| `COINBASE_API_KEY` | for live trading | Key name from your CDP key file, e.g. `organizations/xxx/apiKeys/yyy`. Create one at https://portal.cdp.coinbase.com/access/api with the Trade permission. |
| `COINBASE_API_SECRET` | for live trading | The EC private key from the same file, on one line with line breaks written as `\n`. |
| `DISCORD_WEBHOOK_URL` | optional | Webhook for buy notifications and the weekly report. |
| `TZ` | optional | Timezone the scheduler runs in, set in `docker-compose.yml`. |
| `DRIP_PORT` | optional | Host port for the dashboard, default 8080. Lives in the **root** `.env`. |

## License

[MIT](LICENSE). This is not financial advice - with live mode enabled the bot trades
real money. Use at your own risk and test in dry-run mode first.
