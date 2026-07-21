import { useCallback, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useHealth } from "./api";
import { C3POIcon } from "./components/C3POIcon";
import { useTheme } from "./theme";

// Shared state available to every route via useOutletContext.
// `boardSelectedLogin` is owned by the Sprint Board route; the Workload route
// reads it (once, on mount) to seed its own picker — see FR-W4 / FR-W10.
// `setStatusMeta` lets each route feed the status footer (sector + count).
export type StatusMeta = {
  sector: string | null;
  lifeforms: number | null;
};

export type AppOutletContext = {
  boardSelectedLogin: string | null;
  setBoardSelectedLogin: (login: string | null) => void;
  setStatusMeta: (meta: StatusMeta) => void;
};

export default function App() {
  const { data } = useHealth();
  const [theme, toggleTheme] = useTheme();
  const login = data?.status === "ok" ? data.login : null;
  const [boardSelectedLogin, setBoardSelectedLogin] = useState<string | null>(
    null,
  );
  const [statusMeta, setStatusMetaState] = useState<StatusMeta>({
    sector: null,
    lifeforms: null,
  });
  const setStatusMeta = useCallback(
    (meta: StatusMeta) => setStatusMetaState(meta),
    [],
  );

  const ctx: AppOutletContext = {
    boardSelectedLogin,
    setBoardSelectedLogin,
    setStatusMeta,
  };

  return (
    <main className="h-screen flex flex-col bg-bg text-fg">
      <nav className="flex items-center gap-5 px-4 h-12 bg-chrome border-b border-gold/20 shrink-0">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="w-[26px] h-[26px] rounded-[5px] border border-gold shadow-[inset_0_0_10px_rgba(240,192,90,.25)] flex items-center justify-center shrink-0"
          >
            <C3POIcon size={18} />
          </span>
          <span className="flex flex-col leading-none gap-0.5">
            <span className="font-display font-bold text-[14px] tracking-[.14em] text-gold">
              C-3PO
            </span>
            <span className="font-mono text-[8.5px] tracking-[.18em] text-faint">
              PROTOCOL BOARD
            </span>
          </span>
        </span>
        <TabLink to="/">Sprint Board</TabLink>
        <TabLink to="/workload">Workload</TabLink>
        <span className="ml-auto flex items-center gap-4">
          {login && (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="uplink-dot h-[7px] w-[7px] rounded-full bg-green shadow-[0_0_8px_#55d187]"
              />
              <span className="font-mono text-[10.5px] text-muted">
                UPLINK STABLE · @{login}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            className="inline-flex items-center gap-1.5 border border-line2 rounded px-2 py-[3px] font-mono text-[10px] tracking-[.1em] text-muted hover:text-fg hover:border-accent/60 transition-colors"
          >
            <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
            {theme === "dark" ? "DARK" : "LIGHT"}
          </button>
        </span>
      </nav>
      <Outlet context={ctx} />
      <footer className="h-[26px] px-4 bg-chrome border-t border-line flex items-center justify-between font-mono text-[9.5px] tracking-[.08em] text-faint uppercase shrink-0 select-none">
        <span>C-3PO PROTOCOL BOARD // FLUENT IN OVER SIX MILLION FORMS OF ISSUE</span>
        <span>
          SECTOR: {statusMeta.sector ?? "—"} ·{" "}
          {statusMeta.lifeforms ?? 0} LIFEFORMS ON SCANNER
        </span>
      </footer>
      <div
        aria-hidden="true"
        className="crt-scanlines fixed inset-0 z-50 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="scan-sweep fixed inset-x-0 z-50 pointer-events-none"
      />
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
          "font-display font-semibold text-[12px] tracking-[.1em] uppercase",
          isActive
            ? "border-gold text-fg"
            : "border-transparent text-faint hover:text-fg",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
