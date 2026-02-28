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
  createUserDirect,
  updateUserGlobalRole,
  updateProfileLocalityId,
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
  locality_id: string | null;
  main_locality_name: string | null;
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
  const [createMode, setCreateMode] = useState<"invite" | "direct">("invite");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDefaultLocalityId, setInviteDefaultLocalityId] = useState<string>("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directFullName, setDirectFullName] = useState("");
  const [directDefaultLocalityId, setDirectDefaultLocalityId] = useState<string>("");
  const [directBusy, setDirectBusy] = useState(false);
  const [directMessage, setDirectMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
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
    const result = await inviteUser(inviteEmail.trim(), {
      defaultLocalityId: inviteDefaultLocalityId || undefined,
    });
    setInviteBusy(false);
    if (result.ok) {
      setInviteMessage({ type: "ok", text: result.message });
      setInviteEmail("");
      setInviteDefaultLocalityId("");
    } else {
      setInviteMessage({ type: "error", text: result.error });
    }
  };

  const handleCreateDirect = async () => {
    setDirectBusy(true);
    setDirectMessage(null);
    const result = await createUserDirect(
      directEmail.trim(),
      directPassword,
      directFullName.trim() || undefined,
      { defaultLocalityId: directDefaultLocalityId || undefined }
    );
    setDirectBusy(false);
    if (result.ok) {
      setDirectMessage({ type: "ok", text: result.message });
      setDirectEmail("");
      setDirectPassword("");
      setDirectFullName("");
      setDirectDefaultLocalityId("");
    } else {
      setDirectMessage({ type: "error", text: result.error });
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

  const handleSaveDefaultLocality = async (userId: string, localityId: string | null) => {
    setSaveBusy(true);
    setSaveMessage(null);
    const result = await updateProfileLocalityId(userId, localityId);
    setSaveBusy(false);
    if (result.ok) setSaveMessage({ type: "ok", text: "デフォルト表示地方を保存しました。" });
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
                {p.full_name && p.email && (
                  <span className="block truncate text-xs text-slate-500">{p.email}</span>
                )}
                {p.main_locality_name && (
                  <span className="block truncate text-xs text-slate-500">所属: {p.main_locality_name}</span>
                )}
                <span className="text-xs text-slate-500">
                  {p.global_role ? GLOBAL_ROLE_LABELS[p.global_role as GlobalRole] : "ローカルのみ"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 border border-slate-200 rounded-lg bg-slate-50 p-4">
          <h3 className="font-medium text-slate-800 text-sm mb-2">新規ユーザー</h3>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setCreateMode("invite")}
              className={`px-3 py-1.5 text-sm rounded ${createMode === "invite" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"}`}
            >
              招待（メール送信）
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("direct")}
              className={`px-3 py-1.5 text-sm rounded ${createMode === "direct" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"}`}
            >
              直接作成
            </button>
          </div>

          {createMode === "invite" ? (
            <>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs text-slate-600 mb-0.5">メールアドレス</label>
                  <input
                    type="email"
                    placeholder="メールアドレス"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-xs text-slate-600 mb-0.5">デフォルト表示地方</label>
                  <select
                    value={inviteDefaultLocalityId}
                    onChange={(e) => setInviteDefaultLocalityId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {localities.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
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
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-0.5">メールアドレス（必須）</label>
                  <input
                    type="email"
                    placeholder="メールアドレス"
                    value={directEmail}
                    onChange={(e) => setDirectEmail(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-0.5">パスワード（必須・6文字以上）</label>
                  <input
                    type="password"
                    placeholder="パスワード"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-0.5">氏名（任意）</label>
                  <input
                    type="text"
                    placeholder="氏名"
                    value={directFullName}
                    onChange={(e) => setDirectFullName(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-0.5">デフォルト表示地方</label>
                  <select
                    value={directDefaultLocalityId}
                    onChange={(e) => setDirectDefaultLocalityId(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {localities.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCreateDirect}
                  disabled={directBusy || !directEmail.trim() || directPassword.length < 6}
                  className="rounded bg-slate-800 text-white px-3 py-2 text-sm disabled:opacity-50"
                >
                  {directBusy ? "作成中…" : "作成"}
                </button>
              </div>
              {directMessage && (
                <p className={`mt-2 text-sm ${directMessage.type === "error" ? "text-red-600" : "text-slate-600"}`}>
                  {directMessage.text}
                </p>
              )}
            </>
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
            onSaveDefaultLocality={handleSaveDefaultLocality}
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
  onSaveDefaultLocality: (userId: string, localityId: string | null) => Promise<void>;
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
  onSaveDefaultLocality,
  onSaveAreas,
  onSaveLocalities,
  onSaveLocalRoles,
}: UserRoleFormProps) {
  const [globalRole, setGlobalRole] = useState<GlobalRole | null>((profile.global_role as GlobalRole) ?? null);
  const [defaultLocalityId, setDefaultLocalityId] = useState<string | null>(profile.locality_id ?? null);
  const [areaIds, setAreaIds] = useState<string[]>(initialUserAreaIds);
  const [localityIds, setLocalityIds] = useState<string[]>(initialUserLocalityIds);
  const [localRoleByLocality, setLocalRoleByLocality] = useState<Record<string, LocalRole>>(
    Object.fromEntries(initialLocalRoles.map((lr) => [lr.locality_id, lr.role as LocalRole]))
  );

  const accessibleLocalityIds =
    globalRole === "admin" || globalRole === "national_viewer" || globalRole === "regional_viewer"
      ? localities.map((l) => l.id)
      : initialUserLocalityIds;
  // 現在の profile.locality_id も含める（直接作成で設定済みだが user_localities が空のとき選択肢に出るように）
  const defaultLocalityOptions = localities.filter(
    (l) => accessibleLocalityIds.includes(l.id) || l.id === profile.locality_id
  );

  const toggleArea = (id: string) => {
    setAreaIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const toggleLocality = (id: string) => {
    setLocalityIds((prev) => (prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 border border-slate-200 rounded-lg bg-white p-6">
      <div>
        <h2 className="font-medium text-slate-800">
          {profile.full_name || profile.email || profile.id.slice(0, 8)}
        </h2>
        {profile.email && (
          <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
        )}
      </div>

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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">デフォルト表示地方</label>
        <p className="text-xs text-slate-500 mb-1">サイトを開いたとき、Cookie が未設定ならこの地方を表示します。</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={defaultLocalityId ?? ""}
            onChange={(e) => setDefaultLocalityId(e.target.value || null)}
            disabled={disabled}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {defaultLocalityOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSaveDefaultLocality(profile.id, defaultLocalityId)}
            disabled={disabled}
            className="rounded bg-slate-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            保存
          </button>
        </div>
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
