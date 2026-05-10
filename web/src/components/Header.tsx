import { RefreshCw } from "lucide-react";
import { ACTIVE_PROJECT, useHealth } from "../api";

export function Header() {
  const { data } = useHealth();
  const login = data?.status === "ok" ? data.login : null;

  return (
    <header className="flex items-center gap-3 border-b border-gray-200 px-4 h-10 bg-white shrink-0">
      <h1 className="font-semibold text-gray-900">C3PO</h1>
      <span className="text-gray-300">·</span>
      <span className="text-sm text-gray-700">
        <span className="text-gray-500">{ACTIVE_PROJECT.owner}</span>
        <span className="text-gray-400 mx-1">/</span>
        <span className="font-medium">#{ACTIVE_PROJECT.number}</span>
      </span>
      <span className="ml-auto flex items-center gap-3 text-xs text-gray-500">
        <button
          disabled
          aria-label="Refresh (coming in M6)"
          className="inline-flex items-center gap-1 cursor-not-allowed opacity-50"
        >
          <RefreshCw size={12} /> Refresh
        </button>
        <span>Last updated —</span>
        {login && <span className="font-mono">@{login}</span>}
      </span>
    </header>
  );
}
