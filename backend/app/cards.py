"""Which cards the Overview shows — stored here, decided nowhere near here.

The weekly report has had seventeen switchable blocks since it was written, and
the page has had none. That asymmetry was fine while the Overview was a chart
and two cards; it stopped being fine at eight, where the one card somebody never
looks at costs them a screen of scrolling on every visit. So the page gets the
same courtesy the report already extends.

**This module deliberately holds no registry.** `digest.BLOCKS` lives on the
backend because the backend *renders* the message — that is a reason about
rendering, not a reason about backends, and the cards are rendered by React. So
the list of what a card is, what it is called and whether it starts switched on
lives in `frontend/src/lib/cards.ts`, and the rule is:

    the registry lives on the side that renders

One rule, applied twice, landing on different sides. Put the labels here and
they become backend strings for something the backend never draws, drifting
silently the first time somebody edits a `CardHeader` title.

What follows from owning no vocabulary is the one place this deliberately parts
company with `digest.merge_selection`, and it is worth stating because it looks
like a bug. `digest` **drops** unknown keys, so a typo cannot accumulate — it
can afford to, because it knows every key there will ever be. This does not, and
the deployment makes that concrete rather than theoretical: the frontend is
built and restarted on its own (`docker compose up -d --no-deps frontend`, so
the bot keeps running), which means an older backend meets a newer frontend as a
matter of routine. Dropping what it did not recognise would silently throw away
a new card's setting every time.

    `cadence` refuses an unknown **word**, because it owns the words.
    `cards` refuses a bad **shape**, because it does not.

So: every key is kept, and the only refusals are structural — not an object of
booleans, too many keys, or a key long enough to be somebody using the column as
storage. The caps are generous on purpose; they are a guard against a runaway
writer, not an opinion about how many cards there should be.

Pure: no database, no clock, no imports from the rest of the app.
"""
import json

# A page cannot grow this many cards, and a key this long is not a key. Both are
# bounds on a column somebody else writes, not a statement about the design.
MAX_KEYS = 64
MAX_KEY_LEN = 64


class CardsError(ValueError):
    """A stored selection that is the wrong shape, in words the router can print.

    `backup.RestoreError`'s rule: a refusal is a sentence, not a code. There is
    only one caller and it turns this into a 400 the dialog shows as-is.
    """


def selection(stored: str | None) -> dict[str, bool]:
    """The stored selection as a plain dict. Never raises.

    A corrupted blob simply means the frontend falls back to every card's own
    default — `digest.selection`'s sentence, and the same reasoning: the page
    that would let you fix the column is the page this would have broken.

    Note what is *not* here: no resolution against a registry, because this side
    has none. An absent key is absent, and `lib/cards.ts` decides what that
    means.
    """
    try:
        parsed = json.loads(stored or "{}")
    except (TypeError, ValueError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(k): bool(v) for k, v in parsed.items()}


def merge(stored: str | None, update: dict) -> str:
    """The JSON blob to store after applying `update`.

    Unknown keys are **kept** — see the module docstring. Refuses only a shape,
    and refuses it before anything is written.
    """
    if not isinstance(update, dict):
        raise CardsError("Card visibility has to be an object of card names.")

    merged = selection(stored)
    for key, value in update.items():
        if not isinstance(key, str) or not key:
            raise CardsError("Every card name has to be a non-empty word.")
        if len(key) > MAX_KEY_LEN:
            raise CardsError(f"Card names cannot be longer than {MAX_KEY_LEN} characters.")
        if not isinstance(value, bool):
            raise CardsError(f"'{key}' has to be true or false.")
        merged[key] = value

    if len(merged) > MAX_KEYS:
        raise CardsError(f"That is more than the {MAX_KEYS} cards this can hold.")
    return json.dumps(merged)
