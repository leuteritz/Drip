"""Read-only research: is the score actually worth its multiplier?

Four analyses, all cut from one shared per-day scoring table:

* `attribution` - splits the edge over plain DCA between the three indicators,
  as Shapley values, so the three parts add up to the whole exactly.
* `forward_returns` - what the market did in the 30/90/180 days *after* each
  score. The honest test: a high score should precede a cheaper entry than a
  low one, by more than the market drifts anyway.
* `rolling_windows` - the same backtest started on many different dates, so the
  verdict is a distribution instead of one lucky path.
* `grid` - buy weekday against multiplier spread, for the heatmap.

Like `simulation.py` this module never writes to the database. Scoring goes
through `strategy.score_indicators` and the value arithmetic through
`portfolio.side_summary`, so the research can never disagree with the live bot
about how a score or a profit is computed.
"""
import bisect
import statistics
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from itertools import combinations
from math import factorial

from sqlmodel import Session

from . import indicators, signals, strategy
from .market_data import ensure_candles
from .models import BotSettings
from .portfolio import side_summary

# The full range every analysis is cut from. One table is built for it and
# cached, so the four endpoints share the work instead of each rebuilding it.
RESEARCH_DAYS = 1095  # three years of scored days
TABLE_TTL = 60 * 60  # 1 h - only the newest day can still change

# Inputs that score exactly zero points in their block of `score_indicators`.
NEUTRAL_FNG = 50
NEUTRAL_RSI = 50.0

INDICATORS = ("fng", "rsi", "ma")
ALL_INDICATORS = frozenset(INDICATORS)
INDICATOR_LABELS = {
    "fng": "Fear & Greed",
    "rsi": "RSI",
    "ma": f"{strategy.MA_DAYS}d MA",
}

HORIZONS = (30, 90, 180)  # days ahead the forward-return test looks
# Exponent applied to the multiplier: `m ** k`. 0 flattens every multiplier to
# 1.0 (plain DCA), 1 is what the bot does today, 2 doubles the spread in log
# space. Geometric rather than linear scaling so no variant can ever reach a
# zero buy - Drip always buys.
SPREADS = (0.0, 0.5, 1.0, 1.5, 2.0)
CURRENT_SPREAD = 1.0
WINDOW_STEP = 7  # a rolling window starts every week
MIN_WINDOW_BUYS = 4  # below this a window says nothing

# Any rule that turns one scored day into a multiplier: the live ladder, a
# restricted coalition, a re-spread ladder, or a whole alternative scoring.
MultiplierFn = Callable[["ScoredDay"], float]


@dataclass
class ScoredDay:
    """One candle day, with each indicator's points kept apart.

    `readings` carries the raw values behind those points plus the candidate
    signals that are not in the score at all — the screening and the scoring
    variants both work off these rather than recomputing anything.
    """

    day: date
    close: float
    points: dict[str, int]
    readings: dict[str, float]

    @property
    def score(self) -> int:
        return sum(self.points.values())


@dataclass
class ScoreTable:
    days: list[date]  # every loaded candle day, including the lookback
    closes: list[float]  # parallel to `days`
    rows: list[ScoredDay]  # only the days inside RESEARCH_DAYS


_CACHE: tuple[float, ScoreTable] | None = None


def _indicator_points(fng: int, rsi: float, price: float, ma: float) -> dict[str, int]:
    """Each indicator's own contribution to the score.

    `score_indicators` adds three independent blocks and every neutral input
    above scores 0 in its block, so scoring one indicator at a time against
    neutral values isolates its points without restating a single threshold
    here. That additivity is also what lets the coalitions below be built by
    plain summation.
    """

    def only(**overrides) -> int:
        return strategy.score_indicators(
            fear_greed=overrides.get("fear_greed", NEUTRAL_FNG),
            fng_classification="",
            rsi=overrides.get("rsi", NEUTRAL_RSI),
            current_price=price,
            ma_350=overrides.get("ma_350", price),
        ).score

    return {
        "fng": only(fear_greed=fng),
        "rsi": only(rsi=rsi),
        "ma": only(ma_350=ma),
    }


