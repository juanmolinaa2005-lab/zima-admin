"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VideosPage } from "./viewtracker/VideosPage";
import { AccountsPage } from "./viewtracker/AccountsPage";
import { OverviewPage } from "./viewtracker/OverviewPage";
import { TopTabs } from "./TopTabs";

type PageId = "overview" | "videos" | "accounts";

const PAGES: { id: PageId; label: string }[] = [
  { id: "overview", label: "Resumen" },
  { id: "videos", label: "Videos" },
  { id: "accounts", label: "Cuentas" },
];

function pageFromParam(raw: string | null): PageId {
  return PAGES.some((p) => p.id === raw) ? (raw as PageId) : "overview";
}

export function ViewTrackerView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromParam(searchParams.get("vt"));

  function go(next: PageId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "results");
    if (next === "overview") params.delete("vt");
    else params.set("vt", next);
    params.delete("add");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <TopTabs label="Resultados" items={PAGES} active={page} onSelect={go} />
      {page === "overview" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
          <OverviewPage projectId={projectId} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {page === "accounts" ? <AccountsPage projectId={projectId} /> : <VideosPage projectId={projectId} />}
        </div>
      )}
    </div>
  );
}
