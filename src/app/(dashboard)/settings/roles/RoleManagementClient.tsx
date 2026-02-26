"use client";

import { useState } from "react";
import {
  GLOBAL_ROLE_LABELS,
  LOCAL_ROLE_LABELS,
  type GlobalRole,
  type LocalRole,
} from "@/types/database";
import {
  inviteUser,
  updateUserGlobalRole,
  setUserAreas,
  setUserLocalities,
  setUserLocalRoles,
} from "./actions";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  global_role: string | null;
};

type Area = { id: string; name: string };
type Locality = { id: string; name: string };

type Props = {
  profiles: ProfileRow[];
  areas: Area[];
  localities: Locality[];
  userLocalities: { user_id: string; locality_id: string }[];
  userAreas: { user_id: string; area_id: string }[];
  localRoles: { user_id: string; locality_id: string; role: string }[];
};

export function RoleManagementClient({
  profiles,
  areas,
  localities,
  userLocalities,
  userAreas,
  localRoles,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const selected = selectedId ? profiles.find((p) => p.id === selectedId) : null;
  const selectedUserLocalityIds = selectedId ? userLocalities.filter((ul) => ul.user_id === selectedId).map((ul) => ul.locality_id) : [];
  const selectedUserAreaIds = selectedId ? userAreas.filter((ua) => ua.user_id === selectedId).map((ua) => ua.area_id) : [];
  const selectedLocalRoles = selectedId
    ? localRoles.filter((lr) => lr.user_id === selectedId)
    : [];

  const handleInvite = async () => {
    setInviteBusy(true);
    setInviteMessage(null);
    const result = await inviteUser(inviteEmail.trim());
    setInviteBusy(false);
    if (result.ok) {
      setInviteMessage({ type: "ok", text: result.message });
      setInviteEmail("");
    } else {
      setInviteMessage({ type: "error", text: result.error });
    }
  };

  const handleSaveGlobalRole = async (userId: string, value: GlobalRole | null) => {
    setSaveBusy(true);
    setSaveMessage(null);
    const result = await updateUserGlobalRole(userId, value);
    setSaveBusy(false);
    if (result.ok) setSaveMessage({ type: "ok", text: "保存しました。" });
    else setSaveMessage({ type: "error", text: result.error });
  };

  const handleSaveAreas = async (userId: string, areaIds: string[]) => {
    setSaveBusy(true);
    setSaveMessage(null);
    const result = await setUserAreas(userId, areaIds);
    setSaveBusy(false);
    if (result.ok) setSaveMessage({ type: "ok", text: "地域を保存しました。" });
    else setSaveMessage({ type: "error", text: result.error });
  };

  const handleSaveLocalities = async (userId: string, localityIds: string[]) => {
    setSaveBusy(true);
    setSaveMessage(null);
    const result = await setUserLocalities(userId, localityIds);
    setSaveBusy(false);
    if (result.ok) setSaveMessage({ type: "ok", text: "アクセス可能な地方を保存しました。" });
    else setSaveMessage({ type: "error", text: result.error });
  };

  const handleSaveLocalRoles = async (
    userId: string,
    entries: { localityId: string; role: LocalRole }[]
  ) => {
    setSaveBusy(true);
    setSaveMessage(null);
    const result = await setUserLocalRoles(userId, entries);
    setSaveBusy(false);
    if (result.ok) setSaveMessage({ type: "ok", text: "ローカル権限を保存しました。" });
    else setSaveMessage({ type: "error", text: result.error });
  };

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
      <section>
        <h2 className="font-medium text-slate-800 mb-2">ユーザー一覧</h2>
        <ul className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white max-h-[60vh] overflow-y-auto">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                  selectedId === p.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
                }`}
              >
                <span className="block truncate">{p.full_name || p.email || p.id.slice(0, 8)}</span>
                <span className="text-xs text-slate-500">
                  {p.global_role ? GLOBAL_ROLE_LABELS[p.global_role as GlobalRole] : "ローカルのみ"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 border border-slate-200 rounded-lg bg-slate-50 p-4">
          <h3 className="font-medium text-slate-800 text-sm mb-2">招待（新規ユーザー）</h3>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="メールアドレス"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteBusy || !inviteEmail.trim()}
              className="rounded bg-slate-800 text-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {inviteBusy ? "送信中…" : "招待"}
            </button>
          </div>
          {inviteMessage && (
            <p className={`mt-2 text-sm ${inviteMessage.type === "error" ? "text-red-600" : "text-slate-600"}`}>
              {inviteMessage.text}
            </p>
          )}
        </div>
      </section>

      <section className="min-w-0">
        {saveMessage && (
          <p className={`mb-4 text-sm ${saveMessage.type === "error" ? "text-red-600" : "text-green-700"}`}>
            {saveMessage.text}
          </p>
        )}
        {!selected ? (
          <p className="text-slate-500 text-sm">左の一覧からユーザーを選択すると、グローバル権限・地域・地方・ローカル権限を編集できます。</p>
        ) : (
          <UserRoleForm
            key={selected.id}
            profile={selected}
            areas={areas}
            localities={localities}
            initialUserLocalityIds={selectedUserLocalityIds}
            initialUserAreaIds={selectedUserAreaIds}
            initialLocalRoles={selectedLocalRoles}
            disabled={saveBusy}
            onSaveGlobalRole={handleSaveGlobalRole}
            onSaveAreas={handleSaveAreas}
            onSaveLocalities={handleSaveLocalities}
            onSaveLocalRoles={handleSaveLocalRoles}
          />
        )}
      </section>
    </div>
  );
}

type UserRoleFormProps = {
  profile: ProfileRow;
  areas: Area[];
  localities: Locality[];
  initialUserLocalityIds: string[];
  initialUserAreaIds: string[];
  initialLocalRoles: { locality_id: string; role: string }[];
  disabled: boolean;
  onSaveGlobalRole: (userId: string, value: GlobalRole | null) => Promise<void>;
  onSaveAreas: (userId: string, areaIds: string[]) => Promise<void>;
  onSaveLocalities: (userId: string, localityIds: string[]) => Promise<void>;
  onSaveLocalRoles: (userId: string, entries: { localityId: string; role: LocalRole }[]) => Promise<void>;
};

function UserRoleForm({
  profile,
  areas,
  localities,
  initialUserLocalityIds,
  initialUserAreaIds,
  initialLocalRoles,
  disabled,
  onSaveGlobalRole,
  onSaveAreas,
  onSaveLocalities,
  onSaveLocalRoles,
}: UserRoleFormProps) {
  const [globalRole, setGlobalRole] = useState<GlobalRole | null>((profile.global_role as GlobalRole) ?? null);
  const [areaIds, setAreaIds] = useState<string[]>(initialUserAreaIds);
  const [localityIds, setLocalityIds] = useState<string[]>(initialUserLocalityIds);
  const [localRoleByLocality, setLocalRoleByLocality] = useState<Record<string, LocalRole>>(
    Object.fromEntries(initialLocalRoles.map((lr) => [lr.locality_id, lr.role as LocalRole]))
  );

  const toggleArea = (id: string) => {
    setAreaIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const toggleLocality = (id: string) => {
    setLocalityIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 border border-slate-200 rounded-lg bg-white p-6">
      <h2 className="font-medium text-slate-800">
        {profile.full_name || profile.email || profile.id.slice(0, 8)}
      </h2>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">グローバル権限</label>
        <div className="flex flex-wrap gap-2">
          {(["admin", "national_viewer", "regional_viewer"] as const).map((role) => (
            <label key={role} className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="globalRole"
                checked={globalRole === role}
                onChange={() => setGlobalRole(role)}
                disabled={disabled}
                className="rounded border-slate-300"
              />
              <span className="text-sm">{GLOBAL_ROLE_LABELS[role]}</span>
            </label>
          ))}
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name="globalRole"
              checked={globalRole === null}
              onChange={() => setGlobalRole(null)}
              disabled={disabled}
              className="rounded border-slate-300"
            />
            <span className="text-sm">なし（ローカルのみ）</span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => onSaveGlobalRole(profile.id, globalRole)}
          disabled={disabled}
          className="mt-2 rounded bg-slate-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          保存
        </button>
      </div>

      {globalRole === "regional_viewer" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">閲覧可能な地域（user_areas）</label>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <label key={a.id} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={areaIds.includes(a.id)}
                  onChange={() => toggleArea(a.id)}
                  disabled={disabled}
                  className="rounded border-slate-300"
                />
                <span className="text-sm">{a.name}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSaveAreas(profile.id, areaIds)}
            disabled={disabled}
            className="mt-2 rounded bg-slate-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            地域を保存
          </button>
        </div>
      )}

      {globalRole === null && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">アクセス可能な地方（user_localities）</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {localities.map((l) => (
                <label key={l.id} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={localityIds.includes(l.id)}
                    onChange={() => toggleLocality(l.id)}
                    disabled={disabled}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm">{l.name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onSaveLocalities(profile.id, localityIds)}
              disabled={disabled}
              className="mt-2 rounded bg-slate-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              地方を保存
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">地方ごとのローカル権限（local_roles）</label>
            <p className="text-xs text-slate-500 mb-2">
              アクセス可能な地方ごとに役割を設定します。ここに地方を追加しただけではアクセスできません。上で「アクセス可能な地方」にも追加してください。
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {localityIds.length === 0 ? (
                <p className="text-sm text-slate-500">先に「アクセス可能な地方」を保存してください。</p>
              ) : (
                localityIds.map((lid) => {
                  const loc = localities.find((l) => l.id === lid);
                  return (
                    <div key={lid} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-700 w-24 truncate">{loc?.name ?? lid.slice(0, 8)}</span>
                      {(["local_admin", "local_reporter", "local_viewer"] as const).map((r) => (
                        <label key={r} className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`local-${lid}`}
                            checked={(localRoleByLocality[lid] ?? null) === r}
                            onChange={() =>
                              setLocalRoleByLocality((prev) => ({ ...prev, [lid]: r }))
                            }
                            disabled={disabled}
                            className="rounded border-slate-300"
                          />
                          <span className="text-sm">{LOCAL_ROLE_LABELS[r]}</span>
                        </label>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                onSaveLocalRoles(
                  profile.id,
                  localityIds.map((lid) => ({ localityId: lid, role: localRoleByLocality[lid] ?? "local_viewer" }))
                )
              }
              disabled={disabled || localityIds.length === 0}
              className="mt-2 rounded bg-slate-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              ローカル権限を保存
            </button>
          </div>
        </>
      )}

      {(globalRole === "admin" || globalRole === "national_viewer") && (
        <p className="text-sm text-slate-500">
          グローバル権限があるため、地域・地方の個別設定は不要です。全地方にアクセスできます。
        </p>
      )}
    </div>
  );
}
