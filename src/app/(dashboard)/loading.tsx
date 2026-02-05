export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-pulse rounded-lg bg-slate-200 h-8 w-48" aria-hidden />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
