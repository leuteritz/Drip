import type { ReactNode } from "react";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropFillIcon from "~icons/ph/drop-fill";
import ListDashesIcon from "~icons/ph/list-dashes";
import SlidersIcon from "~icons/ph/sliders-horizontal";

export type Page = "overview" | "settings" | "history";

export const NAV = [
  { id: "overview" as Page, label: "Overview", Icon: ChartLineUpIcon },
  { id: "settings" as Page, label: "Settings", Icon: SlidersIcon },
  { id: "history" as Page, label: "History", Icon: ListDashesIcon },
];

/**
 * The gradient header shared by all three tabs: brand + pill nav + status/action
 * slot, an optional hero block, and the animated waterline along the bottom edge.
 */
export default function TabHeader({
  active,
  onNavigate,
  right,
  children,
}: {
  active: Page;
  onNavigate: (p: Page) => void;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="hero-gradient relative shrink-0 overflow-hidden px-6 pt-6 pb-14 md:px-10 md:pt-8 md:pb-16">
      {/* Top row: brand + nav on the left, status/actions on the right */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3 text-cream">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream/20 text-xl">
              <DropFillIcon />
            </span>
            <span className="font-display text-xl font-bold">Drip</span>
          </div>
          <nav className="flex gap-1.5">
            {NAV.map(({ id, label, Icon }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
                    on
                      ? "bg-cream/95 text-teal shadow-sm"
                      : "bg-cream/20 text-cream hover:bg-cream/30"
                  }`}
                >
                  <Icon className="text-sm" />
                  <span className="max-sm:hidden">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>

      {/* Fixed-height hero region so every tab's header is the same height as
          Overview's; shorter titles bottom-align to the waterline. */}
      <div className="mt-5 flex min-h-[140px] flex-col justify-end md:min-h-[164px]">
        {children}
      </div>

      {/* Rolling waterline */}
      <svg
        viewBox="0 0 1080 46"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-[54px] w-full"
      >
        <g className="animate-wave">
          <path
            d="M-120 32 q30 -11 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="rgba(241,255,250,.55)"
          />
        </g>
        <g className="animate-wave-fast">
          <path
            d="M-120 28 q30 -14 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 V70 H-120 Z"
            fill="#f1fffa"
          />
        </g>
      </svg>
    </header>
  );
}
