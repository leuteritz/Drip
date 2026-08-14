"""What a period is, at all four cadences.

`cadence.py` is the module every schedule question goes through, and its
docstring names the failure it exists to prevent: a monthly install judged by
the week would have handed the scheduler three phantom buys a month, with real
money. These are the calendar facts that has to keep being true.
"""
from datetime import date, datetime, timedelta

import pytest

from app import cadence

MONDAY = date(2026, 8, 3)      # a Monday
THURSDAY = date(2026, 8, 6)
SUNDAY = date(2026, 8, 9)


class TestPeriodStart:
    def test_daily_is_the_day_itself(self):
        assert cadence.period_start(THURSDAY, "daily") == THURSDAY

    @pytest.mark.parametrize("day", [MONDAY, THURSDAY, SUNDAY])
    def test_a_week_starts_on_its_monday(self, day):
        assert cadence.period_start(day, "weekly") == MONDAY

    def test_a_month_starts_on_the_first(self):
        assert cadence.period_start(THURSDAY, "monthly") == date(2026, 8, 1)

    def test_a_fortnight_always_starts_on_a_monday(self):
        assert cadence.period_start(THURSDAY, "biweekly").weekday() == 0

    def test_consecutive_mondays_share_one_fortnight(self):
        first = cadence.period_start(MONDAY, "biweekly")
        assert cadence.period_start(MONDAY + timedelta(days=7), "biweekly") == first
        assert cadence.period_start(MONDAY + timedelta(days=14), "biweekly") != first

    def test_the_fortnight_is_anchored_to_a_fixed_epoch(self):
        # The docstring's whole point: anchoring to the install would mean
        # deleting the oldest row silently redraws every boundary in the
        # history. The anchor is `_EPOCH`, so a bucket is a function of the
        # calendar alone and 2020's answer is the same as 2026's.
        old = cadence.period_start(date(2020, 3, 18), "biweekly")
        assert ((old - cadence._EPOCH).days // 7) % 2 == 0
        assert ((cadence.period_start(THURSDAY, "biweekly") - cadence._EPOCH).days // 7) % 2 == 0

    def test_an_unknown_word_reads_as_weekly(self):
        # Never raises: a column written by a later Drip is read as the schedule
        # every install had before cadences existed.
        assert cadence.period_start(THURSDAY, "fortnightly-ish") == MONDAY
        assert cadence.get(None).key == cadence.WEEKLY


class TestAdvance:
    def test_daily_steps_one_day(self):
        assert cadence.advance(THURSDAY, "daily") == date(2026, 8, 7)

    def test_weekly_steps_seven(self):
        assert cadence.advance(MONDAY, "weekly") == date(2026, 8, 10)

    def test_biweekly_steps_fourteen(self):
        assert cadence.advance(MONDAY, "biweekly") == date(2026, 8, 17)

    def test_monthly_steps_a_month_not_thirty_days(self):
        assert cadence.advance(date(2026, 1, 1), "monthly") == date(2026, 2, 1)
        # February is the case a fixed step gets wrong.
        assert cadence.advance(date(2026, 2, 1), "monthly") == date(2026, 3, 1)

    def test_monthly_crosses_the_year(self):
        assert cadence.advance(date(2026, 12, 1), "monthly") == date(2027, 1, 1)

    def test_monthly_steps_backwards_too(self):
        # `last_slot` walks back a period, so this direction decides money.
        assert cadence.advance(date(2026, 1, 1), "monthly", -1) == date(2025, 12, 1)

    def test_advance_is_exact_over_many_periods(self):
        assert cadence.advance(date(2026, 1, 1), "monthly", 13) == date(2027, 2, 1)


class TestSlotDay:
    def test_daily_ignores_the_weekday(self):
        assert cadence.slot_day(THURSDAY, "daily", 0) == THURSDAY

    def test_weekly_lands_on_the_chosen_weekday(self):
        assert cadence.slot_day(MONDAY, "weekly", 3) == THURSDAY

    def test_monthly_is_the_first_such_weekday(self):
        # August 2026 starts on a Saturday, so the first Thursday is the 6th —
        # never a 31st that half the months lack.
        assert cadence.slot_day(date(2026, 8, 1), "monthly", 3) == date(2026, 8, 6)

    def test_monthly_when_the_first_of_the_month_is_the_weekday(self):
        # 1 February 2027 is a Monday: the first Monday is the 1st itself.
        assert cadence.slot_day(date(2027, 2, 1), "monthly", 0) == date(2027, 2, 1)

    def test_every_month_of_a_year_lands_inside_its_own_month(self):
        for month in range(1, 13):
            start = date(2026, month, 1)
            slot = cadence.slot_day(start, "monthly", 4)
            assert slot.month == month and slot.year == 2026
            assert 1 <= slot.day <= 7


class TestLastSlot:
    """The moment that makes a period judgable, and so decides a catch-up."""

    def test_todays_slot_counts_once_it_has_passed(self):
        now = datetime(2026, 8, 6, 10, 0)  # Thursday, after 09:00
        assert cadence.last_slot("weekly", 3, "09:00", now) == datetime(2026, 8, 6, 9, 0)

    def test_a_slot_still_ahead_falls_back_a_period(self):
        # Thursday 08:00, before the 09:00 buy: the last one was last Thursday,
        # and counting this week as missed would report a failure every morning.
        now = datetime(2026, 8, 6, 8, 0)
        assert cadence.last_slot("weekly", 3, "09:00", now) == datetime(2026, 7, 30, 9, 0)

    def test_monthly_falls_back_over_the_year_boundary(self):
        now = datetime(2027, 1, 1, 8, 0)  # 1 Jan 2027 is a Friday; slot is Mon
        slot = cadence.last_slot("monthly", 0, "09:00", now)
        assert slot == datetime(2026, 12, 7, 9, 0)

    def test_the_slot_is_a_moment_not_a_date(self):
        # A pause asked for on Monday afternoon may not excuse a buy that was
        # due that morning, which only works if this carries the time.
        now = datetime(2026, 8, 3, 15, 0)
        assert cadence.last_slot("weekly", 0, "09:00", now).hour == 9


class TestPerYear:
    def test_nominal_and_describes_the_schedule(self):
        assert cadence.get("daily").per_year == 365.0
        assert cadence.get("weekly").per_year == 52.0
        assert cadence.get("biweekly").per_year == 26.0
        assert cadence.get("monthly").per_year == 12.0

    def test_every_cadence_has_both_words(self):
        for one in cadence.CADENCES:
            assert one.unit and one.units and one.unit != one.units