def _build_table(session: Session) -> ScoreTable:
    candles = sorted(
        ensure_candles(session, days=RESEARCH_DAYS + strategy.MA_DAYS + 10),
        key=lambda c: c.day,
    )
    days = [c.day for c in candles]
    closes = [c.close for c in candles]

    # Prefix sums keep the 350-day average O(1) per day instead of O(350) -
    # the difference between a snappy and a sluggish page on a Pi.
    prefix = [0.0]
    for close in closes:
        prefix.append(prefix[-1] + close)

    # Running maximum, never the maximum of the whole series: scoring a past day
    # against a peak that had not happened yet is lookahead, and it would make
    # the drawdown signal look clairvoyant.
    high_water: list[float] = []
    peak = 0.0
    for close in closes:
        peak = max(peak, close)
        high_water.append(peak)

    fng_hist = indicators.get_fear_and_greed_history()
    window_start = date.today() - timedelta(days=RESEARCH_DAYS)
    rsi_lookback = strategy.RSI_PERIOD + 7  # the same slice the live bot scores

    def mean(idx: int, length: int) -> float:
        low = max(0, idx - length + 1)
        return (prefix[idx + 1] - prefix[low]) / (idx + 1 - low)

    rows: list[ScoredDay] = []
    for idx, day in enumerate(days):
        if idx < strategy.RSI_PERIOD or day < window_start:
            continue
        price = closes[idx]
        if not price:
            continue
        fng = fng_hist.get(day, NEUTRAL_FNG)
        rsi = indicators.calculate_rsi_wilder(
            closes[max(0, idx - rsi_lookback + 1): idx + 1],
            period=strategy.RSI_PERIOD,
        )
        ma_350 = mean(idx, strategy.MA_DAYS)
        rows.append(ScoredDay(
            day=day,
            close=price,
            points=_indicator_points(fng=fng, rsi=rsi, price=price, ma=ma_350),
            readings={
                "fng": float(fng),
                "rsi": rsi,
                "ma_dist": (price - ma_350) / ma_350 * 100 if ma_350 else 0.0,
                "mayer": signals.mayer_multiple(price, mean(idx, signals.MAYER_MA_DAYS)),
                "drawdown": signals.drawdown_pct(price, high_water[idx]),
                "cycle": signals.cycle_phase(day),
            },
        ))

    return ScoreTable(days=days, closes=closes, rows=rows)


def score_table(session: Session) -> ScoreTable:
    """The cached scoring table. Rebuilt at most hourly."""
    global _CACHE
    if _CACHE and (time.time() - _CACHE[0]) < TABLE_TTL:
        return _CACHE[1]
    table = _build_table(session)
    _CACHE = (time.time(), table)
    return table


# --- shared helpers ---------------------------------------------------------

def _coalition(active: frozenset[str], spread: float = CURRENT_SPREAD) -> MultiplierFn:
    """The live rule, restricted to `active` and optionally re-spread.

    Only the indicators in `active` count towards the score, which is how the
    attribution builds its coalitions; `spread` rescales the ladder for the grid.
    """
    def multiplier_of(row: ScoredDay) -> float:
        score = sum(row.points[key] for key in active)
        return strategy.determine_purchase_strategy(score)["multiplier"] ** spread

    return multiplier_of


def _simulate(rows: list[ScoredDay], multiplier_of: MultiplierFn, base: float,
              price: float) -> dict:
    """Buys `base * multiplier_of(day)` on every row, against a plain-DCA twin.

    The DCA side is identical whatever the rule, so any difference in the edge
    comes from the multiplier alone — which is what makes coalitions, spreads
    and whole alternative scorings comparable through this one function.
    """
    bot_eur = bot_btc = dca_eur = dca_btc = 0.0
    for row in rows:
        amount = round(base * multiplier_of(row), 2)
        bot_eur += amount
        bot_btc += amount / row.close
        dca_eur += base
        dca_btc += base / row.close

    bot = side_summary(bot_eur, bot_btc, price)
    dca = side_summary(dca_eur, dca_btc, price)
    return {
        "bot": bot,
        "dca": dca,
        "edge_eur": bot["profit_eur"] - dca["profit_eur"],
        "edge_pp": bot["profit_pct"] - dca["profit_pct"],
    }


