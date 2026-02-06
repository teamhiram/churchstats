export default function MeetingsLoading() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-lg bg-slate-200 h-6 w-32" />
      <div className="animate-pulse rounded-lg bg-slate-200 h-24 w-full" />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
