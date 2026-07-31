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
from dataclasses import dataclass
from datetime import date, timedelta
from itertools import combinations
from math import factorial

from sqlmodel import Session

from . import indicators, strategy
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


@dataclass
class ScoredDay:
    """One candle day, with each indicator's points kept apart."""

    day: date
    close: float
    points: dict[str, int]

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

    fng_hist = indicators.get_fear_and_greed_history()
    window_start = date.today() - timedelta(days=RESEARCH_DAYS)
    rsi_lookback = strategy.RSI_PERIOD + 7  # the same slice the live bot scores

    rows: list[ScoredDay] = []
    for idx, day in enumerate(days):
        if idx < strategy.RSI_PERIOD or day < window_start:
            continue
        price = closes[idx]
        if not price:
            continue
        low = max(0, idx - strategy.MA_DAYS + 1)
        rows.append(ScoredDay(
            day=day,
            close=price,
            points=_indicator_points(
                fng=fng_hist.get(day, NEUTRAL_FNG),
                rsi=indicators.calculate_rsi_wilder(
                    closes[max(0, idx - rsi_lookback + 1): idx + 1],
                    period=strategy.RSI_PERIOD,
                ),
                price=price,
                ma=(prefix[idx + 1] - prefix[low]) / (idx + 1 - low),
            ),
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

def _simulate(rows: list[ScoredDay], active: frozenset[str], base: float,
              price: float, spread: float = CURRENT_SPREAD) -> dict:
    """Buys `base * multiplier` on every row, against a plain-DCA twin.

    Only the indicators in `active` count towards the score, which is how the
    attribution builds its coalitions; `spread` rescales the multiplier ladder
    for the grid. The DCA side is identical in every variant, so any difference
    in the edge comes from the multiplier alone.
    """
    bot_eur = bot_btc = dca_eur = dca_btc = 0.0
    for row in rows:
        score = sum(row.points[key] for key in active)
        multiplier = strategy.determine_purchase_strategy(score)["multiplier"] ** spread
        amount = round(base * multiplier, 2)
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
        frozenset(combo): _simulate(rows, frozenset(combo), base, price)
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
                run = _simulate(chunk, frozenset(INDICATORS), base, price)
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
    active = frozenset(INDICATORS)

    cells = []
    for weekday in range(7):
        day_rows = [row for row in rows if row.day.weekday() == weekday]
        for spread in SPREADS:
            run = _simulate(day_rows, active, base, price, spread)
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
