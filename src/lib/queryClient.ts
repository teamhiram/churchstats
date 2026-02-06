import { QueryClient } from "@tanstack/react-query";

const STALE_TIME_MS = 5 * 60 * 1000; // 5分間はキャッシュをそのまま表示
const BACKGROUND_REFETCH_INTERVAL_MS = 30 * 1000; // 30秒ごとにバージョン確認

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const DATA_VERSION_REFETCH_INTERVAL_MS = BACKGROUND_REFETCH_INTERVAL_MS;

export const QUERY_KEYS = {
  dataVersion: ["dataVersion"] as const,
  members: ["members"] as const,
  organization: ["organization"] as const,
};
