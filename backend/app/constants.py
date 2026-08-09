"""Project-wide constants.

The order/status values are part of the on-disk format: they live in existing
SQLite rows and in exported/legacy CSVs, and the frontend keys off
ORDER_ID_ERROR to render the "Error" badge. Treat them as constants, never
rename them casually.
"""

# The only traded pair; shared by the public market data and the trading client.
PRODUCT_ID = "BTC-EUR"

# Purchase.order_id sentinels (a real buy stores the Coinbase order id instead)
ORDER_ID_DRY_RUN = "DRY_RUN"
ORDER_ID_ERROR = "ERROR"

# Purchase.status values
STATUS_TEST = "Test"
STATUS_SUCCESS = "Success"

# Purchase.origin — what asked for the buy. Kept because the row cannot be read
# backwards for it: a buy somebody clicked is stored with multiplier 1.0 and is
# otherwise identical to a scheduled week that happened to score 1.0x, and a
# catch-up is a drip that simply appears on the wrong day. On-disk format for
# the same reason the sentinels above are.
ORIGIN_SCHEDULE = "schedule"
ORIGIN_MANUAL = "manual"
ORIGIN_CATCHUP = "catchup"
# The empty column: a row written before Drip recorded this, or one imported
# from a file that never carried it. Unknown — never "scheduled" by default,
# because guessing is the one thing this column exists to stop.
ORIGIN_UNKNOWN = ""
ORIGINS = (ORIGIN_SCHEDULE, ORIGIN_MANUAL, ORIGIN_CATCHUP)

# The answer one preflight check can give. Not on-disk — nothing stores these —
# but they are the API's own vocabulary and three modules speak it: `preflight`
# decides them, `notifier` ranks them into a message and the frontend colours
# them. They live here rather than in `preflight` because `notifier` cannot
# import that module without closing a circle back through `bot`.
#
# `PREFLIGHT_UNKNOWN` is a first-class answer and never a synonym for either of
# its neighbours: a balance that could not be fetched is not a healthy one and
# not an empty one, and being able to say so is what makes the rest credible.
PREFLIGHT_PASS = "pass"
PREFLIGHT_WARN = "warn"
PREFLIGHT_FAIL = "fail"
PREFLIGHT_UNKNOWN = "unknown"

# Where the stack is, in one word. Here for the same reason the four above are:
# `custody` decides them, `notifier` words them and the frontend colours them.
#
# `CUSTODY_UNKNOWN` is a first-class answer too, and it is the *only* honest one
# on an install with no keys — what Drip bought is a fact it owns, where that
# bitcoin is today is not. There is deliberately no word for "more than was
# bought": that is bitcoin from elsewhere sharing the account, and everything
# Drip bought is still on it, which is `CUSTODY_HELD`.
CUSTODY_HELD = "held"        # all of it is still on the exchange
CUSTODY_PARTLY = "partly"    # some has been moved off
CUSTODY_MOVED = "moved"      # what is left there is change, not a holding
CUSTODY_UNKNOWN = "unknown"  # no keys, or the balance could not be read
