"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteProject,
  fetchRemoteSupabaseProjects,
} from "@/app/actions/projects";
import type { Project } from "@/lib/types";
import {
  loadRemoteNamesCache,
  saveRemoteNamesCache,
  saveRemotesCache,
} from "@/lib/client-cache";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { PlusIcon, TrashIcon } from "@/components/dashboard/icons";
import { EmptyState, SectionHead } from "./section-ui";
import type { BusinessWorkspace } from "@/lib/business/workspace-store";

type ProjectsPanelProps = {
  projects: Project[];
  userEmail: string | null;
  connected: boolean;
  workspace: BusinessWorkspace;
  onNeedConnect: () => void;
  onOpenSection: (section: "proyectos" | "task" | "documents" | "contratos" | "team") => void;
};

export function ProjectsPanel({
  projects,
  userEmail,
  connected,
  workspace,
  onNeedConnect,
  onOpenSection,
}: ProjectsPanelProps) {
  const router = useRouter();
  const userKey = userEmail ?? "default";
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [remoteNames, setRemoteNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!connected) {
      setRemoteNames({});
      return;
    }

    const cached = loadRemoteNamesCache(userKey);
    if (cached) setRemoteNames(cached.data);

    fetchRemoteSupabaseProjects()
      .then((remotes) => {
        saveRemotesCache(remotes, userKey);
        const names = Object.fromEntries(remotes.map((r) => [r.id, r.name]));
        saveRemoteNamesCache(names, userKey);
        setRemoteNames(names);
      })
      .catch(() => {
        // keep cached names if any
      });
  }, [connected, userKey]);

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete project “${name}”?`)) return;
    startTransition(async () => {
      await deleteProject(id);
      router.refresh();
    });
  }

  function handleCreateClick() {
    if (!connected) {
      onNeedConnect();
      return;
    }
    setModalOpen(true);
  }

  const openTasks = workspace.tasks.filter((t) => t.status !== "done").length;
  const activeContracts = workspace.contracts.filter(
    (c) => c.status === "active"
  ).length;

  return (
    <>
      {!connected ? (
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#635bff_0%,#8b5cf6_55%,#0ea5e9_130%)] p-5 text-white shadow-[var(--shadow-md)]">
          <div>
            <p className="text-[15px] font-semibold">Conecta Supabase</p>
            <p className="mt-1 text-[13px] text-white/80">
              Cada cuenta ve solo sus proyectos.
            </p>
          </div>
          <button
            type="button"
            onClick={onNeedConnect}
            className="inline-flex h-9 items-center rounded-lg bg-white px-4 text-[13px] font-semibold text-[var(--accent-ink)] shadow-sm transition hover:bg-white/90"
          >
            Conectar ahora
          </button>
        </div>
      ) : null}

      <SectionHead
        kicker="My Business"
        title="Proyectos"
        description="Elige un proyecto o crea uno nuevo."
        action={
          <button type="button" onClick={handleCreateClick} className="ui-btn-primary">
            <PlusIcon className="h-4 w-4" />
            New project
          </button>
        }
      />

      <ul className="mt-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Proyectos"
          value={String(projects.length)}
        />
        <StatCard
          label="Task abiertas"
          value={String(openTasks)}
          onClick={() => onOpenSection("task")}
        />
        <StatCard
          label="Contratos activos"
          value={String(activeContracts)}
          onClick={() => onOpenSection("contratos")}
        />
        <StatCard
          label="Team"
          value={String(workspace.team.length)}
          onClick={() => onOpenSection("team")}
        />
      </ul>

      {projects.length === 0 ? (
        <EmptyState
          title="Sin proyectos"
          body="Crea el primero."
          actionLabel="Create project"
          onAction={handleCreateClick}
        />
      ) : (
        <ul className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {projects.map((project) => {
            const linked = project.supabase_project_ref
              ? remoteNames[project.supabase_project_ref] ??
                project.supabase_project_ref
              : null;
            return (
              <li key={project.id} className="group relative">
                <Link
                  href={`/projects/${project.id}`}
                  className="ui-card ui-card-hover block p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[14px] font-bold text-[var(--accent-ink)]">
                      {(project.name.trim()[0] || "P").toUpperCase()}
                    </span>
                    <p className="min-w-0 truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {project.name}
                    </p>
                  </div>
                  {project.description ? (
                    <p className="mt-1 line-clamp-2 text-[13px] text-[var(--muted)]">
                      {project.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] text-[var(--muted-soft)]">
                      No description
                    </p>
                  )}
                  <p className="mt-4 flex items-center gap-1.5 border-t border-[var(--border)] pt-3 text-[12px] font-medium text-[var(--muted-soft)]">
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${linked ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"}`}
                    />
                    {linked
                      ? `Clients ← ${linked}`
                      : "No Supabase project linked"}
                  </p>
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleDelete(project.id, project.name)}
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-[var(--muted-soft)] opacity-0 transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] group-hover:opacity-100"
                  aria-label={`Delete ${project.name}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CreateProjectModal
        open={modalOpen}
        userKey={userKey}
        connected={connected}
        onClose={() => setModalOpen(false)}
        onNeedConnect={() => {
          setModalOpen(false);
          onNeedConnect();
        }}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const className =
    "ui-card block p-4 text-left" + (onClick ? " ui-card-hover" : "");

  const body = (
    <>
      <p className="text-[12px] font-medium text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </>
  );

  if (onClick) {
    return (
      <li>
        <button type="button" onClick={onClick} className={`w-full ${className}`}>
          {body}
        </button>
      </li>
    );
  }

  return <li className={className}>{body}</li>;
}
