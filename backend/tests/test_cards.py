"""The card-visibility blob: kept keys, refused shapes.

The one thing here that looks like a bug and is not: an unknown key is **kept**,
where `digest.merge_selection` drops one. `cards.py`'s docstring says why — the
frontend is deployed on its own, so an older backend meets a newer frontend
routinely, and dropping what it did not recognise would throw away a new card's
setting every time. That divergence has a test so it cannot be "fixed" quietly.
"""
import json

import pytest

from app import cards


class TestSelection:
    def test_an_empty_blob_is_an_empty_selection(self):
        assert cards.selection("{}") == {}
        assert cards.selection(None) == {}
        assert cards.selection("") == {}

    def test_it_never_raises_on_rubbish(self):
        # The page that would let you fix the column is the page this would
        # otherwise break.
        assert cards.selection("not json") == {}
        assert cards.selection("[1, 2, 3]") == {}
        assert cards.selection("42") == {}

    def test_values_are_coerced_to_booleans(self):
        assert cards.selection('{"years": 1, "custody": 0}') == {
            "years": True,
            "custody": False,
        }

    def test_it_resolves_nothing_against_a_registry(self):
        # Deliberately: this side holds no list. An absent key is absent, and
        # `lib/cards.ts` decides what that means.
        assert "method" not in cards.selection("{}")


class TestMerge:
    def test_one_toggle_leaves_the_others_alone(self):
        stored = json.dumps({"years": True, "custody": True})
        assert json.loads(cards.merge(stored, {"years": False})) == {
            "years": False,
            "custody": True,
        }

    def test_it_adds_a_key_that_was_not_there(self):
        assert json.loads(cards.merge("{}", {"method": False})) == {"method": False}

    def test_an_unknown_key_is_kept_not_dropped(self):
        # The deliberate divergence from `digest.merge_selection`. If this ever
        # starts failing because somebody made the two match, read `cards.py`.
        out = json.loads(cards.merge("{}", {"a-card-from-a-later-drip": False}))
        assert out == {"a-card-from-a-later-drip": False}

    def test_a_corrupt_stored_blob_is_replaced_rather_than_refused(self):
        assert json.loads(cards.merge("not json", {"years": False})) == {"years": False}


class TestRefusedShapes:
    def test_not_an_object(self):
        with pytest.raises(cards.CardsError):
            cards.merge("{}", ["years"])

    def test_a_value_that_is_not_a_boolean(self):
        with pytest.raises(cards.CardsError):
            cards.merge("{}", {"years": "yes"})

    def test_an_empty_key(self):
        with pytest.raises(cards.CardsError):
            cards.merge("{}", {"": False})

    def test_a_key_longer_than_the_cap(self):
        with pytest.raises(cards.CardsError):
            cards.merge("{}", {"x" * (cards.MAX_KEY_LEN + 1): False})

    def test_more_keys_than_the_cap(self):
        with pytest.raises(cards.CardsError):
            cards.merge("{}", {f"card-{i}": False for i in range(cards.MAX_KEYS + 1)})

    def test_the_cap_counts_the_merged_total_not_the_update(self):
        stored = json.dumps({f"old-{i}": True for i in range(cards.MAX_KEYS)})
        with pytest.raises(cards.CardsError):
            cards.merge(stored, {"one-more": True})

    def test_a_refusal_is_a_sentence(self):
        with pytest.raises(cards.CardsError) as caught:
            cards.merge("{}", {"years": "yes"})
        assert str(caught.value).endswith(".")
        assert "years" in str(caught.value)

    def test_nothing_is_written_when_a_refusal_happens(self):
        # `merge` returns a string; the caller assigns it. A raise means the
        # column keeps what it had — the `backup.stage`/`apply` split in
        # miniature.
        stored = json.dumps({"years": True})
        with pytest.raises(cards.CardsError):
            cards.merge(stored, {"years": False, "custody": "no"})
        assert json.loads(stored) == {"years": True}
