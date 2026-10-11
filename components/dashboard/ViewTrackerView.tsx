"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VideosPage } from "./viewtracker/VideosPage";
import { AccountsPage } from "./viewtracker/AccountsPage";
import { OverviewPage } from "./viewtracker/OverviewPage";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { ViewTrackerIcon } from "./icons";
import { UploadPage } from "./viewtracker/UploadPage";

type PageId = "overview" | "accounts" | "videos" | "upload";

const VT_PAGES = new Set<PageId>(["overview", "accounts", "videos", "upload"]);

function pageFromParam(raw: string | null): PageId {
  if (raw && VT_PAGES.has(raw as PageId)) return raw as PageId;
  return "overview";
}

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

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

export function ViewTrackerView({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFromParam(searchParams.get("vt"));
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(next: PageId, extra?: { add?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "viewtracker");
    if (next === "overview") params.delete("vt");
    else params.set("vt", next);
    if (extra?.add) params.set("add", "1");
    else params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const nav: { id: PageId; label: string; icon: typeof IconOverview }[] = [
    { id: "overview", label: "Overview", icon: IconOverview },
    { id: "accounts", label: "Accounts", icon: IconAccounts },
    { id: "videos", label: "Videos", icon: IconVideos },
    { id: "upload", label: "Upload", icon: IconUpload },
  ];

  const mobileSections: MobileNavSection[] = [
    {
      items: nav.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        active: page === item.id,
        onClick: () => go(item.id),
      })),
    },
  ];

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {nav.map((item) => (
            <NavItem key={item.id} label={item.label} active={page === item.id} icon={item.icon} onClick={() => go(item.id)} />
          ))}
        </div>
      </aside>

      <div
        className={
          page === "accounts" || page === "videos" || page === "upload"
            ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            : "min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6"
        }
      >
        {page === "overview" ? <OverviewPage projectId={projectId} /> : null}
        {page === "accounts" ? <AccountsPage projectId={projectId} /> : null}
        {page === "videos" ? <VideosPage projectId={projectId} /> : null}
        {page === "upload" ? <UploadPage projectId={projectId} /> : null}
      </div>

      <button
        type="button"
        title="Add"
        aria-label="Add"
        onClick={() => go("accounts", { add: true })}
        className="absolute bottom-5 right-5 hidden h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_8px_24px_rgba(17,24,39,0.25)] transition hover:bg-[var(--accent-hover)] md:flex"
      >
        <IconPlus className="h-5 w-5" />
      </button>

      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="ViewTracker"
        subtitle={projectName || "Workspace"}
        fabLabel="ViewTracker menu"
        fabClassName="bottom-[5.25rem] right-4"
        accent="dark"
        fabIcon={<ViewTrackerIcon className="h-5 w-5" />}
        sections={mobileSections}
        footer={
          <button
            type="button"
            onClick={() => {
              go("accounts", { add: true });
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
              <IconPlus className="h-4 w-4" />
            </span>
            Add account
          </button>
        }
      />
    </div>
  );
}
