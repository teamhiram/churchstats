"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import { DISPATCH_TYPE_LABELS } from "@/types/database";
import type { DispatchType } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };

type MemberRow = {
  id: string;
  name: string;
  group_id?: string;
};

type DispatchRow = {
  id: string;
  member_id: string;
  group_id: string;
  week_start: string;
  dispatch_type: DispatchType | null;
  dispatch_date: string | null;
  dispatch_memo: string | null;
};

type Props = {
  districts: District[];
  defaultDistrictId: string;
  initialYear: number;
  initialWeekStartIso: string;
  weekOptions: WeekOption[];
};

const DISPATCH_OPTIONS: { value: "" | DispatchType; label: string }[] = [
  { value: "", label: "選択" },
  { value: "message", label: DISPATCH_TYPE_LABELS.message },
  { value: "phone", label: DISPATCH_TYPE_LABELS.phone },
  { value: "in_person", label: DISPATCH_TYPE_LABELS.in_person },
];

export function OrganicDispatchForm({
  districts,
  defaultDistrictId,
  initialYear,
  initialWeekStartIso,
  weekOptions,
}: Props) {
  const router = useRouter();
  const districtId = defaultDistrictId ?? "";
  const weekStartIso = initialWeekStartIso;
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [dispatchMap, setDispatchMap] = useState<Map<string, DispatchRow>>(new Map());
  const [localType, setLocalType] = useState<Map<string, "" | DispatchType>>(new Map());
  const [localDate, setLocalDate] = useState<Map<string, string>>(new Map());
  const [localMemo, setLocalMemo] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!districtId) {
      setGroups([]);
      setGroupId("");
      return;
    }
    const supabase = createClient();
    supabase
      .from("groups")
      .select("id, name, district_id")
      .eq("district_id", districtId)
      .order("name")
      .then(({ data }) => {
        setGroups(data ?? []);
        setGroupId((prev) => {
          const list = data ?? [];
          const stillValid = list.some((g) => g.id === prev) || prev === "__all__";
          return stillValid ? prev : "__all__";
        });
      });
  }, [districtId]);

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setRoster([]);
      setDispatchMap(new Map());
      setLocalType(new Map());
      setLocalDate(new Map());
      setLocalMemo(new Map());
      return;
    }
    if (groupId === "__all__" && groups.length === 0) return;
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    const groupIds = groupId === "__all__" ? groups.map((g) => g.id) : [groupId];
    if (groupIds.length === 0) {
      setRoster([]);
      setDispatchMap(new Map());
      setLocalType(new Map());
      setLocalDate(new Map());
      setLocalMemo(new Map());
      setLoading(false);
      return;
    }
    Promise.all([
      groupId === "__all__"
        ? supabase
            .from("members")
            .select("id, name, group_id")
            .in("group_id", groupIds)
            .order("name")
        : supabase
            .from("members")
            .select("id, name, group_id")
            .eq("group_id", groupId)
            .order("name"),
      supabase
        .from("organic_dispatch_records")
        .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo")
        .in("group_id", groupIds)
        .eq("week_start", weekStartIso),
    ]).then(([membersRes, dispatchRes]) => {
      if (cancelled) return;
      const members = (membersRes.data ?? []) as MemberRow[];
      const records = (dispatchRes.data ?? []) as DispatchRow[];
      const map = new Map<string, DispatchRow>();
      const typeMap = new Map<string, "" | DispatchType>();
      const dateMap = new Map<string, string>();
      const memoMap = new Map<string, string>();
      const weekDayValues = new Set(getDaysInWeek(weekStartIso).map((d) => d.value));
      records.forEach((r) => {
        map.set(r.member_id, r);
        typeMap.set(r.member_id, r.dispatch_type ?? "");
        const d = r.dispatch_date ?? "";
        dateMap.set(r.member_id, weekDayValues.has(d) ? d : "");
        memoMap.set(r.member_id, r.dispatch_memo ?? "");
      });
      setRoster(members);
      setDispatchMap(map);
      setLocalType(typeMap);
      setLocalDate(dateMap);
      setLocalMemo(memoMap);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, weekStartIso, groups]);

  const upsertDispatch = useCallback(
    async (memberId: string, payload: { dispatch_type?: DispatchType | null; dispatch_date?: string | null; dispatch_memo?: string | null }) => {
      if (!groupId || !weekStartIso) return;
      const effectiveGroupId = groupId === "__all__" ? roster.find((m) => m.id === memberId)?.group_id : groupId;
      if (!effectiveGroupId) return;
      setSaveError(null);
      const supabase = createClient();
      const existing = dispatchMap.get(memberId);
      if (existing) {
        const { error } = await supabase
          .from("organic_dispatch_records")
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          const isRls = /row-level security|RLS/i.test(error.message ?? "");
          setSaveError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${error.message}`);
          return;
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("organic_dispatch_records")
          .insert({
            member_id: memberId,
            group_id: effectiveGroupId,
            week_start: weekStartIso,
            ...payload,
          })
          .select("id, member_id, group_id, week_start, dispatch_type, dispatch_date, dispatch_memo")
          .single();
        if (error) {
          const isRls = /row-level security|RLS/i.test(error.message ?? "");
          setSaveError(isRls ? "保存する権限がありません。報告者以上のロールが必要です。" : `保存に失敗しました: ${error.message}`);
          return;
        }
        if (inserted) {
          setDispatchMap((prev) => new Map(prev).set(memberId, inserted as DispatchRow));
        }
      }
      router.refresh();
    },
    [groupId, weekStartIso, dispatchMap, roster]
  );

  const onTypeChange = (memberId: string, value: "" | DispatchType) => {
    setLocalType((prev) => new Map(prev).set(memberId, value));
    upsertDispatch(memberId, { dispatch_type: value || null });
  };

  const onDateChange = (memberId: string, value: string) => {
    setLocalDate((prev) => new Map(prev).set(memberId, value));
    upsertDispatch(memberId, { dispatch_date: value || null });
  };

  const onMemoBlur = (memberId: string) => {
    const memo = localMemo.get(memberId) ?? "";
    upsertDispatch(memberId, { dispatch_memo: memo || null });
  };

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-1 max-w-xs">
        <div>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="__all__">すべて</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {saveError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {saveError}
        </div>
      )}

      {groupId && (
        <div>
          {loading ? (
            <p className="text-slate-500 text-sm">読み込み中…</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">派遣種類</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">派遣日</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">派遣メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-500 text-sm">
                        名簿がありません
                      </td>
                    </tr>
                  )}
                  {roster.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={localType.get(m.id) ?? ""}
                          onChange={(e) => onTypeChange(m.id, (e.target.value || "") as "" | DispatchType)}
                          className="w-full max-w-[140px] px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                        >
                          {DISPATCH_OPTIONS.map((opt) => (
                            <option key={opt.value || "empty"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={localDate.get(m.id) ?? ""}
                          onChange={(e) => onDateChange(m.id, e.target.value)}
                          className="w-full max-w-[160px] px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                        >
                          <option value="">—</option>
                          {getDaysInWeek(weekStartIso).map((day) => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={localMemo.get(m.id) ?? ""}
                          onChange={(e) => setLocalMemo((prev) => new Map(prev).set(m.id, e.target.value))}
                          onBlur={() => onMemoBlur(m.id)}
                          placeholder="メモ"
                          className="w-full min-w-[120px] max-w-xs px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
