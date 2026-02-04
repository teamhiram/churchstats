import { MeetingTabs } from "./MeetingTabs";

export default function MeetingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0">
      <MeetingTabs />
      <div>{children}</div>
    </div>
  );
}
