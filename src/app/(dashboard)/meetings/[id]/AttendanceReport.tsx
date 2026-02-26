"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { CATEGORY_LABELS } from "@/types/database";
import type { Category } from "@/types/database";

type Member = { id: string; name: string; age_group: Category | null; is_baptized: boolean; district_id: string | null; group_id: string | null };

type Props = {
  meetingId: string;
  eventDate: string;
  meetingType: string;
  districtId: string | null;
  initialAttendance: { id: string; member_id: string }[];
  initialMembers: Member[];
  regularList: { id: string; member_id: string; sort_order: number }[];
};

export function AttendanceReport({
  meetingId,
  eventDate,
  meetingType,
  districtId,
  initialAttendance,
  initialMembers,
  regularList,
}: Props) {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Member[]>([]);
  const [attendedIds, setAttendedIds] = useState<Set<string>>(
    new Set(initialAttendance.map((a) => a.member_id))
  );
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!search.trim()) {
      setCandidates([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("members")
      .select("id, name, age_group, is_baptized, district_id, group_id")
      .ilike("name", `%${search.trim()}%`)
      .limit(10)
      .then(({ data }) => setCandidates(data ?? []));
  }, [search]);

  const addAttendance = async (member: Member) => {
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("lordsday_meeting_attendance").insert({
      meeting_id: meetingId,
      member_id: member.id,
      recorded_category: member.age_group,
      recorded_is_baptized: member.is_baptized,
      district_id: member.district_id,
      group_id: member.group_id,
      reported_by_user_id: user?.id ?? null,
    });
    if (error) {
      if (error.code === "23505") setMessage("この方はすでに登録済みです。");
      else setMessage(error.message);
      return;
    }
    setAttendedIds((prev) => new Set(prev).add(member.id));
    setMembers((prev) => [...prev, member]);
    setSearch("");
    setCandidates([]);
  };

  const removeAttendance = async (memberId: string) => {
    const supabase = createClient();
    await supabase.from("lordsday_meeting_attendance").delete().eq("meeting_id", meetingId).eq("member_id", memberId);
    setAttendedIds((prev) => {
      const next = new Set(prev);
      next.delete(memberId);
      return next;
    });
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-slate-800">出欠登録</h2>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">名前で検索（追加）</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="氏名を入力"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
        />
        {candidates.length > 0 && (
          <ul className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
            {candidates
              .filter((m) => !attendedIds.has(m.id))
              .map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => addAttendance(m)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 touch-target"
                  >
                    {m.name}
                    {m.age_group && (
                      <span className="ml-2 text-slate-500">{CATEGORY_LABELS[m.age_group]}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      {message && <p className="text-sm text-amber-600">{message}</p>}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">出席者（{members.length}名）</p>
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
          {members.length === 0 && (
            <li className="px-4 py-6 text-center text-slate-500 text-sm">未登録</li>
          )}
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2">
              <span>{m.name}</span>
              <button
                type="button"
                onClick={() => removeAttendance(m.id)}
                className="text-sm text-red-600 hover:underline touch-target"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
