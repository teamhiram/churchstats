export default function MeetingDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-lg bg-slate-200 h-5 w-20" />
      <div className="space-y-2">
        <div className="animate-pulse rounded-lg bg-slate-200 h-7 w-56" />
        <div className="animate-pulse rounded-lg bg-slate-200 h-4 w-40" />
      </div>
      <div className="animate-pulse rounded-lg bg-slate-200 h-48 w-full" />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
