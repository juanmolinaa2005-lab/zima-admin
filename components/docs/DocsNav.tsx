"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOCS_NAV } from "@/lib/docs/nav";

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
      {DOCS_NAV.map((item) => {
        const active =
          item.href === "/docs"
            ? pathname === "/docs"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-xl px-3 py-2 text-[13px] font-medium ${
              active
                ? "bg-white text-[var(--foreground)] shadow-sm lg:bg-[#111827] lg:text-white lg:shadow-none"
                : "text-[var(--muted)] hover:bg-white/70 hover:text-[var(--foreground)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
