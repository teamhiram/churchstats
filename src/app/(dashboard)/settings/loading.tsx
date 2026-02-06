export default function SettingsLoading() {
  return (
    <div className="space-y-8">
      <div className="animate-pulse rounded-lg bg-slate-200 h-7 w-28" />
      <div className="space-y-4">
        <div className="animate-pulse rounded-lg bg-slate-200 h-5 w-32" />
        <div className="animate-pulse rounded-lg bg-slate-200 h-24 w-full" />
      </div>
      <span className="sr-only">読み込み中…</span>
    </div>
  );
}
