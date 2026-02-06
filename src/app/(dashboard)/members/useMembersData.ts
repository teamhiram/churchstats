"use client";

import { useQuery } from "@tanstack/react-query";
import type { MembersApiResponse } from "@/app/api/members/route";
import { QUERY_KEYS } from "@/lib/queryClient";

export type MembersDataInitial = MembersApiResponse | undefined;

export function useMembersData(initialData?: MembersApiResponse) {
  return useQuery({
    queryKey: QUERY_KEYS.members,
    queryFn: async (): Promise<MembersApiResponse> => {
      const res = await fetch("/api/members");
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : 0,
  });
}