def _shapley(values: dict[frozenset[str], dict], metric: str) -> dict[str, float]:
    """Splits `values[all] - values[none]` between the three indicators.

    Leave-one-out would be simpler but its parts do not add up to the whole
    whenever two indicators overlap - and they do, since fear and a low RSI
    tend to arrive together. Shapley averages an indicator's marginal effect
    over every order it could have been added in, which does add up exactly.
    """
    total_players = len(INDICATORS)
    result: dict[str, float] = {}
    for key in INDICATORS:
        others = [other for other in INDICATORS if other != key]
        share = 0.0
        for size in range(len(others) + 1):
            weight = (factorial(size) * factorial(total_players - size - 1)
                      / factorial(total_players))
            for combo in combinations(others, size):
                subset = frozenset(combo)
                share += weight * (values[subset | {key}][metric] - values[subset][metric])
        result[key] = share
    return result


def _stats(values: list[float]) -> dict:
    if not values:
        return {"n": 0, "mean_pct": 0.0, "median_pct": 0.0, "win_rate": 0.0}
    return {
        "n": len(values),
        "mean_pct": sum(values) / len(values),
        "median_pct": statistics.median(values),
        "win_rate": sum(1 for v in values if v > 0) / len(values) * 100,
    }


def _percentile(ordered: list[float], q: float) -> float:
    """Linear-interpolated percentile; `ordered` must be sorted ascending."""
    if not ordered:
        return 0.0
    pos = (len(ordered) - 1) * q
    low = int(pos)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (pos - low)


def _window_rows(table: ScoreTable, days: int) -> list[ScoredDay]:
    start = date.today() - timedelta(days=days)
    return [row for row in table.rows if row.day >= start]


def _last_price(table: ScoreTable) -> float:
    return table.closes[-1] if table.closes else 0.0


# --- the four analyses ------------------------------------------------------

def attribution(session: Session, days: int, settings: BotSettings) -> dict:
    """Which indicator earned the edge over plain DCA, and how much of it."""
    table = score_table(session)
    weekday = settings.schedule_weekday
    rows = [row for row in _window_rows(table, days) if row.day.weekday() == weekday]
    price = _last_price(table)
    base = settings.base_amount_eur

    values = {
        frozenset(combo): _simulate(rows, _coalition(frozenset(combo)), base, price)
        for size in range(len(INDICATORS) + 1)
        for combo in combinations(INDICATORS, size)
    }
    full = values[frozenset(INDICATORS)]
    baseline = values[frozenset()]
    by_eur = _shapley(values, "edge_eur")
    by_pp = _shapley(values, "edge_pp")

    return {
        "days": days,
        "start_date": (rows[0].day if rows else date.today()).isoformat(),
        "end_date": (rows[-1].day if rows else date.today()).isoformat(),
        "purchase_count": len(rows),
        "base_amount_eur": base,
        "weekday": weekday,
        "current_price": price,
        # Every indicator neutral still means score 0, and score 0 is a 0.75x
        # buy - so the scoring machinery starts out *below* plain DCA. That
        # offset is the waterfall's floor, not part of any indicator's work.
        "baseline_eur": baseline["edge_eur"],
        "baseline_pp": baseline["edge_pp"],
        "total_eur": full["edge_eur"],
        "total_pp": full["edge_pp"],
        "contributions": [
            {"key": key, "label": INDICATOR_LABELS[key],
             "eur": by_eur[key], "pp": by_pp[key]}
            for key in INDICATORS
        ],
        "bot": full["bot"],
        "dca": full["dca"],
    }


