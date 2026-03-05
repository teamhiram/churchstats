/**
 * 開発用 ingest への POST。次の条件を満たすときだけ送信する（それ以外は何もしない）。
 * - NODE_ENV === "development"
 * - NEXT_PUBLIC_DEV_INGEST_ENABLED が "1" または "true"（.env.local で明示的に有効にした場合のみ）
 * 未設定のままローカルで開いてもコンソールに ERR_CONNECTION_REFUSED が出ないようにする。
 */
const DEV_INGEST_ENABLED =
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development" &&
  (process.env.NEXT_PUBLIC_DEV_INGEST_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_DEV_INGEST_ENABLED === "true");

const DEV_INGEST_BASE = DEV_INGEST_ENABLED ? "http://127.0.0.1:7242" : "";

const INGEST_PATH = "/ingest/39fe22d5-aab7-4e37-aff0-0746864bb5ec";

export function devIngest(payload: Record<string, unknown>): void {
  if (!DEV_INGEST_BASE) return;
  fetch(DEV_INGEST_BASE + INGEST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export async function devIngestAsync(
  payload: Record<string, unknown>
): Promise<void> {
  if (!DEV_INGEST_BASE) return;
  try {
    await fetch(DEV_INGEST_BASE + INGEST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore
  }
}
