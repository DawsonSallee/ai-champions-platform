export function DbDownBanner({ message }: { message: string }) {
  return (
    <div className="card mb-6 border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <div className="text-amber-600">⚠</div>
        <div>
          <div className="font-semibold text-amber-900">
            Database not reachable — showing empty state
          </div>
          <div className="mt-1 text-sm text-amber-800">
            Start Postgres locally with{" "}
            <code className="rounded bg-white px-1 py-0.5">docker compose up -d</code>{" "}
            then run{" "}
            <code className="rounded bg-white px-1 py-0.5">npm run db:migrate</code>{" "}
            and{" "}
            <code className="rounded bg-white px-1 py-0.5">npm run db:seed</code>.
          </div>
          <details className="mt-2 text-xs text-amber-700">
            <summary className="cursor-pointer">Error</summary>
            <pre className="mt-1 whitespace-pre-wrap">{message}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
