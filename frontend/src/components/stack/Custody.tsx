import { useEffect, useState } from "react";
import VaultIcon from "~icons/ph/vault";
import type { BotSettings, Custody } from "../../api/client";
import { fmtEur, formatDayMonthYear } from "../../lib/format";
import { useStackAmount } from "../../lib/units";
import { Card, CardHeader, Failed, Loading, Note, Stat, StatFacts, StatRow } from "../ui";

/**
 * Where the stack is kept, which is the one thing the rest of this page cannot
 * say.
 *
 * Every card above reports how the saving is going. This one reports where the
 * result of it sits — and it is the counterpart to the well on the water: that
 * is money not yet spent, this is money spent and not yet moved anywhere only
 * you can reach.
 *
 * Two figures, from two different places, and the card never confuses them.
 * What Drip *bought* comes out of its own history and is always known. What is
 * *on the exchange* is Coinbase's answer and nobody else's, so an install with
 * no keys states the first and stays silent on the second rather than assuming
 * the two are the same number. Assuming it would mean warning somebody about a
 * risk they may have retired years ago.
 *
 * There is deliberately no button. An Advanced Trade key buys; withdrawing is
 * behind Coinbase's own login by design, which is the whole reason this is a
 * sentence and not an action.
 */
export default function CustodyCard({
  data,
  error,
  onRetry,
  settings,
  onSaveSettings,
}: {
  data: Custody | null;
  error?: string | null;
  onRetry?: () => void;
  settings: BotSettings | null;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
}) {
  const stackAmount = useStackAmount();

  if (!data) {
    return (
      <Card tone="strip" className="flex flex-col">
        <CardHeader title="Where your bitcoin is kept" />
        {error ? (
          <Failed
            what="Could not ask Coinbase what it is holding"
            why={error}
            onRetry={onRetry}
          />
        ) : (
          <Loading
            what="Asking Coinbase what it is still holding"
            why="Reading the account balance and holding it against every buy Drip has made."
          />
        )}
      </Card>
    );
  }

  const bought = data.bought_btc;
  const onExchange = data.btc_on_exchange ?? 0;
  // The share is of what Drip bought, so an account holding somebody else's
  // bitcoin too reads as a full bar rather than as more than everything.
  const share = bought > 0 ? Math.min(1, onExchange / bought) : 0;
  const movedOff = Math.max(0, bought - onExchange);

  return (
    <Card tone="strip" className="flex flex-col">
      <CardHeader
        title="Where your bitcoin is kept"
        info={
          <>
            <p>
              Two numbers from two places. What Drip{" "}
              <strong className="font-semibold text-ink">bought</strong> comes from
              its own history. What is{" "}
              <strong className="font-semibold text-ink">on the exchange</strong> is
              read from Coinbase &mdash; so without a key stored, Drip can tell you
              the first and nothing at all about the second.
            </p>
            <p className="mt-2">
              A balance smaller than the history means bitcoin has left the account.
              Drip does not guess where it went or which buys it came from &mdash;
              it only reports the difference.
            </p>
            <p className="mt-2">
              It cannot move anything either: the key it holds buys, and withdrawing
              is behind Coinbase&apos;s own login. This is a note, not a button.
            </p>
          </>
        }
      />

      {bought <= 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          Nothing bought yet, so there is nothing to keep anywhere.
        </p>
      ) : !data.configured ? (
        <NoKeys bought={bought} since={data.since} stackAmount={stackAmount} />
      ) : !data.available ? (
        <p className="py-6 text-center text-sm text-ink-soft">
          Coinbase would not say what the account holds, so where your{" "}
          {stackAmount(bought)} is sitting is unknown right now.
        </p>
      ) : (
        <>
          <SplitBar share={share} over={data.over} moved={data.standing === "moved"} />

          {/* The lead is the euros sitting on somebody else's account, because
              that is the one figure this card exists to make you act on. */}
          <StatRow className="mt-4">
            <Stat
              label="On the exchange"
              tone={data.over ? "down" : "plain"}
              hint={`${stackAmount(onExchange)} of ${stackAmount(bought)} Drip bought`}
            >
              {fmtEur(data.value_eur ?? 0, 0)}
            </Stat>
          </StatRow>
          <StatFacts
            className="mt-3"
            items={[
              { label: "of what Drip bought", value: `${Math.round(share * 100)}%` },
              {
                label: "moved off",
                value: movedOff > 0 ? stackAmount(movedOff) : "nothing yet",
              },
              {
                label: "buying here since",
                value: data.since ? formatDayMonthYear(data.since) : "—",
              },
            ]}
          />

          {(data.difference_btc ?? 0) > 0 && (
            <p className="mt-3 rounded-xl bg-water-soft/50 px-3.5 py-2.5 text-xs text-ink-soft">
              The account holds {stackAmount(data.difference_btc ?? 0)} more than Drip
              ever bought &mdash; bitcoin from somewhere else sharing it. Everything
              Drip bought is still there.
            </p>
          )}

          <Note>
            {data.standing === "moved" ? (
              <>
                Off the exchange. What is left on Coinbase is change, not a holding.
              </>
            ) : data.over ? (
              <>
                More than the {fmtEur(data.threshold_eur, 0)} you set is sitting on an
                account you do not hold the keys to. Worth moving to a wallet you do.
              </>
            ) : (
              <>
                Below the {fmtEur(data.threshold_eur, 0)} you set as worth acting on.
                Drip says nothing further until it is above it.
              </>
            )}
          </Note>
        </>
      )}

      {/* The threshold lives under the figure it judges, the same reason the
          catch-up switch lives under the record of missed buys. */}
      <ThresholdRow settings={settings} onSaveSettings={onSaveSettings} />
    </Card>
  );
}

