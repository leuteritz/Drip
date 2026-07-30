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
