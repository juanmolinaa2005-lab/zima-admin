"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreatorsPage } from "./viewtracker/CreatorsPage";
import { RequestsPage } from "./viewtracker/RequestsPage";
import { ResponsesPage } from "./viewtracker/ResponsesPage";
import { EmailsView } from "./EmailsView";
import { TopTabs } from "./TopTabs";

type PageId = "creators" | "requests" | "responses" | "emails";

const PAGES: { id: PageId; label: string }[] = [
  { id: "creators", label: "Creadores" },
  { id: "requests", label: "Buscar y contactar" },
  { id: "responses", label: "Respuestas" },
  { id: "emails", label: "Emails" },
];

export function CreatorsView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("cr");
  const page: PageId = PAGES.some((p) => p.id === raw) ? (raw as PageId) : "creators";

  function go(next: PageId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "creators");
    if (next === "creators") params.delete("cr");
    else params.set("cr", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--background)]">
      <TopTabs label="Creadores" items={PAGES} active={page} onSelect={go} />
      {page === "emails" ? (
        <div className="relative min-h-0 flex-1">
          <EmailsView projectId={projectId} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
          {page === "creators" ? <CreatorsPage projectId={projectId} /> : null}
          {page === "requests" ? <RequestsPage projectId={projectId} /> : null}
          {page === "responses" ? <ResponsesPage projectId={projectId} /> : null}
        </div>
      )}
    </div>
  );
}
