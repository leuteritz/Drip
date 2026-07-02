import { useEffect, useState, type ReactNode, type RefObject } from "react";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import ClockIcon from "~icons/ph/clock";
import DropFillIcon from "~icons/ph/drop-fill";
import DropSlashIcon from "~icons/ph/drop-slash";
import FlaskIcon from "~icons/ph/flask";
import KeyIcon from "~icons/ph/key";
import LightningIcon from "~icons/ph/lightning-fill";
import ListDashesIcon from "~icons/ph/list-dashes";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import { WEEKDAYS, type BotStatus } from "../api/client";

export type Section = "overview" | "settings" | "history";

export const NAV: { id: Section; label: string; Icon: typeof DropFillIcon }[] = [
  { id: "overview", label: "Overview", Icon: ChartLineUpIcon },
  { id: "settings", label: "Settings", Icon: SlidersIcon },
  { id: "history", label: "History", Icon: ListDashesIcon },
];

/**
 * The sticky app header shared by the whole single-page app: brand, jump-nav
 * that smooth-scrolls to each section, the Simulate (backtest) action, and the
 * live status pills. A lightweight scroll-spy highlights the section in view.
 */
export default function SiteHeader({
  status,
  onSimulate,
  scrollRef,
}: {
  status: BotStatus | null;
  onSimulate: () => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const active = useScrollSpy(scrollRef);

  const jumpTo = (id: Section) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="hero-gradient sticky top-0 z-30 shrink-0 px-4 py-3 md:px-8 md:py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand + jump-nav */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5 text-cream">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cream/20 text-lg">
              <DropFillIcon />
            </span>
            <span className="font-display text-lg font-bold">Drip</span>
            <span className="ml-0.5 text-[11px] font-bold uppercase tracking-[0.16em] text-cream/70 max-sm:hidden">
              Bitcoin&nbsp;DCA
            </span>
          </div>
          <nav className="flex gap-1.5">
            {NAV.map(({ id, label, Icon }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => jumpTo(id)}
                  aria-current={on ? "true" : undefined}
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

        {/* Simulate + status pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onSimulate}
            className="flex items-center gap-1.5 rounded-full bg-cream px-3.5 py-1.5 text-xs font-bold text-teal shadow-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
          >
            <ChartLineUpIcon /> Simulate
          </button>
          {status && <StatusPills status={status} />}
        </div>
      </div>
    </header>
  );
}

function StatusPills({ status }: { status: BotStatus }) {
  return (
    <>
      {status.paused && status.paused_until ? (
        <HeaderPill>
          <DropSlashIcon /> Off until {formatDate(status.paused_until)}
        </HeaderPill>
      ) : status.next_run ? (
        <HeaderPill>
          <ClockIcon /> Next {formatDateTime(status.next_run)}
        </HeaderPill>
      ) : null}
      <HeaderPill>
        {status.dry_run ? (
          <>
            <FlaskIcon /> Dry run
          </>
        ) : (
          <>
            <LightningIcon /> Live
          </>
        )}
      </HeaderPill>
      {!status.has_credentials && (
        <HeaderPill>
          <KeyIcon /> No API keys
        </HeaderPill>
      )}
    </>
  );
}

export function HeaderPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/20 px-3 py-1.5 text-xs font-bold text-cream">
      {children}
    </span>
  );
}

/** Highlights the nav entry for whichever section is most in view. */
function useScrollSpy(scrollRef: RefObject<HTMLDivElement | null>): Section {
  const [active, setActive] = useState<Section>("overview");

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = NAV.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as Section);
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRef]);

  return active;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3)} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
