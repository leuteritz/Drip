// The browser tab's drop, tinted by today's signal.
//
// A dashboard that sits open in a pinned tab all week can say something from
// the tab strip alone: the drop is teal on a strong buy, rose on a weak one.
// The colour is the *backend's* — `strategy.determine_purchase_strategy` picks
// it for the Discord embed and `/api/market/indicators` carries it — so the tab
// and the message can never disagree, and no palette hex is written here.

/** The drop from public/favicon.svg. Kept in step with it by hand; it is one path. */
const DROP_PATH =
  "M174 47.75a254.2 254.2 0 0 0-41.45-38.3a8 8 0 0 0-9.18 0A254.2 254.2 0 0 0 82 47.75C54.51 79.32 40 112.6 40 144a88 88 0 0 0 176 0c0-31.4-14.51-64.68-42-96.25m9.85 105.59a57.6 57.6 0 0 1-46.56 46.55a9 9 0 0 1-1.29.11a8 8 0 0 1-1.32-15.89c16.57-2.79 30.63-16.85 33.44-33.45a8 8 0 0 1 15.78 2.68Z";

/** "#45818c" from the int the API sends, the same way EmbedPreview reads it. */
export function hexFromSignalColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

let painted: string | null = null;

/** Repaints the tab icon in `hex`. A no-op while the colour has not changed. */
export function paintFavicon(hex: string): void {
  if (hex === painted) return;
  painted = hex;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path fill="${hex}" d="${DROP_PATH}"/></svg>`;
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
    document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon" }));
  link.type = "image/svg+xml";
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
