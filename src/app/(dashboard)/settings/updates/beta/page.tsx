import { getBetaReleaseNotes } from "@/lib/releaseNotes";

export const dynamic = "force-dynamic";

export default async function SettingsUpdatesBetaPage() {
  const releaseNotes = await getBetaReleaseNotes();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-primary-700 uppercase">アップデート / ベータ版</p>
        <h1 className="text-2xl font-bold text-slate-900">ベータ版アップデート一覧</h1>
        <p className="text-sm text-slate-600">
          技術詳細より「何が便利になったか」を中心に整理しています。
        </p>
      </header>

      <div className="space-y-4">
        {releaseNotes.map((note) => (
          <section key={note.version} className="rounded-lg border border-slate-200 bg-white p-4 md:p-5 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">v{note.version}</h2>
            {note.pushDate && (
              <p className="text-xs text-slate-500">公開日: {note.pushDate}</p>
            )}
            {note.purpose && (
              <p className="inline-flex items-center rounded-md bg-orange-50 px-2.5 py-1.5 text-sm text-orange-800">
                ねらい: {note.purpose}
              </p>
            )}
            <ul className="space-y-2 pl-5 list-disc text-sm text-slate-700">
              {note.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
