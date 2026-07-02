import { useState } from "react";
import ChartLineUpIcon from "~icons/ph/chart-line-up";
import DropFillIcon from "~icons/ph/drop-fill";
import ListDashesIcon from "~icons/ph/list-dashes";
import SlidersIcon from "~icons/ph/sliders-horizontal";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

type Page = "overview" | "settings" | "history";

const NAV = [
  { id: "overview" as Page, label: "Overview", Icon: ChartLineUpIcon },
  { id: "settings" as Page, label: "Settings", Icon: SlidersIcon },
  { id: "history" as Page, label: "History", Icon: ListDashesIcon },
];

export default function App() {
  const [page, setPage] = useState<Page>("overview");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r-2 border-sand bg-paper max-md:hidden">
        <div className="flex items-center gap-3 px-6 py-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-water-soft text-2xl text-teal">
            <DropFillIcon />
          </span>
          <div>
            <div className="font-display text-2xl font-bold leading-none">Drip</div>
            <div className="mt-1 text-xs text-ink-soft">stack sats on a slow drip</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1.5 px-4">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${
                page === id
                  ? "bg-ink text-cream"
                  : "text-ink-soft hover:bg-sand-soft hover:text-ink"
              }`}
            >
              <Icon className="text-lg" />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-6 py-5 text-xs text-ink-soft">
          quietly running on your Raspberry Pi
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b-2 border-sand bg-paper px-4 py-3 md:hidden">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-water-soft text-xl text-teal">
          <DropFillIcon />
        </span>
        <span className="mr-2 font-display text-lg font-bold">Drip</span>
        {NAV.map(({ id, Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            aria-label={id}
            className={`rounded-xl px-3 py-2 text-lg ${
              page === id ? "bg-ink text-cream" : "text-ink-soft"
            }`}
          >
            <Icon />
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-md:pt-20 md:ml-60 lg:p-10">
        {page === "overview" && <Dashboard />}
        {page === "settings" && <Settings />}
        {page === "history" && <History />}
      </main>
    </div>
  );
}
