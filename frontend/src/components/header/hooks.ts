import { useEffect, useState, type FunctionComponent, type RefObject, type SVGProps } from "react";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import FlaskIcon from "~icons/ph/flask";
import ListDashesIcon from "~icons/ph/list-dashes";

export type Section = "overview" | "research" | "history";

type IconComponent = FunctionComponent<SVGProps<SVGSVGElement>>;

/** Drip is weekly, so a week is the full run of both countdowns in the header:
 *  the pipe filling toward the next buy and the report badge filling toward the
 *  next send. Shared so the two fill on the same scale. */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The scroll sections, in page order — drives both the jump-nav and the spy. */
export const NAV: { id: Section; label: string; Icon: IconComponent }[] = [
  { id: "overview", label: "Overview", Icon: ChartLineUpIcon },
  { id: "research", label: "Research", Icon: FlaskIcon },
  { id: "history", label: "History", Icon: ListDashesIcon },
];

/** True once the scroll container has moved past `threshold` px — drives the
 *  sticky bar's condensed (blurred teal) background. */
export function useScrolled(
  scrollRef: RefObject<HTMLDivElement | null>,
  threshold = 40,
): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > threshold);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  return scrolled;
}

/** A clock that ticks every `intervalMs` — keeps relative times ("in 3 days")
 *  honest on a dashboard that can sit open for days without a reload. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

/** Highlights the nav entry for whichever section is most in view. */
export function useScrollSpy(scrollRef: RefObject<HTMLDivElement | null>): Section {
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
