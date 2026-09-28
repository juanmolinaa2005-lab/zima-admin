"use client";

import Link from "next/link";
import { InfoCircleIcon } from "@/components/dashboard/icons";

export function AppDemoCodeDocs({ tone = "light" }: { tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link
      href="/docs/app-demo"
      aria-label="Documentación de App Demo"
      title="Documentación"
      className={
        dark
          ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 hover:bg-white/[0.06] hover:text-white"
          : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]"
      }
    >
      <InfoCircleIcon className="h-4 w-4" />
    </Link>
  );
}
