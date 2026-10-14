"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RequestsPage } from "./viewtracker/RequestsPage";
import { ResponsesPage } from "./viewtracker/ResponsesPage";
import { VideosPage } from "./viewtracker/VideosPage";
import { AccountsPage } from "./viewtracker/AccountsPage";
import { CreatorsPage } from "./viewtracker/CreatorsPage";
import { OverviewPage } from "./viewtracker/OverviewPage";
import { UploadPage } from "./viewtracker/UploadPage";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { ViewTrackerIcon } from "./icons";

type PageId = "overview" | "creators" | "accounts" | "videos" | "requests" | "responses" | "upload";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

const GROUPS: { label: string | null; items: { id: PageId; label: string; icon: IconComp }[] }[] = [
  { label: null, items: [{ id: "overview", label: "Resumen", icon: IconOverview }] },
  {
    label: "Seguimiento",
    items: [
      { id: "accounts", label: "Cuentas", icon: IconAccounts },
      { id: "videos", label: "Videos", icon: IconVideos },
      { id: "creators", label: "Creadores", icon: IconCreators },
    ],
  },
  {
    label: "Automatización",
    items: [
      { id: "upload", label: "Publicar", icon: IconUpload },
      { id: "requests", label: "Solicitudes", icon: IconRequests },
      { id: "responses", label: "Respuestas", icon: IconChat },
    ],
  },
];

const PAGES = new Set<PageId>(GROUPS.flatMap((g) => g.items.map((i) => i.id)));

function pageFromParam(raw: string | null): PageId {
  return raw && PAGES.has(raw as PageId) ? (raw as PageId) : "overview";
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5V4.5m0 0L7.75 8.75M12 4.5l4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 14.5v3.25A1.75 1.75 0 0 0 6.25 19.5h11.5a1.75 1.75 0 0 0 1.75-1.75V14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconOverview({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCreators({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 18.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16.2 18.5c.4-1.6 1.5-2.7 3.3-3.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAccounts({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 19c1.2-3.2 3.6-4.8 7-4.8s5.8 1.6 7 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVideos({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="6"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m16.5 10 4-2.2v8.4L16.5 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRequests({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m5.5 7.5 6.5 5 6.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 17.5 6.2 14A7 7 0 1 1 9 18.7L5 17.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavItem({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: IconComp;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        active
          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
          : "font-medium text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
      {children}
    </p>
  );
}

export function ViewTrackerView({ projectId, projectName }: { projectId: string; projectName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromParam(searchParams.get("vt"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountCount, setAccountCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/viewtracker/accounts`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAccountCount((data.items ?? []).length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

  function go(next: PageId, extra?: { add?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    if (next === "overview") params.delete("vt");
    else params.set("vt", next);
    if (extra?.add) params.set("add", "1");
    else params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const mobileSections: MobileNavSection[] = GROUPS.map((group) => ({
    label: group.label ?? undefined,
    items: group.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      active: page === item.id,
      onClick: () => {
        go(item.id);
        setMobileOpen(false);
      },
    })),
  }));

  const fullBleed = page === "accounts" || page === "videos" || page === "upload";

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {GROUPS.map((group) => (
            <div key={group.label ?? "top"}>
              {group.label ? <SectionLabel>{group.label}</SectionLabel> : null}
              {group.items.map((item) => (
                <NavItem key={item.id} label={item.label} active={page === item.id} icon={item.icon} onClick={() => go(item.id)} />
              ))}
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-[var(--border)] px-2 py-2">
          <p className="px-2.5 py-1 text-[11px] text-[var(--muted-soft)]">
            {accountCount === null
              ? "\u00a0"
              : accountCount === 0
                ? "Aún no sigues ninguna cuenta"
                : `${accountCount} ${accountCount === 1 ? "cuenta medida" : "cuentas medidas"} cada hora`}
          </p>
        </div>
      </aside>

      <div className={fullBleed ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : "min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6"}>
        {page === "overview" ? <OverviewPage projectId={projectId} /> : null}
        {page === "creators" ? <CreatorsPage projectId={projectId} /> : null}
        {page === "accounts" ? <AccountsPage projectId={projectId} /> : null}
        {page === "videos" ? <VideosPage projectId={projectId} /> : null}
        {page === "requests" ? <RequestsPage projectId={projectId} /> : null}
        {page === "responses" ? <ResponsesPage projectId={projectId} /> : null}
        {page === "upload" ? <UploadPage projectId={projectId} /> : null}
      </div>

      <button
        type="button"
        title="Añadir cuenta"
        aria-label="Añadir cuenta"
        onClick={() => go("accounts", { add: true })}
        className="ui-press absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_8px_24px_rgba(17,24,39,0.25)] transition hover:bg-[var(--accent-hover)] md:flex"
      >
        <IconPlus className="h-5 w-5" />
      </button>

      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Marketing"
        subtitle={projectName || "Vantko"}
        fabLabel="Menú de Marketing"
        fabClassName="bottom-[5.25rem] right-4"
        accent="dark"
        fabIcon={<ViewTrackerIcon className="h-5 w-5" />}
        sections={mobileSections}
      />
    </div>
  );
}
