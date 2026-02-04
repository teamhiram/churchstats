"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { getMondayWeeksInYear, getDefaultMondayWeekStart, formatDateYmd } from "@/lib/weekUtils";
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
  weekOptions: initialWeekOptions,
}: Props) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [weekStartIso, setWeekStartIso] = useState(initialWeekStartIso);
  const [districtId, setDistrictId] = useState((defaultDistrictId || districts[0]?.id) ?? "");
  const [weekOptions, setWeekOptions] = useState(initialWeekOptions);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [roster, setRoster] = useState<MemberRow[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceRow>>(new Map());
  const [memos, setMemos] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const weeks = getMondayWeeksInYear(year);
    setWeekOptions(weeks.map((w) => ({ value: formatDateYmd(w.weekStart), label: w.label })));
    const defaultStart = getDefaultMondayWeekStart(year);
    setWeekStartIso(formatDateYmd(defaultStart));
  }, [year]);

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
          const stillValid = (data ?? []).some((g) => g.id === prev);
          return stillValid ? prev : (data?.[0]?.id ?? "");
        });
      });
  }, [districtId]);

  const ensureMeeting = useCallback(async () => {
    if (!groupId || !weekStartIso) return null;
    const supabase = createClient();
    const group = groups.find((g) => g.id === groupId);
    const name = group?.name ?? "";
    const { data: existing } = await supabase
      .from("meetings")
      .select("id")
      .eq("event_date", weekStartIso)
      .eq("meeting_type", "group")
      .eq("group_id", groupId)
      .maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase
      .from("meetings")
      .insert({
        event_date: weekStartIso,
        meeting_type: "group",
        group_id: groupId,
        district_id: null,
        name: name || "小組集会",
      })
      .select("id")
      .single();
    if (error) return null;
    return created?.id ?? null;
  }, [groupId, weekStartIso, groups]);

  useEffect(() => {
    if (!groupId || !weekStartIso) {
      setMeetingId(null);
      setRoster([]);
      setAttendanceMap(new Map());
      setMemos(new Map());
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("meetings")
      .select("id")
      .eq("event_date", weekStartIso)
      .eq("meeting_type", "group")
      .eq("group_id", groupId)
      .maybeSingle()
      .then(({ data: existingMeeting }) => {
        if (cancelled) return;
        const mid = existingMeeting?.id ?? null;
        setMeetingId(mid);
        return supabase
          .from("members")
          .select("id, name, district_id, group_id, age_group, is_baptized")
          .eq("group_id", groupId)
          .order("name")
          .then((membersRes) => {
            if (cancelled) return;
            const districtMembers = (membersRes.data ?? []) as MemberRow[];
            if (!mid) {
              setRoster(districtMembers);
              setAttendanceMap(new Map());
              setMemos(new Map());
              setLoading(false);
              return;
            }
            return supabase
              .from("attendance_records")
              .select("id, member_id, memo")
              .eq("meeting_id", mid)
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
      await supabase.from("attendance_records").delete().eq("id", rec.id);
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
      let mid = meetingId;
      if (!mid) {
        mid = await ensureMeeting();
        if (!mid) {
          setMessage("集会の登録に失敗しました。");
          return;
        }
        setMeetingId(mid);
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("attendance_records")
        .insert({
          meeting_id: mid,
          member_id: memberId,
          recorded_category: member.age_group,
          recorded_is_baptized: Boolean(member.is_baptized),
          district_id: member.district_id,
          group_id: member.group_id,
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
    if (!rec || !meetingId) return;
    const memo = memos.get(memberId) ?? "";
    const supabase = createClient();
    await supabase.from("attendance_records").update({ memo: memo || null }).eq("id", rec.id);
    router.refresh();
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">年</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">週</label>
          <select
            value={weekStartIso}
            onChange={(e) => setWeekStartIso(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            {weekOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">地区</label>
          <select
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setGroupId("");
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="">選択</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
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

      {groupId && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-2">名簿（出欠・メモ）</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">読み込み中…</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">名前</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase w-24">出欠</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">メモ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500 text-sm">
                        名簿がありません
                      </td>
                    </tr>
                  )}
                  {roster.map((m) => {
                    const attended = attendanceMap.has(m.id);
                    const memo = memos.get(m.id) ?? "";
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-800">{m.name}</td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={attended}
                            onClick={() => toggleAttendance(m.id, m)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 ${
                              attended ? "bg-primary-600" : "bg-slate-200"
                            }`}
                          >
                            <span
                              className={`pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ring-0 transition ${
                                attended ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={memo}
                            onChange={(e) => setMemos((prev) => new Map(prev).set(m.id, e.target.value))}
                            onBlur={() => saveMemo(m.id)}
                            placeholder="欠席理由など"
                            className="w-full max-w-xs px-2 py-1 text-sm border border-slate-300 rounded touch-target"
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
    </div>
  );
}
