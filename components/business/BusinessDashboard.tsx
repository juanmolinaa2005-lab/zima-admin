"use client";

import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import type { Project } from "@/lib/types";
import { ConnectSupabaseModal } from "@/components/projects/ConnectSupabaseModal";
import {
  ContractIcon,
  DocumentIcon,
  GridIcon,
  LogoutIcon,
  TaskIcon,
  UsersIcon,
} from "@/components/dashboard/icons";
import { ContractsPanel } from "./ContractsPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { TasksPanel } from "./TasksPanel";
import { TeamPanel } from "./TeamPanel";
import { useBusinessWorkspace } from "./use-workspace";

export type BusinessSection =
  | "proyectos"
  | "task"
  | "documents"
  | "contratos"
  | "team";

const SECTIONS: {
  id: BusinessSection;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { id: "proyectos", label: "Proyectos", icon: GridIcon },
  { id: "task", label: "Task", icon: TaskIcon },
  { id: "documents", label: "Documents", icon: DocumentIcon },
  { id: "contratos", label: "Contratos", icon: ContractIcon },
  { id: "team", label: "Team", icon: UsersIcon },
];

function isSection(value: string | null): value is BusinessSection {
  return SECTIONS.some((section) => section.id === value);
}

type BusinessDashboardProps = {
  projects: Project[];
  userEmail: string | null;
  supabaseConnected: boolean;
};

export function BusinessDashboard({
  projects,
  userEmail,
  supabaseConnected: initialConnected,
}: BusinessDashboardProps) {
  const router = useRouter();
  const userKey = userEmail ?? "default";
  const [workspace, updateWorkspace] = useBusinessWorkspace(userKey);
  const clearLegacyDocuments = useCallback(
    () => updateWorkspace((prev) => ({ ...prev, documents: [] })),
    [updateWorkspace]
  );
  const [section, setSection] = useState<BusinessSection>("proyectos");
  const [connected, setConnected] = useState(initialConnected);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    setConnected(initialConnected);
  }, [initialConnected]);

  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("section");
    if (isSection(current)) setSection(current);
  }, []);

  function go(next: BusinessSection) {
    setSection(next);
    const url = new URL(window.location.href);
    if (next === "proyectos") url.searchParams.delete("section");
    else url.searchParams.set("section", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  return (
    <div className="flex min-h-dvh bg-[var(--background)]">
      <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.28)]">
            Z
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--foreground)]">
              My Business
            </p>
            <p className="truncate text-[11px] text-[var(--muted)]">Zima Admin</p>
          </div>
        </div>
        <nav aria-label="Secciones" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pt-4">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
            Workspace
          </p>
          {SECTIONS.map((item) => {
            const active = section === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                data-active={active}
                aria-current={active ? "page" : undefined}
                className="ui-nav-item"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}

          {projects.length > 0 ? (
            <>
              <p className="mb-1.5 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-soft)]">
                Proyectos
              </p>
              {projects.slice(0, 8).map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="ui-nav-item group"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent-ink)]">
                    {(project.name.trim()[0] || "P").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="text-[11px] text-[var(--muted-soft)] opacity-0 transition group-hover:opacity-100">
                    →
                  </span>
                </Link>
              ))}
            </>
          ) : null}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[image:var(--accent-metal)] text-[11px] font-bold text-white">
              {(userEmail?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-[var(--foreground)]">
                {userEmail ?? "Workspace"}
              </span>
              <span className="block text-[11px] text-[var(--muted-soft)]">Admin</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                <LogoutIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/85 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5 md:hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-bold text-white">
                Z
              </div>
              <p className="truncate text-[14px] font-semibold text-[var(--foreground)]">
                My Business
              </p>
            </div>
            <p className="hidden truncate text-[15px] font-semibold tracking-tight text-[var(--foreground)] md:block">
              {SECTIONS.find((item) => item.id === section)?.label}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  connected
                    ? "bg-[var(--success-soft)] text-[#027a48] hover:bg-[#d1fadf]"
                    : "bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[#e5e7eb]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-[var(--success)]" : "bg-[var(--accent)]"
                  }`}
                />
                {connected ? "Supabase conectado" : "Conectar Supabase"}
              </button>
              <form action={signOut} className="md:hidden">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                >
                  <LogoutIcon className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden">
            {SECTIONS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    active
                      ? "bg-[var(--accent)] text-white shadow-[0_2px_5px_rgba(0,0,0,0.28)]"
                      : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 outline-none sm:px-8">
          {section === "proyectos" ? (
            <ProjectsPanel
              projects={projects}
              userEmail={userEmail}
              connected={connected}
              workspace={workspace}
              onNeedConnect={() => setConnectOpen(true)}
              onOpenSection={go}
            />
          ) : null}
          {section === "task" ? (
            <TasksPanel tasks={workspace.tasks} onChange={updateWorkspace} />
          ) : null}
          {section === "documents" ? (
            <DocumentsPanel
              legacy={workspace.documents}
              onLegacyImported={clearLegacyDocuments}
            />
          ) : null}
          {section === "contratos" ? (
            <ContractsPanel
              contracts={workspace.contracts}
              onChange={updateWorkspace}
            />
          ) : null}
          {section === "team" ? (
            <TeamPanel team={workspace.team} onChange={updateWorkspace} />
          ) : null}
        </main>
      </div>

      <ConnectSupabaseModal
        open={connectOpen}
        connected={connected}
        onClose={() => setConnectOpen(false)}
        onChanged={(value) => {
          setConnected(value);
          router.refresh();
        }}
      />
    </div>
  );
}
