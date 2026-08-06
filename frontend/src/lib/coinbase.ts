// The links that leave Drip, and the only ones.
//
// Drip can spend what is in a Coinbase account but can never put money into
// one: funding is a bank transfer behind Coinbase's own login, and no API key
// this dashboard could hold would change that. The same goes for making a key
// in the first place. So both steps are handed over rather than half-explained
// here, and this is the single place either address is written down — three
// copies of a URL is three things to fix the day Coinbase moves it.
//
// `HOST` is what the UI shows the reader. Every one of these opens in a **new
// tab**: the dashboard may be mid-buy, and nothing that only shows you
// something elsewhere may navigate this page away.

/** Where money is put into the account Drip spends from. */
export const COINBASE_DEPOSIT_URL = "https://www.coinbase.com/deposit";
/** Where the API key pair Drip trades with is made. */
export const COINBASE_KEYS_URL = "https://portal.cdp.coinbase.com/access/api";

/** The bare hostname, said out loud wherever one of these is offered. */
export const HOST: Record<string, string> = {
  [COINBASE_DEPOSIT_URL]: "coinbase.com",
  [COINBASE_KEYS_URL]: "portal.cdp.coinbase.com",
};

/** For the palette, which runs a callback rather than following an anchor. */
export function openCoinbaseDeposit(): void {
  window.open(COINBASE_DEPOSIT_URL, "_blank", "noopener,noreferrer");
}
