import { useEffect, useState, type RefObject } from "react";

/**
 * True once the element has come near the scroll viewport, and true forever
 * after.
 *
 * The research endpoints share one scoring table on the backend that spans
 * three years of candles; on a cold cache the first request fetches them all.
 * That is not work to start while the overview above is still painting, so the
 * whole section defers until the reader is actually heading for it.
 */
export function useNearViewport(
  ref: RefObject<HTMLElement | null>,
  root: RefObject<HTMLElement | null>,
  margin = "400px 0px",
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: root.current, rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, root, margin, near]);

  return near;
}
