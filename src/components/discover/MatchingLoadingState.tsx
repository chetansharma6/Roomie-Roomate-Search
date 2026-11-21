export function MatchingLoadingState() {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-indigo-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        <p className="font-medium text-indigo-900">Gemini is analyzing roommate compatibility…</p>
      </div>
      <p className="mt-1 text-sm text-slate-500">Hard housing filters are applied first; this usually takes a few seconds.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
