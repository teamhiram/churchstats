export default function DashboardPageLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-lg bg-slate-200 h-7 w-32" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5">
            <div className="animate-pulse rounded bg-slate-200 h-3 w-12 mb-2" />
            <div className="animate-pulse rounded bg-slate-200 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-lg bg-slate-200 h-64 w-full" />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