def forward_returns(session: Session, days: int) -> dict:
    """Price change after each score, bucketed by the multiplier it triggered.

    Scored on every candle day, not just buy days: the question is whether the
    score reads the market, which has nothing to do with the buy schedule.
    """
    table = score_table(session)
    rows = _window_rows(table, days)

    buckets: dict[float, dict] = {}
    overall: dict[int, list[float]] = {horizon: [] for horizon in HORIZONS}

    for row in rows:
        plan = strategy.determine_purchase_strategy(row.score)
        bucket = buckets.setdefault(plan["multiplier"], {
            "multiplier": plan["multiplier"],
            "signal": plan["signal"],
            "score_min": row.score,
            "score_max": row.score,
            "returns": {horizon: [] for horizon in HORIZONS},
        })
        bucket["score_min"] = min(bucket["score_min"], row.score)
        bucket["score_max"] = max(bucket["score_max"], row.score)

        for horizon in HORIZONS:
            target = row.day + timedelta(days=horizon)
            idx = bisect.bisect_left(table.days, target)
            # A gap in the candle series must not silently shift the horizon.
            if idx >= len(table.days) or (table.days[idx] - target).days > 3:
                continue
            later = table.closes[idx]
            if not later:
                continue
            change = (later - row.close) / row.close * 100
            bucket["returns"][horizon].append(change)
            overall[horizon].append(change)

    ordered = sorted(buckets.values(), key=lambda b: b["multiplier"], reverse=True)
    return {
        "days": days,
        "horizons": list(HORIZONS),
        "sample_size": len(rows),
        "baseline": {str(h): _stats(overall[h]) for h in HORIZONS},
        "buckets": [
            {
                "multiplier": bucket["multiplier"],
                "signal": bucket["signal"],
                "score_min": bucket["score_min"],
                "score_max": bucket["score_max"],
                "by_horizon": {
                    str(h): _stats(bucket["returns"][h]) for h in HORIZONS
                },
            }
            for bucket in ordered
        ],
    }


def rolling_windows(session: Session, window_days: int, settings: BotSettings) -> dict:
    """The same backtest from every possible start date, a week apart.

    One backtest is one path and says almost nothing; a hundred overlapping
    ones say how often the multiplier helped and how much it swung.
    """
    table = score_table(session)
    weekday = settings.schedule_weekday
    base = settings.base_amount_eur
    buys = [row for row in table.rows if row.day.weekday() == weekday]

    windows: list[dict] = []
    if buys and table.days:
        last = table.days[-1]
        start = table.rows[0].day
        while start + timedelta(days=window_days) <= last:
            end = start + timedelta(days=window_days)
            chunk = [row for row in buys if start <= row.day <= end]
            idx = bisect.bisect_right(table.days, end) - 1
            price = table.closes[idx] if idx >= 0 else 0.0
            if len(chunk) >= MIN_WINDOW_BUYS and price:
                run = _simulate(chunk, _coalition(ALL_INDICATORS), base, price)
                windows.append({
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "edge_pp": run["edge_pp"],
                    "edge_eur": run["edge_eur"],
                    "bot_pct": run["bot"]["profit_pct"],
                    "dca_pct": run["dca"]["profit_pct"],
                })
            start += timedelta(days=WINDOW_STEP)

    edges = sorted(w["edge_pp"] for w in windows)
    wins = sum(1 for edge in edges if edge > 0)
    return {
        "window_days": window_days,
        "weekday": weekday,
        "count": len(windows),
        "wins": wins,
        "win_rate": (wins / len(edges) * 100) if edges else 0.0,
        "median_pp": statistics.median(edges) if edges else 0.0,
        "p10_pp": _percentile(edges, 0.10),
        "p90_pp": _percentile(edges, 0.90),
        "best_pp": edges[-1] if edges else 0.0,
        "worst_pp": edges[0] if edges else 0.0,
        "windows": windows,
    }


# --- candidate signals and alternative scorings -----------------------------

# Screened with the same forward-return test the live indicators get. All of
# these read "lower is cheaper", which is what makes one shared quintile table
# meaningful across them; `cycle` is the deliberate exception and claims no
# direction at all.
SCREEN_SIGNALS = (
    ("fng", "Fear & Greed", True),
    ("rsi", "RSI", True),
    ("ma_dist", f"Price vs {strategy.MA_DAYS}d MA", True),
    ("mayer", "Mayer Multiple", False),
    ("drawdown", "Drawdown from high", False),
    ("cycle", "Cycle position", False),
)
QUINTILES = 5
SCREEN_HORIZON = 90


