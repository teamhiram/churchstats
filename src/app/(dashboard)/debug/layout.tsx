import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";

/** デバッグ機能は管理者（admin）のみアクセス可能。共同管理者以下は 403。 */
export default async function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
