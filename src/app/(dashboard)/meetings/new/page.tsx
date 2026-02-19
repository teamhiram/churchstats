"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type District = { id: string; name: string };
type Group = { id: string; name: string; district_id: string };

export default function NewMeetingPage() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [meetingType, setMeetingType] = useState<"main" | "group">("main");
  const [districtId, setDistrictId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("districts").select("id, name").then(({ data }) => setDistricts(data ?? []));
    supabase.from("groups").select("id, name, district_id").then(({ data }) => setGroups(data ?? []));
  }, []);

  const filteredGroups = groupId ? groups.filter((g) => g.district_id === districtId) : groups;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (meetingType === "main" && !districtId) {
      setError("地区を選択してください");
      return;
    }
    if (meetingType === "group" && !groupId) {
      setError("小組を選択してください");
      return;
    }
    if (!name.trim()) {
      setError("集会名を入力してください");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: meeting, error: err } = await supabase
      .from("meetings")
      .insert({
        event_date: eventDate,
        meeting_type: meetingType,
        district_id: meetingType === "main" ? districtId : null,
        group_id: meetingType === "group" ? groupId : null,
        name: name.trim(),
      })
      .select("id")
      .single();
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(`/meetings/${meeting?.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-2">
        <Link href="/meetings" className="text-slate-600 hover:text-slate-800 text-sm">
          ← 週別集計
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">日付</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">種別</label>
          <select
            value={meetingType}
            onChange={(e) => {
              setMeetingType(e.target.value as "main" | "group");
              setDistrictId("");
              setGroupId("");
              setName("");
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          >
            <option value="main">主日集会</option>
            <option value="group">小組集会</option>
          </select>
        </div>
        {meetingType === "main" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">地区</label>
            <select
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value);
                setName(e.target.value ? `${districts.find((d) => d.id === e.target.value)?.name ?? ""}地区集会` : "");
              }}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
            >
              <option value="">選択</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        {meetingType === "group" && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">小組</label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                const g = groups.find((x) => x.id === e.target.value);
                setDistrictId(g?.district_id ?? "");
                setName(g ? `${g.name}` : "");
              }}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
            >
              <option value="">選択</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">集会名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={meetingType === "main" ? "例: 調布地区集会" : "例: XX小組"}
            required
            className="w-full px-3 py-2 border border-slate-300 rounded-lg touch-target"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-primary-600 text-white font-medium rounded-lg touch-target disabled:opacity-50 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500"
        >
          {loading ? "登録中…" : "登録"}
        </button>
      </form>
    </div>
  );
}