def _soft_score(readings: dict[str, float]) -> float:
    """The same three indicators without the cliffs.

    Every threshold in `score_indicators` is a step: RSI 44.9 scores +1 and RSI
    45.1 scores 0, on a reading that is noisy to well beyond that. These are the
    same anchor points joined by straight lines, so the total keeps the original
    -4..8 range and only the edges soften.
    """
    fng = readings["fng"]
    if fng <= strategy.FNG_FEAR:
        fng_points = 3 * min((strategy.FNG_FEAR - fng) / strategy.FNG_FEAR, 1.0)
    elif fng >= strategy.FNG_NEUTRAL:
        fng_points = -2 * min((fng - strategy.FNG_NEUTRAL) / 45, 1.0)
    else:
        fng_points = 0.0

    rsi = readings["rsi"]
    if rsi <= 50:
        rsi_points = 3 * min((50 - rsi) / 25, 1.0)
    else:
        rsi_points = -2 * min((rsi - 50) / 25, 1.0)

    # The live rule pays the full +2 for being a hair below the average; this
    # pays it for being 20% below and scales down to nothing at the average.
    below = max(-readings["ma_dist"], 0.0)
    ma_points = 2 * min(below / 20.0, 1.0)

    return fng_points + rsi_points + ma_points


def _soft_multiplier(row: ScoredDay) -> float:
    """Soft score mapped straight onto 0.5x-1.5x, without the five-rung ladder.

    Smoothing the points and then rounding them back onto the ladder would put
    the cliffs straight back, so this variant replaces both at once. That is
    also its honest weakness: it differs from the live rule in two ways, and the
    comparison cannot say which of the two did the work.
    """
    return 0.5 + max(min((_soft_score(row.readings) + 4) / 12, 1.0), 0.0)


def _drawdown_points(readings: dict[str, float]) -> int:
    below = -readings["drawdown"]
    if below >= 40:
        return 3
    if below >= 20:
        return 2
    if below >= 10:
        return 1
    return -1 if below < 5 else 0


def _mayer_points(readings: dict[str, float]) -> int:
    mayer = readings["mayer"]
    if mayer < 0.8:
        return 3
    if mayer < 1.0:
        return 1
    if mayer > 2.4:
        return -2
    return -1 if mayer > 1.5 else 0


def _plus(extra) -> MultiplierFn:
    """The live rule with one more points block bolted on."""
    def multiplier_of(row: ScoredDay) -> float:
        score = row.score + extra(row.readings)
        return strategy.determine_purchase_strategy(score)["multiplier"]

    return multiplier_of


VARIANTS: tuple[tuple[str, str, str], ...] = (
    ("current", "Current scoring", "The three indicators and the five-rung ladder."),
    ("soft", "Soft scoring", "Same indicators, no thresholds and no ladder."),
    ("plus_drawdown", "Plus drawdown", "Current scoring, plus points for being far below the high."),
    ("plus_mayer", "Plus Mayer", "Current scoring, plus points for a low Mayer Multiple."),
)


def _variant(key: str) -> MultiplierFn:
    if key == "soft":
        return _soft_multiplier
    if key == "plus_drawdown":
        return _plus(_drawdown_points)
    if key == "plus_mayer":
        return _plus(_mayer_points)
    return _coalition(ALL_INDICATORS)


