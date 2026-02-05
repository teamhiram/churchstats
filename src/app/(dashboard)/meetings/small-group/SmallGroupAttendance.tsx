"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { formatDateYmd, getDaysInWeek } from "@/lib/weekUtils";
import type { Category } from "@/types/database";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };
type WeekOption = { value: string; label: string };

type MemberRow = {
  id: string;
  name: string;
  district_id: string | null;
  group_id: string | null;
  age_group: Category | null;
  is_baptized: boolean;
};

type AttendanceRow = {
  id: string;
  member_id: string;
  memo: string | null;
};

type Props = {
  districts: District[];
  defaultDistrictId: string;
  initialYear: number;
  initialWeekStartIso: string;
  weekOptions: WeekOption[];
};

export function SmallGroupAttendance({
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
  const [recordId, setRecordId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<string>("");
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
          const stillValid = list.some((g) => g.id === prev);
          return stillValid ? prev : (list[0]?.id ?? "");
        });
      });
  }, [districtId]);

  const ensureGroupMeetingRecord = useCallback(
    async (initialEventDate?: string | null) => {
      if (!groupId || !weekStartIso) return null;
      const supabase = createClient();
      const group = groups.find((g) => g.id === groupId);
      const name = group?.name ?? "小組集会";
      const { data: existing } = await supabase
        .from("group_meeting_records")
        .select("id")
        .eq("group_id", groupId)
        .eq("week_start", weekStartIso)
        .maybeSingle();
      if (existing) return existing.id;
      const { data: created, error } = await supabase
        .from("group_meeting_records")
        .insert({
          group_id: groupId,
          week_start: weekStartIso,
          event_date: initialEventDate ?? null,
          name: name || null,
        })
        .select("id")
        .single();
      if (error) return null;
      return created?.id ?? null;
    },
    [groupId, weekStartIso, groups]
  );

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setRecordId(null);
      setEventDate("");
      setRoster([]);
      setAttendanceMap(new Map());
      setMemos(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("group_meeting_records")
      .select("id, event_date")
      .eq("group_id", groupId)
      .eq("week_start", weekStartIso)
      .maybeSingle()
      .then(({ data: existingRecord }) => {
        if (cancelled) return;
        const rid = existingRecord?.id ?? null;
        const evDate = (existingRecord as { id: string; event_date?: string | null } | null)?.event_date ?? "";
        setRecordId(rid);
        setEventDate(evDate ?? "");
        return supabase
          .from("members")
          .select("id, name, district_id, group_id, age_group, is_baptized")
          .eq("group_id", groupId)
          .order("name")
          .then((membersRes) => {
            if (cancelled) return;
            const districtMembers = (membersRes.data ?? []) as MemberRow[];
            if (!rid) {
              setRoster(districtMembers);
              setAttendanceMap(new Map());
              setMemos(new Map());
              setEventDate("");
              setLoading(false);
              return;
            }
            return supabase
              .from("group_meeting_attendance")
              .select("id, member_id, memo")
              .eq("group_meeting_record_id", rid)
              .then(async (attRes) => {
                if (cancelled) return;
                const records = (attRes.data ?? []) as AttendanceRow[];
                const map = new Map<string, AttendanceRow>();
                const memoMap = new Map<string, string>();
                records.forEach((r) => {
                  map.set(r.member_id, r);
                  memoMap.set(r.member_id, r.memo ?? "");
                });
                const districtIds = new Set(districtMembers.map((m) => m.id));
                const guestIds = records.map((r) => r.member_id).filter((id) => !districtIds.has(id));
                let guests: MemberRow[] = [];
                if (guestIds.length > 0) {
                  const { data: guestData } = await supabase
                    .from("members")
                    .select("id, name, district_id, group_id, age_group, is_baptized")
                    .in("id", guestIds);
                  guests = (guestData ?? []) as MemberRow[];
                }
                setRoster([...districtMembers, ...guests]);
                setAttendanceMap(map);
                setMemos(memoMap);
                setLoading(false);
              });
          });
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, weekStartIso]);

  const toggleAttendance = async (memberId: string, member: MemberRow) => {
    setMessage("");
    const supabase = createClient();
    const rec = attendanceMap.get(memberId);
    if (rec) {
      await supabase.from("group_meeting_attendance").delete().eq("id", rec.id);
      setAttendanceMap((prev) => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
      setMemos((prev) => {
        const next = new Map(prev);
        next.delete(memberId);
        return next;
      });
    } else {
      let rid = recordId;
      if (!rid) {
        rid = await ensureGroupMeetingRecord();
        if (!rid) {
          setMessage("集会の登録に失敗しました。");
          return;
        }
        setRecordId(rid);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("group_meeting_attendance")
        .insert({
          group_meeting_record_id: rid,
          member_id: memberId,
          memo: null,
          reported_by_user_id: user?.id ?? null,
        })
        .select("id, member_id, memo")
        .single();
      if (error) {
        if (error.code === "23505") setMessage("この方はすでに登録済みです。");
        else setMessage(error.message);
        return;
      }
      setAttendanceMap((prev) => new Map(prev).set(memberId, { id: inserted.id, member_id: memberId, memo: null }));
      setMemos((prev) => new Map(prev).set(memberId, ""));
      setRoster((prev) => (prev.some((m) => m.id === memberId) ? prev : [...prev, member]));
    }
    router.refresh();
  };

  const saveMemo = async (memberId: string) => {
    const rec = attendanceMap.get(memberId);
    if (!rec || !recordId) return;
    const memo = memos.get(memberId) ?? "";
    const supabase = createClient();
    await supabase.from("group_meeting_attendance").update({ memo: memo || null }).eq("id", rec.id);
    router.refresh();
  };

  const onEventDateChange = async (value: string) => {
    setEventDate(value);
    const supabase = createClient();
    if (recordId) {
      await supabase
        .from("group_meeting_records")
        .update({ event_date: value || null, updated_at: new Date().toISOString() })
        .eq("id", recordId);
    } else if (value) {
      const rid = await ensureGroupMeetingRecord(value);
      if (rid) setRecordId(rid);
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {!districtId ? (
        <p className="text-slate-500 text-sm">地区を選択してください（上記のフィルターで選択）。</p>
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-1 max-w-xs">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">小組</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="">選択</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>

      {message && <p className="text-sm text-amber-600">{message}</p>}

      {groupId && !loading && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">実施日</label>
            <select
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
            >
              <option value="">—</option>
              {getDaysInWeek(weekStartIso).map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-0.5">選択した週の範囲内の日付のみ選択できます</p>
          </div>
        </div>
      )}

      {groupId && (
        <div>
          {loading ? (
            <p className="text-slate-500 text-sm">読み込み中…</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-slate-500 text-sm">
                        名簿がありません
                      </td>
                    </tr>
                  )}
                  {roster.map((m) => {
                    const attended = attendanceMap.has(m.id);
                    const memo = memos.get(m.id) ?? "";
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-slate-800">{m.name}</td>
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={attended}
                            onClick={() => toggleAttendance(m.id, m)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                              attended ? "bg-primary-600" : "bg-slate-200"
                            }`}
                          >
                            <span
                              className={`pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                attended ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                            onBlur={() => saveMemo(m.id)}
                            placeholder="欠席理由など"
                            className="w-full max-w-xs px-2 py-0.5 text-sm border border-slate-300 rounded touch-target"
                          />
                        </td>
                      </tr>
                    );
                  })}
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
