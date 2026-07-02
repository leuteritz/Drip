import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

type Page = "dashboard" | "settings" | "history";

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "settings", label: "Konfiguration", icon: "⚙️" },
  { id: "history", label: "Historie", icon: "📜" },
];

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-line bg-surface max-md:hidden">
        <div className="flex items-center gap-2 px-5 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-btc text-xl font-bold text-black">
            ₿
          </span>
          <div>
            <div className="text-sm font-bold leading-tight">Smart-DCA</div>
            <div className="text-xs text-slate-500">Bitcoin Bot</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                page === item.id
                  ? "bg-btc/15 text-btc"
                  : "text-slate-400 hover:bg-surface-2 hover:text-slate-200"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-slate-600">
          läuft auf deinem Raspberry Pi 🍓
        </div>
      </aside>

      {/* Mobile Top-Nav */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-line bg-surface px-4 py-3 md:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-btc font-bold text-black">
          ₿
        </span>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              page === item.id ? "bg-btc/15 text-btc" : "text-slate-400"
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 p-6 max-md:pt-20 md:ml-56 lg:p-8">
        {page === "dashboard" && <Dashboard />}
        {page === "settings" && <Settings />}
        {page === "history" && <History />}
      </main>
    </div>
  );
}
