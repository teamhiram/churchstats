"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/meetings/sunday", label: "主日集会" },
  { href: "/meetings/small-group", label: "小組集会" },
  { href: "/meetings/organic", label: "有機的派遣" },
];

export function MeetingTabs() {
  const pathname = usePathname();
  if (pathname === "/meetings/list" || pathname.startsWith("/meetings/list/")) return null;

  return (
    <div className="border-b border-slate-200 bg-white mb-4">
      <nav className="flex gap-0" role="tablist">
        {tabs.map(({ href, label }) => {
          const isActive = pathname === href || (href === "/meetings/sunday" && pathname === "/meetings");
          return (
            <Link
              key={href}
              href={href}
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
