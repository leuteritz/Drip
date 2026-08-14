import CheckIcon from "~icons/ph/check";
import SquaresFourIcon from "~icons/ph/squares-four";
import { CARDS, selection } from "../../lib/cards";
import { Modal, Note } from "../ui";

/**
 * What this page shows — the weekly report's block list, pointed at the page.
 *
 * The report has had seventeen switchable blocks since it was written and the
 * Overview has had none, which is a courtesy extended to the message and
 * withheld from the thing people actually read. So this is `DigestDialog`'s
 * left column, copied rather than reinvented: the same rows, the same tick box,
 * the same label/description pair, the same "6 of 7" counter, and the same
 * persist-on-change, so there is no save button to forget.
 *
 * What it does **not** copy is the preview beside it, and the reason is the
 * whole shape of this dialog: **the preview is the page behind it.** Ticking a
 * row updates `App`'s settings, the Overview re-renders, and the card vanishes
 * while you watch. That is why it is `max-w-lg` rather than the digest's
 * `max-w-4xl`, and why closing on the backdrop is right — you close it and you
 * are looking at the result.
 *
 * The two cards that cannot be hidden are named in one `Note` rather than shown
 * as two greyed-out rows: a disabled checkbox is a thing people try to click.
 * `lib/cards.ts` says why each is exempt.
 */
export default function CardsDialog({
  cards,
  onToggle,
  onClose,
}: {
  /** The stored blob, straight off `BotSettings`. Parsed in one place only. */
  cards: string | null | undefined;
  onToggle: (key: string, on: boolean) => void;
  onClose: () => void;
}) {
  const chosen = selection(cards);
  const shown = CARDS.filter((card) => chosen[card.key]).length;

  return (
    <Modal
      onClose={onClose}
      closeOnBackdrop
      className="max-h-[88vh] w-full max-w-lg overflow-y-auto ring-2 ring-teal/40"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-teal">
          <SquaresFourIcon /> What this page shows
        </h3>
        <span className="ml-auto text-xs text-ink-soft">
          {shown} of {CARDS.length}
        </span>
      </div>

      <div className="space-y-1">
        {CARDS.map((card) => {
          const on = chosen[card.key];
          return (
            <button
              key={card.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(card.key, !on)}
              className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                on ? "bg-water-soft/50" : "bg-sand-soft/40 opacity-70"
              } hover:opacity-100`}
            >
              <span
                className={`mt-0.5 flex h-4.5 w-4.5 flex-none items-center justify-center rounded-md border-2 text-2xs transition ${
                  on
                    ? "border-teal bg-teal-deep text-cream"
                    : "border-sand bg-paper text-transparent"
                }`}
              >
                <CheckIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold text-ink">{card.label}</span>
                <span className="block text-xs leading-snug text-ink-soft">
                  {card.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <Note>
        The strategy chart and the drip&apos;s record always show: one is what this
        page is about, the other is the only thing here that can tell you a buy
        never landed.
      </Note>

      <div className="mt-5 flex justify-end">
        <button
          onClick={onClose}
          className="rounded-full bg-sand-soft px-5 py-3 text-sm font-bold text-ink transition hover:opacity-80 max-sm:flex-1 sm:py-2.5"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
