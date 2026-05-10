import { NavLink, Outlet } from "react-router-dom";
import { useHealth } from "./api";

export default function App() {
  const { data } = useHealth();
  const login = data?.status === "ok" ? data.login : null;

  return (
    <main className="h-screen flex flex-col bg-white text-gray-900">
      <nav className="flex items-center gap-4 border-b border-gray-200 px-4 h-9 bg-gray-50 shrink-0 text-sm">
        <span className="font-semibold text-gray-900">C3PO</span>
        <span className="text-gray-300">·</span>
        <TabLink to="/">Sprint Board</TabLink>
        <TabLink to="/workload">Workload</TabLink>
        {login && (
          <span className="ml-auto font-mono text-xs text-gray-500">
            @{login}
          </span>
        )}
      </nav>
      <Outlet />
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
            ? "border-blue-500 text-gray-900"
            : "border-transparent text-gray-500 hover:text-gray-900",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
