import type { ReactNode } from "react";

/**
 * Re-mounts its child whenever `tabKey` changes so the incoming page replays a
 * directional slide+fade (direction < 0 = moving left, otherwise right). The
 * outer clip keeps the slide offset from ever spilling into a scrollbar.
 */
export default function TabTransition({
  tabKey,
  direction,
  children,
}: {
  tabKey: string;
  direction: number;
  children: ReactNode;
}) {
  const anim = direction < 0 ? "animate-tab-in-left" : "animate-tab-in-right";
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div key={tabKey} className={`flex min-h-0 flex-1 flex-col ${anim}`}>
        {children}
      </div>
    </div>
  );
}
