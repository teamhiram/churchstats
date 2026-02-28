"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const tabs = [
  { href: "/attendance/lordsday", label: "主日集会" },
  { href: "/attendance/prayer", label: "祈りの集会" },
  { href: "/attendance/small-group", label: "小組集会" },
  { href: "/attendance/organic", label: "有機的派遣" },
];

export function MeetingTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/weekly" || pathname.startsWith("/weekly/")) return null;

  const query = searchParams.toString();

  return (
    <div className="border-b border-slate-200 bg-white m-0">
      <nav className="flex gap-0 pl-4 md:pl-6" role="tablist">
        {tabs.map(({ href, label }) => {
          const isActive = pathname === href || (href === "/attendance/lordsday" && pathname === "/attendance");
          const to = query ? `${href}?${query}` : href;
          return (
            <Link
              key={href}
              href={to}
              role="tab"
              aria-selected={isActive}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition touch-target ${
                isActive
                  ? "border-primary-600 text-primary-600 bg-primary-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
