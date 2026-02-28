"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { setCurrentLocalityIdAction } from "@/lib/locality";

export type LocalityOption = {
  id: string;
  name: string;
  area_id?: string | null;
  prefecture_id?: string | null;
  prefecture_name?: string | null;
};

export type LocalityPrefectureGroup = {
  prefectureId: string | null;
  prefectureName: string;
  localities: LocalityOption[];
};

export type LocalityAreaSection = {
  areaId: string | null;
  areaName: string;
  prefectures: LocalityPrefectureGroup[];
};

type LocalityContextValue = {
  /** 現在選択中の地方 ID（実効値。Cookie またはデフォルト） */
  currentLocalityId: string | null;
  /** 切り替え可能な地方一覧（RLS でアクセス可能なもののみ） */
  accessibleLocalities: LocalityOption[];
  /** 地域別にグループ化した地方一覧（ポップアップのセクション表示用） */
  localitiesByArea: LocalityAreaSection[];
  /** 現在の地方の表示名 */
  currentLocalityName: string | null;
  /** 地方を切り替える。Server Action で Cookie を更新し、router.refresh() する */
  setCurrentLocalityId: (localityId: string) => Promise<void>;
};

const LocalityContext = createContext<LocalityContextValue | null>(null);

export function useLocality(): LocalityContextValue {
  const ctx = useContext(LocalityContext);
  if (!ctx) {
    throw new Error("useLocality must be used within LocalityProvider");
  }
  return ctx;
}

function buildLocalitiesByArea(
  localities: LocalityOption[],
  areas: { id: string; name: string }[],
  prefectures: { id: string; name: string; area_id: string; sort_order?: number }[]
): LocalityAreaSection[] {
  if (localities.length === 0) return [];
  const areaMap = new Map(areas.map((a) => [a.id, a.name]));
  const prefecturesByArea = new Map<string, { id: string; name: string; sort_order?: number }[]>();
  for (const p of prefectures) {
    if (!prefecturesByArea.has(p.area_id)) prefecturesByArea.set(p.area_id, []);
    prefecturesByArea.get(p.area_id)!.push(p);
  }
  const byAreaThenPrefecture = new Map<string, Map<string | null, LocalityOption[]>>();
  for (const loc of localities) {
    const aid = loc.area_id ?? "__other__";
    if (!byAreaThenPrefecture.has(aid)) byAreaThenPrefecture.set(aid, new Map());
    const byPref = byAreaThenPrefecture.get(aid)!;
    const pid = loc.prefecture_id ?? null;
    if (!byPref.has(pid)) byPref.set(pid, []);
    byPref.get(pid)!.push(loc);
  }
  const sections: LocalityAreaSection[] = [];
  if (areas.length === 0) {
    const byPref = byAreaThenPrefecture.get("__other__");
    if (byPref) {
      const prefecturesList: LocalityPrefectureGroup[] = [];
      byPref.forEach((list, pid) => {
        prefecturesList.push({
          prefectureId: pid,
          prefectureName: list[0]?.prefecture_name ?? "その他",
          localities: list,
        });
      });
      sections.push({ areaId: null, areaName: "地方", prefectures: prefecturesList });
    }
    return sections;
  }
  for (const area of areas) {
    const byPref = byAreaThenPrefecture.get(area.id);
    if (!byPref || byPref.size === 0) continue;
    const prefsInArea = prefecturesByArea.get(area.id) ?? [];
    const prefecturesList: LocalityPrefectureGroup[] = [];
    for (const p of prefsInArea) {
      const list = byPref.get(p.id);
      if (list && list.length > 0) {
        prefecturesList.push({ prefectureId: p.id, prefectureName: p.name, localities: list });
      }
    }
    const other = byPref.get(null);
    if (other && other.length > 0) {
      prefecturesList.push({ prefectureId: null, prefectureName: "その他", localities: other });
    }
    if (prefecturesList.length > 0) {
      sections.push({ areaId: area.id, areaName: areaMap.get(area.id) ?? area.name, prefectures: prefecturesList });
    }
  }
  const otherArea = byAreaThenPrefecture.get("__other__");
  if (otherArea && otherArea.size > 0) {
    const prefecturesList: LocalityPrefectureGroup[] = [];
    otherArea.forEach((list, pid) => {
      prefecturesList.push({
        prefectureId: pid,
        prefectureName: list[0]?.prefecture_name ?? "その他",
        localities: list,
      });
    });
    sections.push({ areaId: null, areaName: "その他", prefectures: prefecturesList });
  }
  return sections;
}

export function LocalityProvider({
  initialCurrentLocalityId,
  syncCookieToLocalityId,
  initialAccessibleLocalities,
  initialAreas,
  initialPrefectures,
  children,
}: {
  initialCurrentLocalityId: string | null;
  /** サーバーで補正した地方 ID。渡された場合、マウント時に Cookie に同期する（Server Action で set） */
  syncCookieToLocalityId: string | null;
  initialAccessibleLocalities: LocalityOption[];
  initialAreas: { id: string; name: string }[];
  initialPrefectures: { id: string; name: string; area_id: string; sort_order?: number }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [currentLocalityId, setState] = useState<string | null>(initialCurrentLocalityId);
  const accessibleLocalities = initialAccessibleLocalities;
  const localitiesByArea = useMemo(
    () => buildLocalitiesByArea(initialAccessibleLocalities, initialAreas, initialPrefectures),
    [initialAccessibleLocalities, initialAreas, initialPrefectures]
  );

  useEffect(() => {
    if (!syncCookieToLocalityId) return;
    setCurrentLocalityIdAction(syncCookieToLocalityId).then(() => {
      router.refresh();
    });
  }, [syncCookieToLocalityId, router]);

  const setCurrentLocalityId = useCallback(
    async (localityId: string) => {
      await setCurrentLocalityIdAction(localityId);
      setState(localityId);
      router.refresh();
    },
    [router]
  );

  const currentLocalityName = useMemo(
    () => accessibleLocalities.find((l) => l.id === currentLocalityId)?.name ?? null,
    [accessibleLocalities, currentLocalityId]
  );

  const value = useMemo<LocalityContextValue>(
    () => ({
      currentLocalityId,
      accessibleLocalities,
      localitiesByArea,
      currentLocalityName,
      setCurrentLocalityId,
    }),
    [currentLocalityId, accessibleLocalities, localitiesByArea, currentLocalityName, setCurrentLocalityId]
  );

  return (
    <LocalityContext.Provider value={value}>
      {children}
    </LocalityContext.Provider>
  );
}
