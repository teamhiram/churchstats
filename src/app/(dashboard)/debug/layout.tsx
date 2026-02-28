import { redirect } from "next/navigation";
import { getCurrentUserWithProfile } from "@/lib/cachedData";

/** デバッグ機能はグローバル管理者（global_role = admin）のみアクセス可能。 */
export default async function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserWithProfile();
  if (!user) redirect("/login");
  if (profile?.global_role !== "admin") redirect("/charts");
  return <>{children}</>;
}
