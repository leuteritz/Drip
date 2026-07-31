import DropFillIcon from "~icons/ph/drop-fill";
import type { DigestPreview } from "../../api/client";

/**
 * The weekly report as Discord will show it.
 *
 * The fields come from the backend already rendered — the same
 * `notifier.build_digest_embed` that builds the real message — so this file
 * only reproduces Discord's chrome: the bot line, the coloured left bar, and
 * the three-column field grid. Nothing here formats a number, which is what
 * keeps the preview honest.
 */
export default function EmbedPreview({
  preview,
  visible,
}: {
  preview: DigestPreview;
  visible: Set<string>;
}) {
  const fields = preview.fields.filter((f) => visible.has(f.key));
  // The embed colour is the signal colour, already one of the five palette
  // hexes (see strategy.determine_purchase_strategy) — so it arrives as data
  // rather than being a colour chosen here.
  const accent = `#${preview.color.toString(16).padStart(6, "0")}`;

  return (
    <div className="rounded-2xl bg-ink p-3.5 font-sans">
      {/* The message header Discord puts above every webhook post */}
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal text-cream">
          <DropFillIcon className="text-sm" />
        </span>
        <span className="text-sm font-bold text-cream">Drip</span>
        <span className="rounded bg-water/30 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-cream">
          Bot
        </span>
      </div>

      <div
        className="rounded-md rounded-l-sm border-l-4 bg-cream/6 px-3.5 py-3"
        style={{ borderLeftColor: accent }}
      >
        <div className="font-display text-[15px] font-semibold text-cream">
          {preview.title}
        </div>
        <p className="mt-1 text-[12px] leading-snug text-cream/65">
          <RichText text={preview.description} />
        </p>

        {fields.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
            {fields.map((field, i) => (
              <div
                key={`${field.key}-${i}`}
                className={field.inline ? "col-span-1" : "col-span-3"}
              >
                <div className="text-[11px] font-bold leading-tight text-cream">
                  {field.name}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-cream/65">
                  <RichText text={field.value} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-rose/25 px-3 py-2 text-[12px] font-bold text-cream">
            Nothing selected — no report would be sent.
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-cream/45">
          <DropFillIcon /> Drip · today
        </div>
      </div>
    </div>
  );
}

/** Discord's `**bold**`, the only markup the report uses. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <b key={i} className="font-semibold text-cream">
            {part.slice(2, -2)}
          </b>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
