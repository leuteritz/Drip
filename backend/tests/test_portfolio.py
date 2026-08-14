"""The shared truth between the dashboard and the backtest.

`analytics` and `simulation` both go through these two functions, which is what
stops the live figures and the what-if disagreeing about what profit is. They
are small enough to read and important enough that a change to either should
have to be deliberate.
"""
from datetime import date

from app.portfolio import InvestmentEvent, build_series, side_summary


class TestSideSummary:
    def test_profit_is_value_minus_what_went_in(self):
        out = side_summary(invested=1000.0, btc=0.04, price=50_000.0)
        assert out["value_eur"] == 2000.0
        assert out["profit_eur"] == 1000.0
        assert out["profit_pct"] == 100.0

    def test_a_loss_is_reported_as_one(self):
        out = side_summary(invested=1000.0, btc=0.01, price=50_000.0)
        assert out["profit_eur"] == -500.0
        assert out["profit_pct"] == -50.0

    def test_nothing_invested_is_zero_percent_not_a_division_by_zero(self):
        out = side_summary(invested=0.0, btc=0.0, price=50_000.0)
        assert out["profit_pct"] == 0.0
        assert out["profit_eur"] == 0.0

    def test_it_reports_what_went_in_untouched(self):
        # `amount_eur` is what the buy was *ordered* for and never moves toward
        # what the exchange settled at — this is where that ends up.
        assert side_summary(1234.56, 0.02, 50_000.0)["invested_eur"] == 1234.56


class TestBuildSeries:
    DAYS = [
        (date(2026, 8, 1), 50_000.0),
        (date(2026, 8, 2), 55_000.0),
        (date(2026, 8, 3), 45_000.0),
    ]

    def test_a_buy_shows_from_its_own_day_onward(self):
        events = [InvestmentEvent(date(2026, 8, 2), 100.0, 0.002, 100.0, 0.002)]
        series = build_series(self.DAYS, events)
        assert series[0]["bot_invested"] == 0.0
        assert series[1]["bot_invested"] == 100.0
        assert series[2]["bot_invested"] == 100.0

    def test_value_follows_the_price_after_the_buy(self):
        events = [InvestmentEvent(date(2026, 8, 1), 100.0, 0.002, 100.0, 0.002)]
        series = build_series(self.DAYS, events)
        assert series[0]["bot_value"] == 100.0
        assert series[1]["bot_value"] == 110.0
        assert series[2]["bot_value"] == 90.0

    def test_the_two_sides_are_accumulated_apart(self):
        # A 1.5x week: the bot puts in half again as much as plain DCA, which is
        # the whole reason profit rather than value is what gets compared.
        events = [InvestmentEvent(date(2026, 8, 1), 150.0, 0.003, 100.0, 0.002)]
        series = build_series(self.DAYS, events)
        assert series[0]["bot_invested"] == 150.0
        assert series[0]["dca_invested"] == 100.0
        assert series[0]["bot_value"] == 150.0
        assert series[0]["dca_value"] == 100.0

    def test_a_buy_before_the_window_is_folded_in_on_the_first_day(self):
        events = [InvestmentEvent(date(2026, 7, 20), 100.0, 0.002, 100.0, 0.002)]
        series = build_series(self.DAYS, events)
        assert series[0]["bot_invested"] == 100.0

    def test_a_buy_after_the_window_never_lands(self):
        events = [InvestmentEvent(date(2026, 9, 1), 100.0, 0.002, 100.0, 0.002)]
        series = build_series(self.DAYS, events)
        assert all(point["bot_invested"] == 0.0 for point in series)

    def test_several_buys_on_one_day_all_land(self):
        events = [
            InvestmentEvent(date(2026, 8, 2), 100.0, 0.002, 100.0, 0.002),
            InvestmentEvent(date(2026, 8, 2), 50.0, 0.001, 50.0, 0.001),
        ]
        series = build_series(self.DAYS, events)
        assert series[1]["bot_invested"] == 150.0
        assert series[1]["bot_value"] == 0.003 * 55_000.0

    def test_no_events_is_a_flat_empty_series_not_a_crash(self):
        series = build_series(self.DAYS, [])
        assert len(series) == 3
        assert all(point["bot_value"] == 0.0 for point in series)

    def test_it_reports_one_point_per_day_in_order(self):
        series = build_series(self.DAYS, [])
        assert [point["date"] for point in series] == [
            "2026-08-01", "2026-08-02", "2026-08-03",
        ]
