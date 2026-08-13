import DropIcon from "~icons/ph/drop-fill";
import { Card, Spinner } from "../ui";

/**
 * What an install with nothing bought yet should say.
 *
 * The overview is six cards that each report on a history, so with no history
 * every one of them fell back to its own version of "nothing yet" — six
 * different sentences, about two and a half thousand pixels of empty furniture,
 * and not one button among them. Somebody opening Drip for the first time was
 * told six times that there was nothing to see and never once what to do.
 *
 * So this replaces the body outright rather than joining it. It is a `lead`
 * because it is the only thing on the page, and there may only be one of those:
 * shown *beside* the strategy chart, neither would lead.
 *
 * **One button, and it is the safe one.** A test buy writes a dry-run row, needs
 * no keys and cannot spend anything, so it is the one step that always works and
 * the fastest way to make the dashboard show what it is for. The other two
 * routes in are named in words rather than given buttons of their own — keys are
 * a dialog in the top bar and a CSV is a file picker in the history, and both
 * live where the thing they change is read.
 *
 * Research is deliberately left alone below this: it scores candles rather than
 * a history, so it works perfectly on a fresh install and is the one section
 * with something to show.
 */
export default function FirstRun({
  running,
  onTestBuy,
}: {
  running: boolean;
  onTestBuy: () => void;
}) {
  return (
    <Card tone="lead" className="flex flex-col items-center py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-water-soft text-2xl text-teal">
        <DropIcon aria-hidden="true" />
      </div>

      <h2 className="mt-4 font-display text-2xl font-semibold text-ink @lg:text-3xl">
        Nothing bought yet
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        Drip fills this page from your buys &mdash; what you paid on average, how
        the drip has held up against buying a flat amount, and how it has felt to
        hold. Run a test buy and it starts filling in.
      </p>

      <button
        onClick={onTestBuy}
        disabled={running}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-teal-deep px-6 py-3 text-sm font-bold text-cream transition hover:opacity-90 disabled:opacity-50 max-sm:w-full"
      >
        {running ? (
          <>
            <Spinner className="h-4 w-4" /> Running
          </>
        ) : (
          <>
            <DropIcon aria-hidden="true" /> Run a test buy
          </>
        )}
      </button>
      <p className="mt-2 text-xs text-ink-soft">
        A dry run. It records what it would have bought and spends nothing.
      </p>

      <p className="mt-6 max-w-md text-xs leading-relaxed text-ink-soft">
        Ready for the real thing? Your Coinbase keys go in{" "}
        <strong className="font-semibold text-ink">Setup</strong>, in the top bar.
        Already been saving elsewhere? Import a CSV from{" "}
        <strong className="font-semibold text-ink">Buy history</strong>, at the
        bottom of this page.
      </p>
    </Card>
  );
}
