"use client";

import { useQuery } from "@tanstack/react-query";
import type { MembersApiResponse } from "@/app/api/members/route";
import { QUERY_KEYS } from "@/lib/queryClient";

export type MembersDataInitial = MembersApiResponse | undefined;

/** contextLocalityId: ヘッダーで選択中の地方。refetch 時に API に ?locality= で渡し、Cookie に依存しないようにする。 */
export function useMembersData(
  initialData?: MembersApiResponse,
  contextLocalityId?: string | null
) {
  const localityKey = contextLocalityId ?? initialData?.localityId ?? "";
  return useQuery({
    queryKey: [...QUERY_KEYS.members, localityKey],
    queryFn: async (): Promise<MembersApiResponse> => {
      const url =
        contextLocalityId != null && contextLocalityId !== ""
          ? `/api/members?locality=${encodeURIComponent(contextLocalityId)}`
          : "/api/members";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    initialData:
      initialData != null && initialData.localityId === (contextLocalityId ?? initialData.localityId)
        ? initialData
        : undefined,
    initialDataUpdatedAt:
      initialData != null && initialData.localityId === (contextLocalityId ?? initialData.localityId)
        ? Date.now()
        : 0,
  });
}