/** The honest half of the card on an install with no Coinbase key. */
function NoKeys({
  bought,
  since,
  stackAmount,
}: {
  bought: number;
  since: string | null;
  stackAmount: (btc: number) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <VaultIcon className="text-2xl text-teal" aria-hidden="true" />
      <p className="font-display text-2xl font-semibold text-ink">
        {stackAmount(bought)}
      </p>
      <p className="max-w-md text-sm text-ink-soft">
        bought{since ? ` since ${formatDayMonthYear(since)}` : ""}. Where it is today
        is Coinbase&apos;s to answer, and Drip has no key to ask with &mdash; so it
        will not guess that all of it is still sitting there.
      </p>
    </div>
  );
}

/**
 * The one bar: how much of the stack the exchange still holds.
 *
 * Sand for a balance nobody needs to act on, rose once it is above the
 * threshold — the same colour the well turns when it runs dry, and for the same
 * kind of reason. The remainder is teal, the brand's own colour, because
 * bitcoin off the exchange is simply where a saver's bitcoin is supposed to end
 * up. It is never `kelp`: green means money made, and nothing was made here.
 */
function SplitBar({
  share,
  over,
  moved,
}: {
  share: number;
  over: boolean;
  moved: boolean;
}) {
  const pct = Math.round(share * 100);
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-teal/45">
        <div
          className={`h-full ${over ? "bg-rose" : "bg-sand"}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-2xs font-bold uppercase tracking-[0.12em] text-ink-soft">
        <span>{moved ? "off the exchange" : `${pct}% on Coinbase`}</span>
        <span>{moved ? "" : `${100 - pct}% moved off`}</span>
      </div>
    </div>
  );
}

/**
 * How much is too much to leave there — the install's own answer.
 *
 * A typed draft, committed on Enter and on blur rather than on every keystroke:
 * the same shape the spout's amount editor has, and the reason is the same, a
 * half-typed "1" is not a threshold anybody set. 0 keeps every figure above and
 * switches the nudge off.
 */
function ThresholdRow({
  settings,
  onSaveSettings,
}: {
  settings: BotSettings | null;
  onSaveSettings: (update: Partial<BotSettings>) => Promise<void>;
}) {
  const stored = settings?.custody_threshold_eur ?? 0;
  const [draft, setDraft] = useState(String(stored));

  // Follows the stored value while nothing is being typed, so a save made
  // somewhere else does not leave a stale number sitting in the field.
  useEffect(() => setDraft(String(stored)), [stored]);

  const commit = () => {
    const value = Number(draft);
    if (!Number.isFinite(value) || value < 0) {
      setDraft(String(stored));
      return;
    }
    if (value !== stored) void onSaveSettings({ custody_threshold_eur: value });
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-water-soft/50 px-3.5 py-3">
      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        Say something above
        <span className="flex items-center gap-1 rounded-lg border border-sand bg-paper px-2 py-1">
          <span className="text-ink-soft">&euro;</span>
          <input
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={draft}
            disabled={!settings}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setDraft(String(stored));
            }}
            className="w-20 bg-transparent font-display font-semibold text-ink outline-none"
          />
        </span>
      </label>
      <span className="min-w-0 flex-1 text-xs text-ink-soft">
        The weekly report mentions the exchange balance once it is worth more than
        this. Set it to 0 to keep the figures and drop the nudge.
      </span>
    </div>
  );
}
