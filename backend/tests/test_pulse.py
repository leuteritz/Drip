"""`missed_slot` — the one function here whose answer spends money.

Everything else in Drip reports. This is asked by the scheduler's catch-up job
and its return value becomes a buy at a moment nobody was sitting in front of,
which makes its four refusals the most load-bearing lines in the backend. Each
one of them has a test, and each test is named after the way it would go wrong.

The pause cases are the subtle pair, and they are the ones a reader should look
at first: a pause that has since *run out* still covers the slot it ran over.
Before `pauses.py` existed, a fortnight off ended with Drip buying the very week
it had just been told to skip, because by the time the job looked, `paused_until`
said nothing had ever been asked for.
"""
from datetime import date, datetime, timedelta

from app import cadence, pulse
from app.constants import ORDER_ID_ERROR
from app.models import PauseWindow


def _last_slot(settings) -> datetime:
    """The moment `missed_slot` will be judging, for the test to buy around."""
    return cadence.last_slot(
        settings.cadence,
        settings.schedule_weekday,
        settings.schedule_time,
        datetime.now(),
    )


class TestNothingToCatchUp:
    def test_a_fresh_install_never_buys_on_its_first_boot(self, session, settings, buy):
        # No history at all: Drip cannot have missed a period it did not exist
        # for, and a Pi coming up for the first time must not spend anything.
        assert pulse.missed_slot(session) is None

    def test_a_paused_bot_has_not_missed_anything(self, session, settings, buy):
        buy(datetime.now() - timedelta(days=40))
        settings.paused_until = date.today() + timedelta(days=7)
        session.add(settings)
        session.commit()
        assert pulse.missed_slot(session) is None

    def test_a_pause_that_has_run_out_still_covers_the_slot_it_ran_over(
        self, session, settings, buy
    ):
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        # A pause that started before the slot and ended after it, and which has
        # since expired: `paused_until` is clear, the record is not.
        session.add(
            PauseWindow(
                started_at=slot - timedelta(days=3),
                until=(slot + timedelta(days=1)).date(),
                ended_at=None,
            )
        )
        session.commit()
        assert settings.paused_until is None
        assert pulse.missed_slot(session) is None

    def test_a_pause_that_ended_before_the_slot_does_not_excuse_it(
        self, session, settings, buy
    ):
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        session.add(
            PauseWindow(
                started_at=slot - timedelta(days=20),
                until=(slot - timedelta(days=5)).date(),
                ended_at=slot - timedelta(days=5),
            )
        )
        session.commit()
        # The pause is over and the slot went by unanswered — this is the case
        # the job exists for.
        assert pulse.missed_slot(session) == slot


class TestTheMachineWokeUp:
    """Any row at or after the slot means the bot ran, whatever it says."""

    def test_a_landed_buy_answers_the_slot(self, session, settings, buy):
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        buy(slot + timedelta(minutes=1))
        assert pulse.missed_slot(session) is None

    def test_a_dry_run_answers_it_too(self, session, settings, buy):
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        buy(slot + timedelta(minutes=1), dry_run=True)
        assert pulse.missed_slot(session) is None

    def test_a_failed_order_answers_it_and_is_never_retried(self, session, settings, buy):
        # The exchange refused. That is an answer, and asking again tomorrow
        # would be a bot arguing with a decision it has already been given.
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        buy(slot + timedelta(minutes=1), order_id=ORDER_ID_ERROR)
        assert pulse.missed_slot(session) is None

    def test_a_row_exactly_on_the_slot_counts(self, session, settings, buy):
        slot = _last_slot(settings)
        buy(slot - timedelta(days=40))
        buy(slot)
        assert pulse.missed_slot(session) is None

    def test_a_row_a_moment_before_the_slot_does_not(self, session, settings, buy):
        slot = _last_slot(settings)
        buy(slot - timedelta(minutes=1))
        assert pulse.missed_slot(session) == slot


class TestOnlyEverTheLastSlot:
    def test_a_pi_off_for_two_months_comes_back_to_one_buy(self, session, settings, buy):
        # The window is irrelevant: this returns *a* slot, and the scheduler
        # buys that one. Two months of silence is still one answer, never eight.
        buy(datetime.now() - timedelta(days=60))
        answer = pulse.missed_slot(session)
        assert answer == _last_slot(settings)

    def test_the_answer_is_the_moment_so_the_buy_can_say_how_late_it_is(
        self, session, settings, buy
    ):
        buy(datetime.now() - timedelta(days=60))
        answer = pulse.missed_slot(session)
        assert isinstance(answer, datetime)
        assert answer.strftime("%H:%M") == settings.schedule_time

    def test_a_daily_cadence_is_one_buy_not_sixty(self, session, settings, buy):
        settings.cadence = "daily"
        session.add(settings)
        session.commit()
        buy(datetime.now() - timedelta(days=60))
        answer = pulse.missed_slot(session)
        assert answer == _last_slot(settings)


class TestItNeverWrites:
    def test_asking_changes_nothing(self, session, settings, buy):
        buy(datetime.now() - timedelta(days=60))
        before = pulse.missed_slot(session)
        assert pulse.missed_slot(session) == before
        assert pulse.missed_slot(session) == before
