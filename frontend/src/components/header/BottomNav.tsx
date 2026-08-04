import { NAV, type Section } from "./hooks";

/**
 * The phone's jump-nav: three sections, at the foot of the glass.
 *
 * The sticky bar carries the same three on a desk, where a pointer can reach
 * the top of a 27-inch screen as easily as the bottom. A phone held one-handed
 * cannot — the top bar is the far end of the thumb's arc — and it is the one
 * place where the three trays would have to fight the brand, the mode switch
 * and the tools for a row 390px wide. So below `md` the nav leaves the bar and
 * becomes what a phone already expects at the bottom of the screen.
 *
 * It is nav and nothing else. Nothing here spends money, nothing opens a
 * dialog; the things that do stay where they were, in the bar and the palette.
 *
 * The bar sits *over* the scroll rather than in it, so the tank keeps running
 * behind the frosted glass — `.pad-tabbar` on the page below reserves exactly
 * this height so the last card is never stuck underneath it, and `.pad-safe-b`
 * keeps the labels clear of a home bar.
 */
export default function BottomNav({
  active,
  onJump,
}: {
  active: Section;
  onJump: (id: Section) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="pad-safe-b fixed inset-x-0 bottom-0 z-40 border-t border-teal/12 bg-paper/92 pt-1.5 shadow-[0_-8px_28px_-18px_rgba(60,109,120,.75)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {NAV.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onJump(id)}
              aria-current={on ? "true" : undefined}
              className={`group flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 pb-1.5 pt-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                on ? "text-teal" : "text-ink-soft"
              }`}
            >
              {/* The pill behind the icon is what says "you are here" — a
                  coloured glyph alone is too small a difference to read at a
                  glance, and the label under it is the same width either way. */}
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                  on ? "bg-teal-deep text-cream shadow-sm" : "bg-transparent"
                }`}
              >
                <Icon className="text-xl" aria-hidden="true" />
              </span>
              <span className="text-2xs font-bold uppercase tracking-[0.12em]">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
