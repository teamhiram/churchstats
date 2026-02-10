import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";
import { AccountSignOut } from "./AccountSignOut";

export default async function AccountPage() {
  const data = await getCurrentUserWithProfile();
  if (!data.user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">アカウント詳細</h1>
      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="text-sm text-slate-600 space-y-1">
          <p>
            <span className="font-medium text-slate-500">氏名</span>
            <span className="ml-2 text-slate-800">{data.displayName && data.displayName !== "" ? data.displayName : "—"}</span>
          </p>
          <p>
            <span className="font-medium text-slate-500">ロール</span>
            <span className="ml-2 text-slate-800">{data.roleLabel ?? "—"}</span>
          </p>
          <p>
            <span className="font-medium text-slate-500">所属地方</span>
            <span className="ml-2 text-slate-800">{data.localityName && data.localityName !== "" ? data.localityName : "—"}</span>
          </p>
        </div>
        <AccountSignOut />
      </section>
    </div>
  );
}
