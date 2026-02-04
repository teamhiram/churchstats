import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
      <h1 className="text-xl font-bold text-slate-800 mb-2">ページが見つかりません</h1>
      <p className="text-slate-600 text-sm mb-4">404 | This page could not be found.</p>
      <Link
        href="/login"
        className="px-4 py-2 bg-slate-600 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
      >
        ログインへ
      </Link>
    </div>
  );
}
