// The one link that leaves Drip.
//
// Drip can spend what is in a Coinbase account but can never put money into
// one: funding is a bank transfer behind Coinbase's own login, and no API key
// this dashboard could hold would change that. So the well readout, the setup
// dialog and the palette all point at the same page, and this is the single
// place that page is written down — three copies of a URL is three things to
// fix the day Coinbase moves it.
//
// It always opens in a **new tab**: the dashboard may be mid-buy, and nothing
// that only shows you something elsewhere may navigate this page away.

export const COINBASE_DEPOSIT_URL = "https://www.coinbase.com/deposit";

/** For the palette, which runs a callback rather than following an anchor. */
export function openCoinbaseDeposit(): void {
  window.open(COINBASE_DEPOSIT_URL, "_blank", "noopener,noreferrer");
}
