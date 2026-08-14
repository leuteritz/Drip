"""The scoring, at every threshold and on both sides of each.

`score_indicators` is the single source of truth for the live path, the backtest
and the CSV importer at once — change a number here and all three change. So the
thresholds are pinned from the outside: these tests read like the README's table
because that is the contract, and a rule that quietly moved would break it here
before anybody noticed it in a buy.

The additivity check at the end is the load-bearing one. `research`'s Shapley
coalitions are built by plain summation, which is only valid because every
neutral input scores exactly zero in its own block.
"""
import pytest

from app import strategy

NEUTRAL_PRICE = 50_000.0


def score(
    fng=strategy.NEUTRAL_FNG,
    rsi=strategy.NEUTRAL_RSI,
    ma=NEUTRAL_PRICE,
    price=NEUTRAL_PRICE,
) -> int:
    return strategy.score_indicators(
        fear_greed=fng,
        fng_classification="",
        rsi=rsi,
        current_price=price,
        ma_350=ma,
    ).score


class TestNeutralIsZero:
    """The property every other test and all of `research` rests on."""

    def test_all_three_neutral_scores_nothing(self):
        assert score() == 0

    def test_each_neutral_input_scores_nothing_in_its_own_block(self):
        assert score(fng=strategy.NEUTRAL_FNG) == 0
        assert score(rsi=strategy.NEUTRAL_RSI) == 0
        assert score(ma=NEUTRAL_PRICE) == 0


class TestFearAndGreed:
    @pytest.mark.parametrize(
        "value,points",
        [
            (0, 3), (24, 3),          # below 25
            (25, 2), (44, 2),         # below 45
            (45, 0), (54, 0),         # below 55
            (55, -2), (100, -2),      # 55 or above
        ],
    )
    def test_the_readme_table(self, value, points):
        assert score(fng=value) == points

    def test_the_boundaries_are_where_the_constants_say(self):
        assert score(fng=strategy.FNG_STRONG_FEAR - 1) == 3
        assert score(fng=strategy.FNG_STRONG_FEAR) == 2
        assert score(fng=strategy.FNG_FEAR - 1) == 2
        assert score(fng=strategy.FNG_FEAR) == 0
        assert score(fng=strategy.FNG_NEUTRAL - 1) == 0
        assert score(fng=strategy.FNG_NEUTRAL) == -2


class TestRsi:
    @pytest.mark.parametrize(
        "value,points",
        [
            (5.0, 3), (29.9, 3),      # below 30
            (30.0, 1), (44.9, 1),     # below 45
            (45.0, 0), (70.0, 0),     # neutral, 70 included
            (70.1, -2), (95.0, -2),   # above 70
        ],
    )
    def test_the_readme_table(self, value, points):
        assert score(rsi=value) == points

    def test_exactly_overbought_is_not_yet_overbought(self):
        # The rule is `> RSI_OVERBOUGHT`, not `>=`. Worth pinning: it is the one
        # asymmetric boundary in the three blocks.
        assert score(rsi=float(strategy.RSI_OVERBOUGHT)) == 0
        assert score(rsi=strategy.RSI_OVERBOUGHT + 0.1) == -2


class TestMovingAverage:
    """The block that grades a distance rather than answering a question."""

    # A round moving average with a round price, so the distance comes out
    # exactly. Dividing a fixed price by (1 + pct/100) does not: -25% arrives as
    # -25.000000000000004 and lands on the wrong side of a threshold that is
    # exclusive by design, which measures the rounding rather than the rule.
    MA = 100_000.0

    @pytest.mark.parametrize(
        "price,points",
        [
            (60_000.0, 3), (74_000.0, 3),    # far below (< -25%)
            (75_000.0, 2), (89_000.0, 2),    # well below (-25% to -10%)
            (90_000.0, 1), (99_000.0, 1),    # just below
            (100_000.0, 0), (130_000.0, 0),  # at it, or modestly above
            (131_000.0, -1), (160_000.0, -1),  # well above (> +30%)
            (161_000.0, -2), (220_000.0, -2),  # far above (> +60%)
        ],
    )
    def test_every_step_of_the_ladder(self, price, points):
        assert score(ma=self.MA, price=price) == points

    def test_the_thresholds_are_exclusive_on_both_sides(self):
        # Exactly -25% is "well below", not "far below"; exactly +30% is neutral,
        # not "well above". Both boundaries are reachable exactly at this MA.
        assert score(ma=self.MA, price=75_000.0) == 2   # -25.0% to the digit
        assert score(ma=self.MA, price=130_000.0) == 0  # +30.0% to the digit
        assert score(ma=self.MA, price=90_000.0) == 1   # -10.0% to the digit
        assert score(ma=self.MA, price=160_000.0) == -1  # +60.0% to the digit

    def test_it_can_subtract_which_is_why_score_min_exists(self):
        # Before this block was graded, no amount of dearness cost anything and
        # -6 was unreachable. Both ends must be real readings.
        assert score(ma=NEUTRAL_PRICE / (1 + 1.0)) == -2

    def test_no_moving_average_is_neutral_not_a_crash(self):
        assert score(ma=0.0) == 0
        assert score(ma=-1.0) == 0


class TestTheEnds:
    def test_score_max_is_reachable(self):
        assert score(fng=0, rsi=10.0, ma=NEUTRAL_PRICE / (1 - 0.40)) == strategy.SCORE_MAX

    def test_score_min_is_reachable(self):
        assert score(fng=90, rsi=90.0, ma=NEUTRAL_PRICE / (1 + 1.0)) == strategy.SCORE_MIN

    def test_the_constants_agree_with_the_blocks(self):
        assert strategy.SCORE_MAX == 9
        assert strategy.SCORE_MIN == -6


class TestTheLadder:
    """The bot ALWAYS buys — the ladder only sizes it."""

    @pytest.mark.parametrize(
        "value,multiplier",
        [
            (9, 1.5), (5, 1.5),
            (4, 1.25), (3, 1.25),
            (2, 1.0), (1, 1.0),
            (0, 0.75), (-1, 0.75),
            (-2, 0.5), (-6, 0.5),
        ],
    )
    def test_the_five_rungs(self, value, multiplier):
        assert strategy.determine_purchase_strategy(value)["multiplier"] == multiplier

    def test_every_score_in_range_buys_something(self):
        for value in range(strategy.SCORE_MIN, strategy.SCORE_MAX + 1):
            rung = strategy.determine_purchase_strategy(value)
            assert rung["multiplier"] >= 0.5
            assert rung["signal"]
            assert rung["color"]


class TestIndicatorPoints:
    """The additivity `research`'s coalitions are summed on."""

    @pytest.mark.parametrize(
        "fng,rsi,distance_pct",
        [
            (20, 25.0, -30.0),
            (60, 80.0, 70.0),
            (50, 50.0, 0.0),
            (44, 44.0, -11.0),
            (25, 70.0, 35.0),
        ],
    )
    def test_the_three_parts_sum_to_the_whole(self, fng, rsi, distance_pct):
        ma = NEUTRAL_PRICE / (1 + distance_pct / 100)
        parts = strategy.indicator_points(fng, rsi, NEUTRAL_PRICE, ma)
        assert sum(parts.values()) == score(fng=fng, rsi=rsi, ma=ma)

    def test_it_reports_all_three(self):
        parts = strategy.indicator_points(20, 25.0, NEUTRAL_PRICE, NEUTRAL_PRICE)
        assert set(parts) == {"fng", "rsi", "ma"}
