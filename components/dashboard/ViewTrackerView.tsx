"use client";

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RequestsPage } from "./viewtracker/RequestsPage";
import { ResponsesPage } from "./viewtracker/ResponsesPage";
import { VideosPage, formatCompact, type TrackedVideo } from "./viewtracker/VideosPage";
import { AccountsPage } from "./viewtracker/AccountsPage";
import { CreatorsPage } from "./viewtracker/CreatorsPage";
import { OverviewPage } from "./viewtracker/OverviewPage";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { ViewTrackerIcon } from "./icons";

type PageId =
  | "overview"
  | "creators"
  | "accounts"
  | "videos"
  | "requests"
  | "responses"
  | "team"
  | "viral"
  | "api-keys"
  | "settings"
  | "support";

const VT_PAGES = new Set<PageId>([
  "overview",
  "creators",
  "accounts",
  "videos",
  "requests",
  "responses",
  "team",
  "viral",
  "api-keys",
  "settings",
  "support",
]);

function pageFromParam(raw: string | null): PageId {
  if (raw && VT_PAGES.has(raw as PageId)) return raw as PageId;
  return "overview";
}

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

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

function IconTeam({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 18.5c.9-2.8 3-4.3 5.5-4.3s4.6 1.5 5.5 4.3M14.5 18.5c.4-1.5 1.4-2.6 3-3.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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

function IconViral({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 3 5.5 13.5H12l-1 7.5L19.5 10H13L13 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m16.2 16.2 3.3 3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
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

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 8.8v6.4L16 12 10 8.8Z" fill="currentColor" />
    </svg>
  );
}

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 19s-6.5-4.1-8.4-7.3C1.8 8.8 3.2 6 6.1 6c1.7 0 3 1 3.9 2.1C10.9 7 12.2 6 13.9 6c2.9 0 4.3 2.8 2.5 5.7C18.5 14.9 12 19 12 19Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
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

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m12 4 2.2 4.6 5 .7-3.6 3.5.9 5.1L12 15.8 7.5 17.9l.9-5.1L4.8 9.3l5-.7L12 4Z"
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

function ViralPage({ projectId }: { projectId: string }) {
  const [platform, setPlatform] = useState<"all" | "tiktok" | "instagram" | "youtube">("all");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [items, setItems] = useState<TrackedVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/projects/${projectId}/viewtracker/videos`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems((data.items ?? []) as TrackedVideo[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((v) => platform === "all" || v.platform === platform)
      .filter((v) => !favoritesOnly || v.favorite)
      .filter((v) =>
        !q
          ? true
          : (v.title || "").toLowerCase().includes(q) ||
            (v.author || "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.views - a.views);
  }, [items, platform, favoritesOnly, search]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
          Viral
        </h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Tus videos trackeados, ordenados por views.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-soft)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hooks"
            className="w-full rounded-xl border border-[var(--border)] bg-white py-2.5 pl-9 pr-3 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-soft)] focus:border-[var(--border-strong)]"
          />
        </label>
        <div className="inline-flex rounded-xl border border-[var(--border)] bg-white p-0.5">
          {(
            [
              ["all", "All"],
              ["tiktok", "TikTok"],
              ["instagram", "Instagram"],
              ["youtube", "YouTube"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPlatform(id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                platform === id
                  ? "bg-[var(--surface-alt)] text-[var(--foreground)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] font-medium ${
            favoritesOnly
              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
              : "border-[var(--border)] bg-white text-[var(--foreground-soft)]"
          }`}
        >
          <IconStar className="h-3.5 w-3.5" />
          Favorites
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white text-[13px] text-[var(--muted-soft)]">
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[var(--border)] bg-white">
          <p className="text-[14px] text-[var(--muted-soft)]">
            Trackea videos para verlos aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
            >
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-[9/14] bg-gradient-to-b from-[#1f2937] to-[#111827]">
                  {item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                    {item.platform || "web"}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2.5 pt-8">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-white/90">
                      <span className="inline-flex items-center gap-0.5">
                        <IconPlay className="h-3 w-3" />
                        {formatCompact(item.views)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <IconHeart className="h-3 w-3" />
                        {formatCompact(item.likes)}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <IconChat className="h-3 w-3" />
                        {formatCompact(item.comments)}
                      </span>
                    </div>
                  </div>
                </div>
              </a>
              <div className="flex items-start justify-between gap-2 p-2.5">
                <p className="line-clamp-2 text-[12px] font-medium leading-snug text-[var(--foreground)]">
                  {item.title || item.url}
                </p>
                <span
                  className={`shrink-0 ${item.favorite ? "text-[var(--accent)]" : "text-[var(--muted-soft)]"}`}
                >
                  <IconStar className="h-4 w-4" />
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SimplePage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight text-[var(--foreground)]">
        {title}
      </h1>
      <p className="mt-2 max-w-xl text-[13px] text-[var(--muted)]">{body}</p>
      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-8 text-[13px] text-[var(--muted-soft)]">
        Placeholder — we will adapt this next.
      </div>
    </div>
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
  const [accountCount, setAccountCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/projects/${projectId}/viewtracker/accounts`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAccountCount((data.items ?? []).length);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, page]);

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

  const mobileSections: MobileNavSection[] = [
    {
      items: [
        {
          id: "overview",
          label: "Overview",
          icon: IconOverview,
          active: page === "overview",
          onClick: () => go("overview"),
        },
        {
          id: "creators",
          label: "Creators",
          icon: IconCreators,
          active: page === "creators",
          onClick: () => go("creators"),
        },
      ],
    },
    {
      label: "Tracking",
      items: [
        {
          id: "accounts",
          label: "Accounts",
          icon: IconAccounts,
          active: page === "accounts",
          onClick: () => go("accounts"),
        },
        {
          id: "videos",
          label: "Videos",
          icon: IconVideos,
          active: page === "videos",
          onClick: () => go("videos"),
        },
      ],
    },
    {
      label: "Manage",
      items: [
        {
          id: "requests",
          label: "Requests",
          icon: IconRequests,
          active: page === "requests",
          onClick: () => go("requests"),
        },
        {
          id: "responses",
          label: "Responses",
          icon: IconChat,
          active: page === "responses",
          onClick: () => go("responses"),
        },
        {
          id: "team",
          label: "Team Members",
          icon: IconTeam,
          active: page === "team",
          onClick: () => go("team"),
        },
      ],
    },
    {
      label: "Discover",
      items: [
        {
          id: "viral",
          label: "Viral",
          icon: IconViral,
          active: page === "viral",
          onClick: () => go("viral"),
        },
        {
          id: "api-keys",
          label: "API Keys",
          icon: IconViral,
          active: page === "api-keys",
          onClick: () => go("api-keys"),
        },
      ],
    },
    {
      label: "More",
      items: [
        {
          id: "settings",
          label: "Settings",
          icon: IconAccounts,
          active: page === "settings",
          onClick: () => go("settings"),
        },
        {
          id: "support",
          label: "Support",
          icon: IconChat,
          active: page === "support",
          onClick: () => go("support"),
        },
      ],
    },
  ];

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
            V
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
              ViewTracker
            </p>
            <p className="truncate text-[11px] text-[var(--muted-soft)]">
              {projectName || "Workspace"}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2 text-[12px] font-medium text-[var(--foreground-soft)]"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Default
            </span>
            <span className="text-[var(--muted-soft)]">↕</span>
          </button>

          <NavItem
            label="Overview"
            active={page === "overview"}
            icon={IconOverview}
            onClick={() => go("overview")}
          />
          <NavItem
            label="Creators"
            active={page === "creators"}
            icon={IconCreators}
            onClick={() => go("creators")}
          />

          <SectionLabel>Tracking</SectionLabel>
          <NavItem
            label="Accounts"
            active={page === "accounts"}
            icon={IconAccounts}
            onClick={() => go("accounts")}
          />
          <NavItem
            label="Videos"
            active={page === "videos"}
            icon={IconVideos}
            onClick={() => go("videos")}
          />

          <SectionLabel>Manage</SectionLabel>
          <NavItem
            label="Requests"
            active={page === "requests"}
            icon={IconRequests}
            onClick={() => go("requests")}
          />
          <NavItem
            label="Responses"
            active={page === "responses"}
            icon={IconChat}
            onClick={() => go("responses")}
          />
          <NavItem
            label="Team Members"
            active={page === "team"}
            icon={IconTeam}
            onClick={() => go("team")}
          />

          <SectionLabel>Discover</SectionLabel>
          <NavItem
            label="Viral"
            active={page === "viral"}
            icon={IconViral}
            onClick={() => go("viral")}
          />
          <NavItem
            label="API Keys"
            active={page === "api-keys"}
            icon={IconViral}
            onClick={() => go("api-keys")}
          />
        </div>

        <div className="shrink-0 space-y-1 border-t border-[var(--border)] px-2 py-2">
          <NavItem
            label="Settings"
            active={page === "settings"}
            icon={IconAccounts}
            onClick={() => go("settings")}
          />
          <NavItem
            label="Support"
            active={page === "support"}
            icon={IconChat}
            onClick={() => go("support")}
          />
          <p className="px-2.5 py-1 text-[11px] text-[var(--muted-soft)]">
            {accountCount === 0
              ? "No accounts tracked yet"
              : `${accountCount} account${accountCount === 1 ? "" : "s"} tracked`}
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
        {page === "overview" ? <OverviewPage projectId={projectId} /> : null}
        {page === "creators" ? <CreatorsPage projectId={projectId} /> : null}
        {page === "accounts" ? <AccountsPage projectId={projectId} /> : null}
        {page === "videos" ? <VideosPage projectId={projectId} /> : null}
        {page === "viral" ? <ViralPage projectId={projectId} /> : null}
        {page === "requests" ? <RequestsPage projectId={projectId} /> : null}
        {page === "responses" ? (
          <ResponsesPage projectId={projectId} />
        ) : null}
        {page === "team" ? (
          <SimplePage
            title="Team Members"
            body="Invite and manage the team for this workspace."
          />
        ) : null}
        {page === "api-keys" ? (
          <SimplePage
            title="API Keys"
            body="Connect keys to sync social metrics."
          />
        ) : null}
        {page === "settings" ? (
          <SimplePage
            title="Settings"
            body="ViewTracker preferences for this project."
          />
        ) : null}
        {page === "support" ? (
          <SimplePage
            title="Support"
            body="Help and contact for ViewTracker."
          />
        ) : null}
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
