import Link from "next/link";

export function UpdateSection() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 md:p-5 space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">アップデート</h2>
      <p className="text-sm text-slate-600">
        ベータ版ページで、バージョンごとの更新内容を「何が便利になったか」中心で確認できます。
      </p>
      <Link
        href="/settings/updates/beta"
        className="inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        ベータ版を見る
      </Link>
    </section>
  );
}
