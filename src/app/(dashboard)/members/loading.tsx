export default function MembersLoading() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse rounded-lg bg-slate-200 h-7 w-24" />
      <div className="flex gap-2">
        <div className="animate-pulse rounded-lg bg-slate-200 h-9 w-32" />
        <div className="animate-pulse rounded-lg bg-slate-200 h-9 w-24" />
      </div>
      <div className="animate-pulse rounded-lg bg-slate-200 h-64 w-full" />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
