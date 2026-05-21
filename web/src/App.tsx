import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useHealth } from "./api";
import { C3POIcon } from "./components/C3POIcon";

// Shared state available to every route via useOutletContext.
// `boardSelectedLogin` is owned by the Sprint Board route; the Workload route
// reads it (once, on mount) to seed its own picker — see FR-W4 / FR-W10.
export type AppOutletContext = {
  boardSelectedLogin: string | null;
  setBoardSelectedLogin: (login: string | null) => void;
};

export default function App() {
  const { data } = useHealth();
  const login = data?.status === "ok" ? data.login : null;
  const [boardSelectedLogin, setBoardSelectedLogin] = useState<string | null>(
    null,
  );

  const ctx: AppOutletContext = { boardSelectedLogin, setBoardSelectedLogin };

  return (
    <main className="h-screen flex flex-col bg-bg text-fg">
      <nav className="flex items-center gap-4 border-b border-line px-4 h-9 bg-panel hud-scanlines shrink-0 text-sm">
        <span className="flex items-center gap-1.5">
          <C3POIcon
            size={18}
            className="drop-shadow-[0_0_4px_rgba(56,189,248,0.55)]"
          />
          <span className="font-semibold text-gold tracking-widest [text-shadow:0_0_8px_rgba(56,189,248,0.35)]">
            C3PO
          </span>
        </span>
        <span className="text-line2 select-none" aria-hidden="true">|</span>
        <TabLink to="/">Sprint Board</TabLink>
        <TabLink to="/workload">Workload</TabLink>
        {login && (
          <span className="ml-auto flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
            />
            <span className="uppercase tracking-widest text-accent text-[10px]">
              Online
            </span>
            <span className="font-mono text-muted">@{login}</span>
          </span>
        )}
      </nav>
      <Outlet context={ctx} />
    </main>
  );
}

function TabLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "h-full inline-flex items-center px-1 border-b-2 -mb-px transition-colors",
          isActive
            ? "border-accent text-fg"
            : "border-transparent text-muted hover:text-fg",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