def candidates(session: Session, days: int) -> dict:
    """Screens every signal, live and candidate, by the same forward-return test.

    Days are sorted by the signal and cut into fifths; each fifth reports what
    the price did over the next 90 days. A signal that reads the market has a
    cheap fifth that beats its expensive fifth by more than the all-days
    baseline moves — that gap is the `spread`, and it is what ranks them.
    """
    table = score_table(session)
    rows = _window_rows(table, days)

    forward: dict[date, float] = {}
    for row in rows:
        target = row.day + timedelta(days=SCREEN_HORIZON)
        idx = bisect.bisect_left(table.days, target)
        if idx >= len(table.days) or (table.days[idx] - target).days > 3:
            continue
        later = table.closes[idx]
        if later and row.close:
            forward[row.day] = (later - row.close) / row.close * 100

    usable = [row for row in rows if row.day in forward]
    baseline = statistics.median(forward.values()) if forward else 0.0

    out = []
    for key, label, in_score in SCREEN_SIGNALS:
        ordered = sorted(usable, key=lambda r: r.readings[key])
        size = len(ordered) // QUINTILES
        if size == 0:
            continue
        quintiles = []
        for q in range(QUINTILES):
            start = q * size
            end = len(ordered) if q == QUINTILES - 1 else start + size
            chunk = ordered[start:end]
            values = [forward[r.day] for r in chunk]
            quintiles.append({
                "quintile": q + 1,
                "from_value": chunk[0].readings[key],
                "to_value": chunk[-1].readings[key],
                "n": len(chunk),
                "median_pct": statistics.median(values) if values else 0.0,
            })

        current = rows[-1].readings[key] if rows else 0.0
        position = sum(1 for r in ordered if r.readings[key] <= current)
        out.append({
            "key": key,
            "label": label,
            "in_score": in_score,
            "current": current,
            "current_quintile": min(
                QUINTILES, max(1, (position * QUINTILES - 1) // len(ordered) + 1)
            ),
            "quintiles": quintiles,
            # Cheap fifth minus expensive fifth. Positive means low readings did
            # precede better returns, which is the whole claim being tested.
            "spread_pct": quintiles[0]["median_pct"] - quintiles[-1]["median_pct"],
        })

    out.sort(key=lambda s: s["spread_pct"], reverse=True)
    return {
        "days": days,
        "horizon": SCREEN_HORIZON,
        "quintiles": QUINTILES,
        "sample_size": len(usable),
        "baseline_median_pct": baseline,
        "signals": out,
    }


def scoring_variants(session: Session, window_days: int, settings: BotSettings) -> dict:
    """Alternative scorings, each put through the same rolling-window test.

    A single backtest would rank these by whichever happened to fit the window;
    a hundred overlapping ones at least show whether a variant wins broadly or
    only in one stretch. Nothing here touches `strategy.py` — these are
    proposals with evidence attached, not settings.
    """
    table = score_table(session)
    weekday = settings.schedule_weekday
    base = settings.base_amount_eur
    buys = [row for row in table.rows if row.day.weekday() == weekday]

    starts: list[tuple[date, date, float]] = []
    if buys and table.days:
        last = table.days[-1]
        start = table.rows[0].day
        while start + timedelta(days=window_days) <= last:
            end = start + timedelta(days=window_days)
            idx = bisect.bisect_right(table.days, end) - 1
            price = table.closes[idx] if idx >= 0 else 0.0
            if price:
                starts.append((start, end, price))
            start += timedelta(days=WINDOW_STEP)

    # Every figure in a row is per window, the stake included. Showing an edge
    # measured over one window beside a stake measured over three years would
    # invite exactly the misreading the stake column exists to prevent.
    dca_stakes: list[float] = []
    results = []
    for key, label, description in VARIANTS:
        rule = _variant(key)
        edges: list[float] = []
        stakes: list[float] = []
        for start, end, price in starts:
            chunk = [row for row in buys if start <= row.day <= end]
            if len(chunk) < MIN_WINDOW_BUYS:
                continue
            run = _simulate(chunk, rule, base, price)
            edges.append(run["edge_pp"])
            stakes.append(run["bot"]["invested_eur"])
            if key == VARIANTS[0][0]:
                dca_stakes.append(run["dca"]["invested_eur"])

        ordered = sorted(edges)
        results.append({
            "key": key,
            "label": label,
            "description": description,
            "windows": len(ordered),
            "win_rate": (sum(1 for e in ordered if e > 0) / len(ordered) * 100)
            if ordered else 0.0,
            "median_pp": statistics.median(ordered) if ordered else 0.0,
            "worst_pp": ordered[0] if ordered else 0.0,
            "best_pp": ordered[-1] if ordered else 0.0,
            "invested_eur": (sum(stakes) / len(stakes)) if stakes else 0.0,
        })

    return {
        "window_days": window_days,
        "weekday": weekday,
        "dca_invested_eur": (sum(dca_stakes) / len(dca_stakes)) if dca_stakes else 0.0,
        "variants": results,
    }


DATASET_COLUMNS = (
    "date", "close", "fear_greed", "rsi", "ma_dist_pct", "mayer",
    "drawdown_pct", "cycle_phase", "points_fng", "points_rsi", "points_ma",
    "score", "multiplier",
)


def dataset_rows(session: Session, days: int):
    """The whole scoring table, a row per day, for your own analysis.

    Every number the research section works from, so a question this dashboard
    does not answer can be answered somewhere else without reimplementing the
    scoring first.
    """
    for row in _window_rows(score_table(session), days):
        reading = row.readings
        yield [
            row.day.isoformat(),
            round(row.close, 2),
            int(reading["fng"]),
            round(reading["rsi"], 2),
            round(reading["ma_dist"], 2),
            round(reading["mayer"], 4),
            round(reading["drawdown"], 2),
            round(reading["cycle"], 4),
            row.points["fng"],
            row.points["rsi"],
            row.points["ma"],
            row.score,
            strategy.determine_purchase_strategy(row.score)["multiplier"],
        ]


def events(session: Session, days: int) -> list[dict]:
    """Dated landmarks worth drawing on a chart of this window.

    Only what can be stated as fact: the halvings, and the highest and lowest
    close the window actually contains. No tops called, no bottoms called.
    """
    table = score_table(session)
    rows = _window_rows(table, days)
    if not rows:
        return []

    found = [
        {"date": halving.isoformat(), "kind": "halving", "label": "Halving",
         "price": next((r.close for r in rows if r.day == halving), 0.0)}
        for halving in signals.HALVINGS
        if rows[0].day <= halving <= rows[-1].day
    ]

    peak = max(rows, key=lambda r: r.close)
    trough = min(rows, key=lambda r: r.close)
    found.append({"date": peak.day.isoformat(), "kind": "high",
                  "label": "Highest close", "price": peak.close})
    found.append({"date": trough.day.isoformat(), "kind": "low",
                  "label": "Lowest close", "price": trough.close})

    # A marker Recharts cannot place is worse than no marker: with a categorical
    # axis a ReferenceLine only lands if its x value is a day the series has.
    have = {row.day.isoformat() for row in rows}
    return sorted((e for e in found if e["date"] in have), key=lambda e: e["date"])


def score_history(session: Session, days: int) -> list[dict]:
    """The score the bot would have read on every day, with that day's close.

    The dashboard only ever shows the score on the days it happened to buy;
    this is the same reading taken daily, so the multiplier can be seen moving
    with the market instead of as 52 disconnected dots.
    """
    table = score_table(session)
    return [
        {
            "date": row.day.isoformat(),
            "close": row.close,
            "score": row.score,
            "multiplier": strategy.determine_purchase_strategy(row.score)["multiplier"],
        }
        for row in _window_rows(table, days)
    ]


def grid(session: Session, days: int, settings: BotSettings) -> dict:
    """Every buy weekday against every multiplier spread - the heatmap.

    Deliberately shipped with its own warning in the UI: the best cell here is
    the one that fit the past, which is not the same as the one that will fit
    the future.
    """
    table = score_table(session)
    rows = _window_rows(table, days)
    price = _last_price(table)
    base = settings.base_amount_eur
    cells = []
    for weekday in range(7):
        day_rows = [row for row in rows if row.day.weekday() == weekday]
        for spread in SPREADS:
            run = _simulate(day_rows, _coalition(ALL_INDICATORS, spread), base, price)
            cells.append({
                "weekday": weekday,
                "spread": spread,
                "edge_pp": run["edge_pp"],
                "edge_eur": run["edge_eur"],
                "purchase_count": len(day_rows),
            })

    return {
        "days": days,
        "current_weekday": settings.schedule_weekday,
        "current_spread": CURRENT_SPREAD,
        "spreads": [
            {
                "value": spread,
                "min_multiplier": round(0.5 ** spread, 2),
                "max_multiplier": round(1.5 ** spread, 2),
            }
            for spread in SPREADS
        ],
        "cells": cells,
    }
