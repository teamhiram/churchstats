"use client";

import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useRef } from "react";
import { makeQueryClient, DATA_VERSION_REFETCH_INTERVAL_MS, QUERY_KEYS } from "@/lib/queryClient";

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function DataVersionPoller() {
  const queryClient = useQueryClient();
  const lastVersionRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: QUERY_KEYS.dataVersion,
    queryFn: async () => {
      const res = await fetch("/api/data-version");
      if (!res.ok) throw new Error("data-version failed");
      return res.json() as Promise<{ version: string }>;
    },
    refetchInterval: DATA_VERSION_REFETCH_INTERVAL_MS,
    staleTime: 0,
  });

  useEffect(() => {
    const version = data?.version ?? null;
    if (version == null) return;
    if (lastVersionRef.current != null && lastVersionRef.current !== version) {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.members });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organization });
    }
    lastVersionRef.current = version;
  }, [data?.version, queryClient]);

  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // ローカルストレージにキャッシュを永続化（再訪時に“即表示”を優先）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "churchstats_rq_cache",
    });
    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
      buster: "v1",
    });
    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <DataVersionPoller />
      {children}
    </QueryClientProvider>
  );
}
