// Drip's version and its short changelog.
//
// Single source of truth for both — the header badge reads VERSION, the popover
// reads CHANGELOG. Newest release first; `VERSION` is always CHANGELOG[0].
//
// Keep entries short: one line per change, written for the person running the
// bot, not for the person who wrote the code. Bump minor for features and
// refactors, major for a change that alters how Drip is operated or deployed.
// `package.json` mirrors the same number.

export interface Release {
  version: string;
  /** ISO date, formatted for display by the badge. */
  date: string;
  changes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "2.35",
    date: "2026-08-09",
    changes: [
      "The confirmation before live trading now says your actual rhythm — \"every day at 09:00\", \"the first Monday of each month\" — instead of naming a weekday a daily drip does not have",
      "The backtest says out loud that it replays a weekly schedule whatever yours is: it measures the scoring, not the calendar",
    ],
  },
  {
    version: "2.34",
    date: "2026-08-09",
    changes: [
      "The drip no longer has to be weekly: daily, fortnightly and monthly are now yours to pick, on the same chip that already set the day and the time",
      "Everything that judged the bot by the week judges it by your own rhythm instead — the record of what landed counts months for a monthly drip, the streak does too, and catching a missed buy up no longer thinks a monthly saver skipped three weeks out of four",
      "Your existing schedule is untouched: an install that was buying weekly goes on buying weekly, on the same day, at the same time",
    ],
  },
  {
    version: "2.33",
    date: "2026-08-09",
    changes: [
      "The backup you download can now be uploaded again — which is what makes it a backup rather than a copy. Setup → Restore takes the file, and a Drip moves to a new Pi by handing it over",
      "The file is checked before anything is touched: a half-finished download, somebody else's database, or a file that is not one at all is refused with the reason, and your history stays exactly where it was",
      "A backup from an older Drip is brought up to date on the way in, and the database it replaced is kept beside the new one in case the wrong file was picked",
    ],
  },
  {
    version: "2.32",
    date: "2026-08-09",
    changes: [
      "Drip now checks whether the next buy will actually go through — the key, the money on the exchange, the price feed and the schedule — before the day it is due, instead of you finding out from a week that never happened",
      "If something would stop it, the top bar says so and the check lists what: a key Coinbase no longer accepts, an account that will not cover the next buy, a scheduler that came up without its job. Press Ctrl+K and search for it any time you just want to know it is fine",
      "The weekly report carries the same answer, and says nothing more than it has to — everything in order is one line; anything wrong is named",
    ],
  },
  {
    version: "2.31",
    date: "2026-08-08",
    changes: [
      "Every buy in the history now opens: tap a row for what became of it — what those euros are worth today, and how far above or below what you paid they stand",
      "It also says what the multiplier had to do with it: a 1.25x week put a fifth of its money in because the market looked cheap, and this is the first place that says what that decision has been worth since — including the weeks it cost you",
      "The three readings behind the buy are laid out the way the next buy's are, so a row from two years ago can explain its own size; where the price ranks among your buys and when it turns a year old close the page",
    ],
  },
  {
    version: "2.30",
    date: "2026-08-08",
    changes: [
      "Drip now says when the money on Coinbase is running out: a buy that leaves two buys' worth or less behind carries a warning, so you top up before an order is refused rather than after one was",
      "The weekly report gained a Coinbase well line — what is left on the exchange and roughly how many buys it covers — switchable like every other block",
      "An install without API keys has no well to report, so nothing is said; one that has them but could not reach Coinbase says exactly that instead of a number",
    ],
  },
  {
    version: "2.29",
    date: "2026-08-08",
    changes: [
      "Every buy now records what asked for it — the weekly drip, a button you pressed, or a week Drip caught up after the Pi had been off — and the history says so under the date",
      "Ask for them by name in the search: manual, catchup, scheduled, and unknown for the buys made before this was written down",
      "Buys from before this release are reported as unknown rather than guessed at, and the CSV export carries the new column on the end, so an older reader still opens the file",
    ],
  },
  {
    version: "2.28",
    date: "2026-08-08",
    changes: [
      "A real buy is read back from Coinbase instead of being worked out here — the bitcoin in your history is now the bitcoin that actually arrived, at the price it was actually filled at",
      "The fee is recorded with it: what you paid on average always had Coinbase's cut inside it and never said so, and the cost basis card now names the amount",
      "Every buy carries its fee into the table, the CSV export and the search, and the Discord message says it too",
    ],
  },
  {
    version: "2.27",
    date: "2026-08-07",
    changes: [
      "Drip remembers the weeks you paused it: they stand in sand on the weeks card, count neither for you nor against you, and stop dragging the percentage down",
      "A paused week is never bought late either — catching up used to buy the very week it had just been told to skip, as soon as the pause ran out",
    ],
  },
  {
    version: "2.26",
    date: "2026-08-07",
    changes: [
      "The well's deposit button turns into Coinbase when you point at it — the glass takes on Coinbase's own blue and the word unrolls beside the plus, so where it sends you is said before you click rather than after",
      "It floats over the balance instead of beside it, so the longer word can never shorten the figure",
    ],
  },
  {
    version: "2.25",
    date: "2026-08-06",
    changes: [
      "The well's button is called Deposit now — Coinbase's own word for the page it opens",
      "It answers the pointer: the pill rises, its arrow lifts away in the direction it points, and a tap presses it back in",
    ],
  },
  {
    version: "2.24",
    date: "2026-08-06",
    changes: [
      "Every link that hands you over to Coinbase now says so before you follow it: one shared mark, the site's name written out, and a new tab so the dashboard is never navigated away mid-buy",
      "The setup dialog gathers both of them under one heading — the page where an API key is made, and the page where money goes in",
      "The well's top-up button is quiet while the well is full, and spells itself out in rose once it runs dry or has never been filled",
    ],
  },
  {
    version: "2.23",
    date: "2026-08-06",
    changes: [
      "There is now a way to fill the well: a top-up button on the Coinbase balance, a row in the setup dialog and a \"Top up on Coinbase\" entry in the palette — all three open Coinbase's own deposit page in a new tab",
      "Drip never handles the transfer itself, so the button is only a way there; the money you put in is what the next drips spend",
      "It is offered before any key is stored too, so an account can be funded while Drip is still being set up",
    ],
  },
  {
    version: "2.22",
    date: "2026-08-05",
    changes: [
      "A week the Pi slept through can now be bought after the fact: switch \"catch a missed buy up\" on under the attendance card, and when Drip comes back it buys the slot it was off for — once, at that moment's price and that moment's score, never while paused and never more than the most recent one, so a machine that was off for two months comes back to one buy and not to eight",
      "Drip also looks once a day, so a week lost to something other than a reboot is still found while there is time to buy it",
      "The Discord message for a late buy says which slot it is answering and how late it is, instead of a purchase quietly turning up on the wrong day",
      "A new setting now reaches an install that has been running for months, rather than only ever new ones — which is why the switch above is simply there after this update",
    ],
  },
  {
    version: "2.21",
    date: "2026-08-05",
    changes: [
      "The README shows Drip on a phone as three screens side by side — the dashboard, the buy history and the wall display — instead of one shot with an empty column beside it",
      "The tour above them is a list of what you get rather than a paragraph to read",
    ],
  },
  {
    version: "2.20",
    date: "2026-08-05",
    changes: [
      "Ctrl-K now searches your buys, not just Drip's own switches: type a date, a price or a signal and the buys that match come back with the answer above them — how many, how much you put in, how much bitcoin it bought and the average price you paid for it",
      "It understands the way you would say it — \"august\", \"2026-03\", \"30d\" for the last thirty days, \"since:2026-01\", \"price>60000\", \"fg<30\" — and words can be combined, so \"july dry\" is every test run made in a July",
      "The same words work in the history's own search bar, and picking a result down there carries your question with it",
    ],
  },
  {
    version: "2.19",
    date: "2026-08-05",
    changes: [
      "Drip now keeps its own attendance record: one mark per week since your first buy, so a week it never bought in — the Pi off, the container stopped, the network down on the morning of the drip — is finally visible, instead of leaving no trace at all",
      "Each missed week is priced at what it would have bought that day, and if the buy that was due has not landed the card says so at the top",
      "The weekly report carries the same line, and a run that falls over before it can buy now says so on Discord rather than only in a log file on the Pi",
    ],
  },
  {
    version: "2.18",
    date: "2026-08-04",
    changes: [
      "The four read-outs on the water are now one set of instruments: each names itself, states its figure and draws its own scale along the foot, so the signal, the mood, the price and the well can be compared at a glance instead of read one by one",
      "The well counts its runway in ticks — one per buy it can still pay for — and the bitcoin scale marks the 350-day average, so how far under or over it the price sits is something you can see",
      "The glass they sit in is clearer: the tank shows through, the lit top edge states the shape, and a chip still waiting now says which of the four it is",
    ],
  },
  {
    version: "2.17",
    date: "2026-08-04",
    changes: [
      "Drip now fits a phone: the type is set larger on a small screen, everything you tap is thumb-sized, and the three sections sit in a tab bar along the bottom where your thumb already is",
      "On a phone the buy history is one card per buy — date, amount, drops and status — instead of a nine-column table you had to drag sideways, and it sorts from a row of chips",
      "Dialogs rise from the bottom edge as sheets on a phone, and the wall display now works on one held upright",
    ],
  },
  {
    version: "2.16",
    date: "2026-08-04",
    changes: [
      "A profit is now written in green wherever it appears, the way a loss has always been written in red — the reservoir, the charts and every figure in Research, day and night",
    ],
  },
  {
    version: "2.15",
    date: "2026-08-04",
    changes: [
      "The next buy's day and time now carries the countdown with it in one chip, centred between a clock and the pencil that edits it",
    ],
  },
  {
    version: "2.14",
    date: "2026-08-04",
    changes: [
      "Test and Buy now sit together in one rounded tray instead of being split off by a dividing line",
    ],
  },
  {
    version: "2.13",
    date: "2026-08-04",
    changes: [
      "When motion is switched off, the tank's bubbles now hold their place along the way up instead of dropping back to the floor — the water looks like water in a screenshot too",
    ],
  },
  {
    version: "2.12",
    date: "2026-08-04",
    changes: [
      "The drop beside the next buy — on the card, on the wall display and in the command list — is now Drip's own, the same one the page wears at the top left",
    ],
  },
  {
    version: "2.11",
    date: "2026-08-04",
    changes: [
      "Test and Buy now wear Drip's own drop, the same mark as the one at the top left — hollow for a test run, filled for a buy that spends",
    ],
  },
  {
    version: "2.10",
    date: "2026-08-04",
    changes: [
      "The bar at the top is tidied into three groups: the dry-run/live switch, the tools, and the three sections of the page — so eight loose buttons now read as three things",
      "The backtest moved up there with them. It spends nothing, so it no longer sits beside Buy, and it can be opened from anywhere in the scroll instead of only from the top",
    ],
  },
  {
    version: "2.9",
    date: "2026-08-03",
    changes: [
      "Every wait now carries its own clock: the seconds sit inside the ring, and its arc creeps further round the longer the fetch takes — so a slow call looks slow at a glance, from the tank down to the last research card",
      "The bar at the top counts along with it, so you can see how long the page has been busy from anywhere in the scroll",
    ],
  },
  {
    version: "2.8",
    date: "2026-08-03",
    changes: [
      "Nothing waits silently any more: every figure that is not there yet says what is being fetched and why it takes a moment — the reservoir, the four chips on the water, the next buy, every card below and the wall display",
      "The bar at the top names what the page is still waiting for and clears itself the moment everything has arrived, so a cold Pi is visibly busy from anywhere in the scroll",
      "The buy history and the cost-basis card no longer say \"no buys yet\" while they are still loading",
    ],
  },
  {
    version: "2.7",
    date: "2026-08-03",
    changes: [
      "The tank now fizzes at the strength of the signal: a strong buy week has twice as many bubbles rising twice as fast as a weak one, so the water tells you what the score says before you read it",
      "Both ends stay watchable — the quiet tank keeps half its bubbles across the full width, and the busy one is livelier without turning into a jacuzzi",
    ],
  },
  {
    version: "2.6",
    date: "2026-08-03",
    changes: [
      "The tank's bubbles rise the full depth of the water now — from anywhere along the floor to just under the surface — instead of stopping halfway up on a tall header or on the wall display",
      "More of them, each on its own path, and they no longer bunch up along the bottom",
    ],
  },
  {
    version: "2.5",
    date: "2026-08-03",
    changes: [
      "The next buy card is now where the drip is set: click the amount to change your base, click the day and time to move the schedule or pause for a week or two",
      "The sliders button and the settings drawer under it are gone — nothing to open and close, and no second copy of a number the card already shows",
      "Ctrl+K has an entry for each: \"Set the buy amount\" and \"Change the schedule\"",
    ],
  },
  {
    version: "2.4",
    date: "2026-08-03",
    changes: [
      "Every card in Overview and Research now says in one short line what it is telling you — the long explanation moved into the ⓘ in its corner, where it can be read on purpose rather than skipped",
      "Plainer words throughout: lots are buys, windows are test runs, and each figure's label now says what the number actually means",
      "The weekly report speaks the same way, and no longer says \"in 1 days\"",
    ],
  },
  {
    version: "2.3",
    date: "2026-08-03",
    changes: [
      "Everything is a step smaller on a desktop screen — the type had grown to where a dashboard meant for one glance no longer fitted one",
    ],
  },
  {
    version: "2.2",
    date: "2026-08-01",
    changes: [
      "A loss in the tank is legible after dark again: the red under the reservoir was reading as near-black on the night water, and so was the well's \"running dry\" warning",
      "The whole page is sized by the browser's own text size now, so a large monitor gets a larger Drip instead of small print in a wide column",
      "The read-outs under the reservoir are four cards on one baseline — signal, market, bitcoin, well — instead of five that rewrapped at every width",
    ],
  },
  {
    version: "2.1",
    date: "2026-08-01",
    changes: [
      "The README now shows Drip after dark — both screenshots are taken in the night theme",
    ],
  },
  {
    version: "2.0",
    date: "2026-08-01",
    changes: [
      "A wall display at /#tank: the reservoir, the price and the next buy on one screen, sized to read from across the room",
      "Point a spare monitor at it and leave it — it refreshes itself, never scrolls, and nothing on it can spend money. Esc comes back to the dashboard",
    ],
  },
  {
    version: "1.20",
    date: "2026-08-01",
    changes: [
      "A buy now lands in the tank: rings spread from the waterline when one goes through",
      "The browser tab's drop takes the day's signal colour, so a pinned Drip says something without being opened",
      "Figures that sit in a column line up digit for digit again — the heading typeface has no such thing as an even-width digit, so the tables no longer use it",
    ],
  },
  {
    version: "1.19",
    date: "2026-08-01",
    changes: [
      "Ctrl+K — ⌘K on a Mac — opens one search box that reaches every section, every dialog and every switch, so nothing is hidden in a corner of the header any more",
      "Switching to live trading is deliberately not in it: that one keeps its confirmation in the top bar",
    ],
  },
  {
    version: "1.18",
    date: "2026-08-01",
    changes: [
      "A card that faces forwards: what Drip has actually been stacking per week, a year of that, and how far it leaves the next round number of sats",
      "The milestone ladder now carries on past a whole coin, so a bigger stack still has something ahead of it — on the dashboard and in the weekly report alike",
    ],
  },
  {
    version: "1.17",
    date: "2026-08-01",
    changes: [
      "Click the stack figure in the header to read every bitcoin amount in sats instead of BTC — the Coinbase well, the history totals and the holding report all follow it",
    ],
  },
  {
    version: "1.16",
    date: "2026-08-01",
    changes: [
      "The next buy shows its own arithmetic: tap the drops under the amount, or the signal beside it, and Drip lists what each of the three indicators reads right now and the points it put in",
    ],
  },
  {
    version: "1.15",
    date: "2026-08-01",
    changes: [
      "A night theme, in the same five colours: the tank dims with the room instead of glowing at you across a dark kitchen",
      "It follows your phone or laptop by default — the sun in the top bar switches to day, night, or back to following the device",
    ],
  },
  {
    version: "1.14",
    date: "2026-07-31",
    changes: [
      "Setup, in the top bar: paste your Coinbase key and Discord webhook straight into the dashboard instead of editing a file on the Pi",
      "The same dialog shows what the backend is actually doing — scheduler jobs, cached price history, database size — and can rebuild a cache or take a backup without a terminal",
    ],
  },
  {
    version: "1.13",
    date: "2026-07-31",
    changes: [
      "Closer rungs on the next-milestone line — half a coin no longer reads as \"4% of the way\" to a whole one for years",
      "README rewritten around the weekly report, with fresh screenshots",
    ],
  },
  {
    version: "1.12",
    date: "2026-07-31",
    changes: [
      "Waiting now tells you something: every spinner says what is being built, counts the seconds, and explains itself when it takes a while",
      "The Research section reports how many of its seven analyses are ready instead of showing seven silent placeholders",
    ],
  },
  {
    version: "1.11",
    date: "2026-07-31",
    changes: [
      "The weekly report now has its own badge in the top bar — reachable from anywhere, and it opens straight into the editor",
      "The badge fills up across the week, so you can see the next report coming without reading the time",
    ],
  },
  {
    version: "1.10",
    date: "2026-07-31",
    changes: [
      "The weekly report is yours to shape: choose the day, the time and exactly which parts it carries",
      "Twelve sections to pick from, four of them new — the week's price move, how well the week's buy was timed, your next sats milestone and your saving streak",
      "A live preview shows the Discord message as you tick boxes, and sends it on demand",
      "The report can be switched off without touching the buy schedule",
    ],
  },
  {
    version: "1.9",
    date: "2026-07-31",
    changes: [
      "Shorter README with a fresh dashboard screenshot — no change to the bot itself",
    ],
  },
  {
    version: "1.8",
    date: "2026-07-31",
    changes: [
      "A weekly digest on Discord every Sunday at 18:00 — your week in one message",
      "Sats stacked, your entry against the market, and where you stand versus plain DCA",
      "New button beside the Discord toggle sends this week's digest right now",
      "Research: download every scored day as a CSV, to answer questions Drip doesn't",
      "The score chart now marks the halving and the window's highest and lowest close",
    ],
  },
  {
    version: "1.7",
    date: "2026-07-31",
    changes: [
      "Research screens six signals by one test — the three in your score and three that are not",
      "New candidates measured before anything is changed: Mayer Multiple, drawdown from the high, cycle position",
      "A side-by-side of what a softer scoring, or an extra indicator, would have done over 105 windows",
      "Each variant shows its stake next to its edge, so buying more is not mistaken for buying better",
      "Nothing about your bot changed — every one of these is read-only",
    ],
  },
  {
    version: "1.6",
    date: "2026-07-31",
    changes: [
      "Overview now shows your cost basis: your average entry against what buying evenly would have paid",
      "Sats per euro for every buy, so a small stack still has a number that moves",
      "Holding periods: which lots have passed the one-year mark and when the next one does",
      "Buys recorded as failed orders are now named and counted, instead of only being left out",
      "Research: the daily score plotted against the price it was read from",
    ],
  },
  {
    version: "1.5",
    date: "2026-07-31",
    changes: [
      "New Research section — four ways of checking whether the score is worth its multiplier",
      "Where the edge comes from: splits the gap to plain DCA between Fear & Greed, RSI and the 350d MA",
      "How often it worked: the same backtest from every start date, so one lucky window can't flatter it",
      "Does the score see anything: what the price did 30, 90 and 180 days after each score",
      "Weekday against spread: a heatmap of what would have worked — read the warning before you tune anything",
    ],
  },
  {
    version: "1.4",
    date: "2026-07-31",
    changes: [
      "Search bar above the buy history — press / from anywhere to jump into it",
      "Search by date or status, or filter numbers: fg<30, rsi>70, x1.5, amount>=25",
      "One-click chips for real buys, dry runs, errors, fear buys and full drops",
      "The buy count and totals now follow whatever the search leaves on screen",
    ],
  },
  {
    version: "1.3",
    date: "2026-07-31",
    changes: [
      "Next buy is now a wide bar across the header with bigger buttons",
      "It shows how long until the next drip and what makes the amount",
      "A pipe along its bottom edge fills as the week runs down",
    ],
  },
  {
    version: "1.2",
    date: "2026-07-30",
    changes: [
      "Readme cut back to the essentials, with a current dashboard screenshot",
    ],
  },
  {
    version: "1.1",
    date: "2026-07-30",
    changes: [
      "Overview chart split in two: euros on top, BTC price and your buys below",
      "Taller chart with bigger labels and a legend that matches the lines",
      "Dropped the second price axis that made the old chart hard to read",
      "Hovering either half reads out the same day in both",
    ],
  },
  {
    version: "1.0",
    date: "2026-07-30",
    changes: [
      "First versioned release",
      "Header split into modules, dead code removed",
      "Backend split into market data and trading",
      "Typed API responses shared with the dashboard",
      "Escape closes every dialog, API errors are shown",
    ],
  },
];

export const VERSION = CHANGELOG[0].version;
