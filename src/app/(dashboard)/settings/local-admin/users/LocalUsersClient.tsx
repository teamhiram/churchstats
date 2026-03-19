"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getLocalUsersData, inviteLocalUser, removeLocalUser, setLocalUserRole } from "./actions";
import type { GlobalRole, LocalRole, Role } from "@/types/database";
import { LOCAL_ROLE_LABELS } from "@/types/database";

type UiUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
  global_role: GlobalRole | null;
  localRole: LocalRole | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; localityName: string | null; localityId: string; users: UiUser[] };

const ROLE_OPTIONS: { value: LocalRole; label: string }[] = [
  { value: "local_admin", label: LOCAL_ROLE_LABELS.local_admin },
  { value: "local_reporter", label: LOCAL_ROLE_LABELS.local_reporter },
  { value: "local_viewer", label: LOCAL_ROLE_LABELS.local_viewer },
];

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 7V5a2 2 0 012-2h0a2 2 0 012 2v2m-7 3v9a2 2 0 002 2h2a2 2 0 002-2v-9M9 10v8m6-8v8" />
    </svg>
  );
}

export function LocalUsersClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pending, startTransition] = useTransition();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<LocalRole>("local_viewer");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getLocalUsersData().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "error", error: res.error });
        return;
      }
      setState({
        status: "ready",
        localityId: res.data.localityId,
        localityName: res.data.localityName,
        users: res.data.users,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const users = state.status === "ready" ? state.users : [];

  const getEffectiveLocalRole = (u: UiUser): LocalRole | null => {
    // システム管理者は全地方でローカル管理者権限を内包する
    if (u.global_role === "admin") return "local_admin";
    return u.localRole;
  };

  const usersByRole = useMemo(() => {
    const map = new Map<string, UiUser[]>();
    for (const u of users) {
      const key = getEffectiveLocalRole(u) ?? "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return map;
  }, [users]);

  const refetch = () => {
    setState({ status: "loading" });
    getLocalUsersData().then((res) => {
      if (!res.ok) {
        setState({ status: "error", error: res.error });
        return;
      }
      setState({
        status: "ready",
        localityId: res.data.localityId,
        localityName: res.data.localityName,
        users: res.data.users,
      });
    });
  };

  if (state.status === "loading") return <p className="text-sm text-slate-500">読み込み中…</p>;
  if (state.status === "error") return <p className="text-sm text-red-600">{state.error}</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">対象地方</h2>
        <p className="mt-1 text-sm text-slate-600">
          {state.localityName ?? "—"}{" "}
          <span className="text-xs text-slate-400 break-all">({state.localityId})</span>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          このページは「対象地方」の管理者のみ利用できます。地方切替は画面上部の地方選択で行えます。
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">メールで招待</h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="example@example.com"
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            aria-label="招待メールアドレス"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as LocalRole)}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            aria-label="付与するローカル権限"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || inviteEmail.trim() === ""}
            onClick={() => {
              setFlash(null);
              startTransition(async () => {
                const res = await inviteLocalUser(inviteEmail, inviteRole);
                if (!res.ok) {
                  setFlash({ kind: "error", message: res.error });
                  return;
                }
                setFlash({ kind: "ok", message: res.message });
                setInviteEmail("");
                refetch();
              });
            }}
            className="h-10 rounded-md bg-primary-600 text-white text-sm font-medium px-4 disabled:opacity-50"
          >
            {pending ? "送信中…" : "招待"}
          </button>
        </div>
        {flash && (
          <p className={`text-sm ${flash.kind === "ok" ? "text-emerald-700" : "text-red-600"}`} role="alert">
            {flash.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">ユーザー一覧</h2>
            <p className="text-xs text-slate-500 mt-1">
              対象地方にアクセス可能なユーザーが表示されます（{users.length}件）。
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            再読み込み
          </button>
        </div>

        {/* PC: table / Mobile: cards */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">メール</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">氏名</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">ローカル権限</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase w-12">削除</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 text-sm text-slate-800 break-all">{u.email ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-slate-800">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-2 text-sm text-slate-800">
                    <select
                      value={getEffectiveLocalRole(u) ?? ""}
                      disabled={pending || u.global_role === "admin"}
                      onChange={(e) => {
                        const v = e.target.value as LocalRole | "";
                        startTransition(async () => {
                          setFlash(null);
                          const res = await setLocalUserRole(u.id, v === "" ? null : v);
                          if (!res.ok) {
                            setFlash({ kind: "error", message: res.error });
                            return;
                          }
                          setFlash({ kind: "ok", message: "ローカル権限を更新しました。" });
                          refetch();
                        });
                      }}
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                      aria-label="ローカル権限を変更"
                    >
                      <option value="">（なし）</option>
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {u.global_role === "admin" && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        システム管理者
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending || u.global_role === "admin"}
                      onClick={() => {
                        setFlash(null);
                        const label = u.email ?? u.full_name ?? u.id;
                        if (!window.confirm(`この地方からユーザーを削除します。\n\n対象: ${label}\n\nよろしいですか？`)) return;
                        startTransition(async () => {
                          const res = await removeLocalUser(u.id);
                          if (!res.ok) {
                            setFlash({ kind: "error", message: res.error });
                            return;
                          }
                          setFlash({ kind: "ok", message: "ユーザーを削除しました（この地方から除外）。" });
                          refetch();
                        });
                      }}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-red-600 hover:border-red-300 disabled:opacity-50"
                      aria-label="ユーザーを削除"
                      title="ユーザーを削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {users.map((u) => (
            <div key={u.id} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-slate-800 break-all">{u.email ?? "—"}</p>
                <p className="text-xs text-slate-500">{u.full_name ?? "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 shrink-0">権限</span>
                <select
                  value={getEffectiveLocalRole(u) ?? ""}
                  disabled={pending || u.global_role === "admin"}
                  onChange={(e) => {
                    const v = e.target.value as LocalRole | "";
                    startTransition(async () => {
                      setFlash(null);
                      const res = await setLocalUserRole(u.id, v === "" ? null : v);
                      if (!res.ok) {
                        setFlash({ kind: "error", message: res.error });
                        return;
                      }
                      setFlash({ kind: "ok", message: "ローカル権限を更新しました。" });
                      refetch();
                    });
                  }}
                  className="flex-1 h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
                  aria-label="ローカル権限を変更"
                >
                  <option value="">（なし）</option>
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending || u.global_role === "admin"}
                  onClick={() => {
                    setFlash(null);
                    const label = u.email ?? u.full_name ?? u.id;
                    if (!window.confirm(`この地方からユーザーを削除します。\n\n対象: ${label}\n\nよろしいですか？`)) return;
                    startTransition(async () => {
                      const res = await removeLocalUser(u.id);
                      if (!res.ok) {
                        setFlash({ kind: "error", message: res.error });
                        return;
                      }
                      setFlash({ kind: "ok", message: "ユーザーを削除しました（この地方から除外）。" });
                      refetch();
                    });
                  }}
                  className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-300 text-slate-500 active:bg-slate-50 active:text-red-600 active:border-red-300 disabled:opacity-50"
                  aria-label="ユーザーを削除"
                  title="ユーザーを削除"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              {u.global_role === "admin" && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                  システム管理者（全地方で管理者権限）
                </p>
              )}
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-500">ユーザーがいません。</p>}
        </div>

        {/* ざっくり内訳 */}
        <div className="text-xs text-slate-500">
          内訳:{" "}
          {[
            { key: "local_admin", label: LOCAL_ROLE_LABELS.local_admin },
            { key: "local_reporter", label: LOCAL_ROLE_LABELS.local_reporter },
            { key: "local_viewer", label: LOCAL_ROLE_LABELS.local_viewer },
            { key: "__none__", label: "（なし）" },
          ]
            .map((x) => `${x.label} ${usersByRole.get(x.key)?.length ?? 0}`)
            .join(" / ")}
        </div>
      </section>
    </div>
  );
}

