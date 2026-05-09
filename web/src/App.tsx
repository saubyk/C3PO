import { useQuery } from "@tanstack/react-query";

type HealthOk = { status: "ok"; login: string };
type HealthErr = { status: "error"; message: string };
type Health = HealthOk | HealthErr;

async function fetchHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  const body = (await res.json().catch(() => null)) as Health | null;
  if (body && (body.status === "ok" || body.status === "error")) return body;
  return {
    status: "error",
    message: `Unexpected response from /api/health (HTTP ${res.status}).`,
  };
}

export default function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <main className="min-h-screen bg-white text-gray-900 text-sm">
      <header className="border-b border-gray-200 px-4 py-2">
        <h1 className="font-semibold">C3PO</h1>
      </header>
      <section className="px-4 py-3">
        {isLoading && <p className="text-gray-500">Checking GitHub…</p>}
        {error && (
          <p className="text-red-600">
            Could not reach the server: {(error as Error).message}
          </p>
        )}
        {data?.status === "ok" && (
          <p>
            Connected as{" "}
            <span className="font-mono">@{data.login}</span>.
          </p>
        )}
        {data?.status === "error" && (
          <p className="text-red-600">{data.message}</p>
        )}
      </section>
    </main>
  );
}
