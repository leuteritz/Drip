import { useState } from "react";
import TabTransition from "./components/TabTransition";
import { NAV, type Page } from "./components/TabHeader";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

const order = (p: Page) => NAV.findIndex((n) => n.id === p);

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [direction, setDirection] = useState(0);

  const navigate = (next: Page) => {
    if (next === page) return;
    setDirection(order(next) - order(page));
    setPage(next);
  };

  return (
    <div className="flex h-full justify-center bg-cream p-3 md:p-5">
      {/* The fixed app canvas: nothing outside it ever scrolls */}
      <div className="flex h-full w-full max-w-[1080px] flex-col overflow-hidden rounded-[22px] border-2 border-sand bg-cream shadow-puff">
        <TabTransition tabKey={page} direction={direction}>
          {page === "overview" && <Dashboard active={page} onNavigate={navigate} />}
          {page === "settings" && <Settings active={page} onNavigate={navigate} />}
          {page === "history" && <History active={page} onNavigate={navigate} />}
        </TabTransition>
      </div>
    </div>
  );
}
