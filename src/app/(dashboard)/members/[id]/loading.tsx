export default function MemberDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse rounded-lg bg-slate-200 h-6 w-20" />
      <div className="animate-pulse rounded-lg bg-slate-200 h-8 w-48" />
      <div className="animate-pulse rounded-lg bg-slate-200 h-32 w-full" />
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
