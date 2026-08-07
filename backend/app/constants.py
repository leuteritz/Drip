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
